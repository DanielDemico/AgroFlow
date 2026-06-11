# Documentação do Deploy em VM (AgroFlow / Mini N8N)

## 📌 Resumo do Prompt
O usuário solicitou instruções de como realizar o deploy da aplicação (composta por um frontend React/Vite/TS e um backend .NET 8 Web API com banco SQLite) em uma Máquina Virtual (VM).

---

## 💡 Resolução e Resposta

Abaixo estão os dois métodos principais para realizar o deploy desta aplicação em uma VM (por exemplo, Ubuntu 22.04 LTS na Azure, AWS, GCP ou DigitalOcean).

---

### Método A: Deploy Manual (Nginx + Systemd + .NET SDK)

Este método envolve instalar o .NET e o Nginx diretamente no sistema operacional da VM e configurar um serviço do sistema para manter o backend rodando.

#### 1. Preparar a VM e Instalar Dependências
Conecte-se à sua VM via SSH e execute os seguintes comandos para instalar o .NET 8 e o Nginx:

```bash
# Atualizar pacotes
sudo apt-get update && sudo apt-get upgrade -y

# Instalar o SDK ou Runtime do .NET 8
sudo apt-get install -y dotnet-sdk-8.0

# Instalar o Servidor Web Nginx
sudo apt-get install -y nginx

# Instalar Node.js e npm (opcional, apenas se for buildar o frontend diretamente na VM)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Compilar e Publicar o Backend (.NET)
No seu computador de desenvolvimento (ou na VM após clonar o repositório), compile o backend para produção:

```bash
cd backend
dotnet publish -c Release -o ./publish
```

Transfira a pasta `publish` gerada para a VM no diretório `/var/www/agroflow/backend/` (usando `scp`, `rsync` ou SFTP).

#### 3. Configurar o Serviço do Backend (Systemd)
Para garantir que o backend inicie automaticamente com a VM e reinicie em caso de falhas, crie um serviço `systemd`:

```bash
sudo nano /etc/systemd/system/agroflow-backend.service
```

Cole a seguinte configuração no arquivo:

```ini
[Unit]
Description=AgroFlow Backend API (.NET 8)
After=network.target

[Service]
WorkingDirectory=/var/www/agroflow/backend
ExecStart=/usr/bin/dotnet /var/www/agroflow/backend/backend.dll --urls "http://127.0.0.1:5188"
Restart=always
# Reiniciar após 10 segundos em caso de falha
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=agroflow-backend
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target
```

Ative e inicie o serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable agroflow-backend
sudo systemctl start agroflow-backend

# Verificar se está rodando com sucesso:
sudo systemctl status agroflow-backend
```

#### 4. Compilar e Publicar o Frontend (React + Vite)
No diretório do frontend, configure a variável de ambiente criando um arquivo `.env` na VM (ou build localmente e transfira):

```env
VITE_API_BASE_URL=/api
```

Compile os arquivos estáticos:

```bash
cd frontend
npm install
npm run build
```

Isso gerará a pasta `dist`. Copie todo o conteúdo dessa pasta para o diretório `/var/www/agroflow/frontend/` na VM.
Certifique-se de que as permissões de leitura estão corretas:
```bash
sudo chown -R www-data:www-data /var/www/agroflow/frontend
```

#### 5. Configurar o Nginx como Proxy Reverso
Crie uma nova configuração de site no Nginx:

```bash
sudo nano /etc/nginx/sites-available/agroflow
```

Adicione a seguinte configuração (substituindo pelo IP público ou domínio da VM):

```nginx
server {
    listen 80;
    server_name _; # Adicione seu IP público ou domínio aqui, ex: 203.0.113.5 ou agroflow.com

    root /var/www/agroflow/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para as chamadas de API do backend
    location /api/ {
        proxy_pass http://127.0.0.1:5188;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy para o Swagger (opcional, útil para testes)
    location /swagger/ {
        proxy_pass http://127.0.0.1:5188/swagger/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative o site e reinicie o Nginx:

```bash
# Remover o site padrão do nginx para evitar conflitos
sudo rm /etc/nginx/sites-enabled/default

# Criar o link simbólico
sudo ln -s /etc/nginx/sites-available/agroflow /etc/nginx/sites-enabled/

# Testar se a sintaxe do Nginx está correta
sudo nginx -t

# Reiniciar o serviço
sudo systemctl restart nginx
```

---

### Método B: Deploy Moderno e Prático (Docker & Docker Compose) 🚀

Esta é a abordagem recomendada por ser mais simples, isolada e evitar problemas de compatibilidade de versões do SDK ou Node na VM.

#### 1. Instalar o Docker na VM
Siga os comandos oficiais para instalar o Docker e Docker Compose na sua VM Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

#### 2. Criar o Dockerfile do Backend (`/backend/Dockerfile`)
Crie o arquivo no diretório `backend`:

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["backend.csproj", "./"]
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
# Garante que o banco SQLite persistirá em um volume se necessário
EXPOSE 5188
ENTRYPOINT ["dotnet", "backend.dll", "--urls", "http://0.0.0.0:5188"]
```

#### 3. Criar o Dockerfile do Frontend (`/frontend/Dockerfile`)
Crie o arquivo no diretório `frontend`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Configura o endpoint padrão da API
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 4. Criar o arquivo `docker-compose.yml` na raiz do projeto
Crie o arquivo na raiz:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "5188:5188"
    volumes:
      - backend-db:/app
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
    restart: always

volumes:
  backend-db:
```

#### 5. Executar a Aplicação na VM
Suba a aplicação com um único comando na VM:

```bash
docker-compose up -d --build
```

Isso irá buildar o backend .NET, compilar o frontend React, usar o seu `nginx.conf` da raiz para servir o frontend e fazer proxy das chamadas para `/api/*` diretamente para o backend na rede interna do Docker.

---

## 🛠️ Comandos e Códigos Utilizados
Foram criados fisicamente no projeto os seguintes arquivos para habilitar a execução via Docker:
1. `backend/Dockerfile` (Arquivo de build da API .NET 8)
2. `frontend/Dockerfile` (Arquivo de build do frontend React + Nginx)
3. `nginx.docker.conf` (Configuração do Nginx adaptada para rotas do ambiente Docker)
4. `docker-compose.yml` (Orquestrador multi-container para subir toda a aplicação de uma vez)
5. `frontend/tsconfig.json` (Arquivo de configuração do TypeScript para permitir a compilação local e no container)

## 🐛 Erros Resolvidos
1. **Erro de Dependência Peer (npm ERESOLVE) no build do Frontend**:
   - **Causa**: O pacote `@react-leaflet/core` instalado exige o React 19 como dependência peer, enquanto o projeto utiliza a versão 18. Isso causava a falha do comando `npm ci` durante a build do Docker.
   - **Resolução**: Alterou-se o `frontend/Dockerfile` de `RUN npm ci` para `RUN npm ci --legacy-peer-deps` a fim de contornar a validação estrita de conflitos de peer-dependencies durante a compilação do container.
2. **Erro de help do tsc (TypeScript Compiler) no build do Frontend**:
   - **Causa**: A ausência do arquivo `tsconfig.json` na pasta do frontend fazia com que o script de build (`tsc && vite build`) falhasse na etapa do `tsc`, fazendo com que ele apenas imprimisse sua ajuda na tela e saísse com código de erro.
   - **Resolução**: Criou-se o arquivo `frontend/tsconfig.json` com configurações padrão do React + Vite e suporte aos tipos de ambiente do Vite (`"types": ["vite/client"]`) para permitir que o compilador do TypeScript realize o build com sucesso.
