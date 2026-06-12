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

#### 6. Acessar a Aplicação no Navegador
Para acessar a aplicação externamente:
1. Obtenha o **IP Público** da sua VM.
2. Acesse no navegador: `http://<IP_PUBLICO_DA_VM>` (a porta padrão é a `80`, então não é necessário especificá-la na URL).

> [!IMPORTANT]
> **Configuração de Firewall (Porta 80)**:
> Como a VM está hospedada no Azure (`azureuser`), você deve garantir que a porta **80 (HTTP)** está liberada nas regras de entrada de rede (Inbound Port Rules) da sua máquina virtual:
> 1. Vá ao **Portal do Azure**.
> 2. Navegue até a sua **Máquina Virtual** > aba **Networking** (Rede) > **Network Security Group** (NSG).
> 3. Clique em **Add inbound port rule** (Adicionar regra de porta de entrada).
> 4. Defina:
>    - **Source**: `Any`
>    - **Source port ranges**: `*`
>    - **Destination**: `Any`
>    - **Service**: `HTTP`
>    - **Destination port ranges**: `80`
>    - **Protocol**: `TCP`
>    - **Action**: `Allow`
> 5. Clique em **Add** para salvar.

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
3. **Erro 404 na API ao tentar se registrar ou interagir com o Backend**:
   - **Causa**: O Nginx estava configurado com `proxy_pass http://backend:5188;` sem uma barra diagonal (`/`) no final. Isso fazia com que requisições como `/api/auth/register` fossem repassadas ao container do backend exatamente como `/api/auth/register`. Como os controladores da API .NET estão mapeados sem o prefixo `/api` (ex: `[Route("auth")]`), o servidor retornava 404 Not Found.
   - **Resolução**: Adicionou-se uma barra diagonal final ao final da URL do `proxy_pass` (`http://backend:5188/;` no Docker e `http://127.0.0.1:5188/;` na configuração padrão), o que instrui o Nginx a remover o prefixo da rota correspondente (`/api/`) ao encaminhar a requisição ao backend.

---

# Documentação: Nós de NDVI e Análise Visual (Temporal, Boxplot, Barra)

## 📌 Resumo do Prompt
O usuário solicitou a criação de:
1. Um nó de **NDVI** que recupera e processa os dados de área vindos de um nó anterior de **Áreas (Geodata)**.
2. Três nós de análise (**Análise Temporal**, **Dispersão Boxplot** e **Gráfico de Barras**), cada um conectado ao nó NDVI, para exibir de forma gráfica e inteligível exatamente o que propõem.

---

## 💡 Resolução e Resposta

### 1. Frontend (Canvas do Workflow Editor)
- **Nó NDVI (`NdviNode`)**: Se conectado a um nó de áreas, lê o GeoJSON associado às áreas e gera valores NDVI (de -1.0 a 1.0) de forma determinística por talhão/polígono. Exibe informações resumo como o número de áreas mapeadas, o NDVI médio e a listagem individual das áreas com seus valores correspondentes às classificações.
- **Nó de Análise Temporal (`AnalysisTemporalNode`)**: Plota um gráfico de linhas SVG dinâmico e responsivo mostrando a variação mensal de NDVI (Janeiro a Junho) para todas as áreas detectadas na árvore de conexões.
- **Nó de Análise Boxplot (`AnalysisBoxplotNode`)**: Renderiza gráficos de Boxplot SVG horizontais representando a distribuição e dispersão estatística de NDVI por talhão (Min, Q1, Mediana, Q3, Max).
- **Nó de Gráfico de Barras (`AnalysisBarNode`)**: Apresenta um gráfico de barras verticais comparativo com os valores de NDVI atuais de cada talhão, coloridos de acordo com a saúde vegetal.
- **Barra Lateral e Painel de Configurações**: Adicionou-se a categoria **NDVI & Análise** na barra lateral de nós arrastáveis. O painel de configuração lateral foi customizado para cada nó, permitindo selecionar o método NDVI (Sentinel-2, Landsat-8 ou Simulação), ajustar o período de meses históricos da análise temporal, alternar outliers no Boxplot e customizar a paleta de cores do gráfico de barras.

### 2. Backend C# (Execução de Workflows)
- O `NodeExecutorService.cs` foi atualizado para processar os nós em ordem topológica:
  - O nó `ndvi` agrupa todas as feições (features) geográficas recebidas das conexões de entrada, calcula e estrutura métricas (série temporal, limites do boxplot e classificação) de forma consistente com o frontend e entrega ao barramento do workflow.
  - Os nós `analysis_temporal`, `analysis_boxplot` e `analysis_bar` recebem a saída do nó NDVI e imprimem relatórios estruturados nos logs do console durante as execuções e disparos automáticos ou manuais de teste.

---

## 🛠️ Comandos e Códigos Utilizados
As seguintes alterações foram feitas no repositório:
1. `c:\Users\ddemi\Desktop\Faculdade\PI_p2\AgroFlow\PALETA.MD`: Criação do manual de estilo e paleta de cores oficial.
2. `c:\Users\ddemi\Desktop\Faculdade\PI_p2\AgroFlow\backend\Services\NodeExecutorService.cs`: Lógica de processamento e logs em C# para NDVI e análises.
3. `c:\Users\ddemi\Desktop\Faculdade\PI_p2\AgroFlow\frontend\src\components\CustomNodes.tsx`: Criação de componentes React dos nós com renderizadores SVG integrados.
4. `c:\Users\ddemi\Desktop\Faculdade\PI_p2\AgroFlow\frontend\src\pages\WorkflowEditor.tsx`: Registro, mapeamento, arrastar-e-soltar e painel de controle dos nós.

Comandos executados para validação:
```bash
# Compilação e validação do Backend C# .NET
cd backend
dotnet build

# Compilação e validação do Frontend React/TypeScript
cd frontend
npm run build
```

---

## 🐛 Erros Resolvidos
1. **Erro de escopo de variáveis no painel de configurações do Frontend (tsc error)**:
   - **Causa**: Durante a reestruturação do `NodeConfigPanel`, as novas variáveis booleanas `isNdvi`, `isAnalysisTemporal`, `isAnalysisBoxplot` e `isAnalysisBar` foram utilizadas no formulário sem serem devidamente declaradas no escopo principal do componente.
   - **Resolução**: As declarações foram adicionadas junto com as variáveis existentes (`isTrigger`, `isSchedule`, `isAreas`) no cabeçalho do componente, permitindo que a compilação do TypeScript/Vite completasse com sucesso total (0 erros, 0 avisos).
2. **Erro de congelamento da barra lateral de nós no canvas (Layout CSS)**:
   - **Causa**: O empacotamento do `LeftSidebar` e `NodeConfigPanel` em `div`s condicionais sem declaração de altura (`h-full`) ou layout flexível causava a quebra do cálculo de flexbox do pai (`flex-1 overflow-hidden`), travando a barra lateral e impedindo a rolagem e os gestos de arrastar e soltar.
   - **Resolução**: Adicionou-se `h-full flex flex-col` às `div`s contêineres condicionais dos painéis laterais no arquivo `WorkflowEditor.tsx`, restaurando o comportamento correto de rolagem e permitindo arrastar os elementos.
3. **Erro do tipo de dados no nó temporal (TS2339 Property periodMonths does not exist on type unknown)**:
   - **Causa**: A propriedade `data` no objeto `Node` do React Flow é tipada como `unknown`. Tentar acessar `ndviNode?.data?.config?.periodMonths` diretamente causava falha no TypeScript.
   - **Resolução**: Realizou-se um cast explícito do objeto `ndviNode?.data` para `any` no nó `AnalysisTemporalNode`, silenciando o aviso do compilador e garantindo a correta leitura da propriedade.

---

# Documentação: Ajustes de Tempo do NDVI e Correção de Layout

## 📌 Resumo do Prompt
O usuário reportou que a barra lateral de nós no canvas estava travada e não permitia arrastar itens. Adicionalmente, reportou que a seleção de histórico temporal no nó de análise não se propagava ao nó NDVI. Solicitou-se mover a opção de escolher o range de tempo (3, 6 ou 12 meses/1 ano) diretamente para o nó de NDVI.

---

## 💡 Resolução e Resposta

### 1. Correção do Canvas e Drag-and-Drop (Barra Lateral)
- Restaurou-se o layout flexível aplicando `h-full flex flex-col` às `div`s que envelopam a barra lateral de nós (`LeftSidebar`) e o painel de configurações (`NodeConfigPanel`). Isso garantiu que ambos estiquem até a altura total e tenham barra de rolagem independente, liberando os gestos de arrastar.

### 2. Configuração de Range de Tempo no NDVI
- **Nó NDVI (`NdviNode`)**: Adicionou-se a opção de configuração de tempo no painel lateral. O usuário agora pode escolher entre 3 meses, 6 meses ou 1 ano (12 meses) de histórico para o cálculo de NDVI.
- **Gráfico Temporal**: A função `getNdviDataForNode` em `CustomNodes.tsx` foi atualizada para ler dinamicamente o range (`periodMonths`) configurado no nó de NDVI. A geração de datas agora cria a série histórica com a quantidade correta de meses.
- **Gráfico de Linha SVG**: Atualizou-se o renderizador do gráfico temporal para que calcule as coordenadas X dinamicamente dividindo o gráfico pela quantidade real de meses. Em caso de 12 meses, renderiza apenas meses alternados nos rótulos de rodapé, mantendo a visualização nítida e livre de poluição visual.
- **Backend**: Atualizou-se o método de execução do nó `ndvi` no backend C# (`NodeExecutorService.cs`) para ler a propriedade `periodMonths` e calcular/simular as séries no mesmo período temporal solicitado.



---

# Documentação: Execução Tardia, Gráficos no Painel e Múltiplas Áreas no NDVI

## 📌 Resumo do Prompt
O usuário reportou problemas no botão de execução manual e solicitou que os cálculos do NDVI e gráficos de análises só fossem computados e renderizados no canvas após a execução do fluxo (comando). Além disso, solicitou que os gráficos detalhados e tabelas também aparecessem no painel de configurações na direita quando um nó é clicado, e que o nó de NDVI passe a aceitar mais de um nó de Áreas como entrada para processar dados de todas as áreas juntas de forma unificada.

---

## 💡 Resolução e Resposta

### 1. Suporte a Múltiplos Nós de Áreas no NDVI
- **getNdviDataForNode**: Atualizou-se o buscador de conexões para trocar `.find(n => n.type === 'areas')` por `.filter(n => n.type === 'areas')`. Agora, ele recupera todos os nós de Áreas conectados, extrai suas respectivas feições do array GeoJSON (`features`), concatena e consolida em um único array de dados de talhões, aplicando o cálculo do NDVI sobre a união de todas as áreas de forma integrada. O backend C# (`NodeExecutorService.cs`) já estava estruturado para unir as feições de todos os inputs em uma lista, portanto nenhuma alteração foi necessária do lado do servidor para esta funcionalidade.

### 2. Atraso de Cálculos e Estado de "Aguardando Execução"
- Os componentes `NdviNode`, `AnalysisTemporalNode`, `AnalysisBoxplotNode` e `AnalysisBarNode` foram modificados para receber o objeto `data` em suas propriedades e ler a flag `isExecuted` (`data?.isExecuted || false`).
- Se `isExecuted` for `false`, os nós no canvas não efetuam cálculos estatísticos nem desenham os gráficos SVG. Em vez disso, mostram um estado cinza com um texto de espera *"Aguardando Execução..."* e um indicador circular pulsante amarelo em conformidade com as diretrizes do [PALETA.MD](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/PALETA.MD).
- Ao disparar o botão manual de play no trigger ou o botão "EXECUTE TEST" no cabeçalho, a flag `isExecuted` de todos os nós é atualizada para `true`, fazendo com que os nós renderizem e desenhem os gráficos instantaneamente.

### 3. Exibição de Gráficos e Distribuição no Painel Direito
- **Gráficos de Análise**: Corrigiu-se a leitura do estado de execução `isExecuted` obtendo sempre o nó atualizado do estado `nodes` do React Flow (`nodes.find(...) || selectedNode`). Isso permitiu que os gráficos ampliados desenhados no painel de configuração lateral apareçam corretamente e de forma dinâmica no momento em que o fluxo é executado.
- **Detalhamento do NDVI**: Adicionou-se uma barra de progresso empilhada colorida no painel de configuração lateral do nó NDVI, representando visualmente a distribuição de classificação de saúde de vegetação ("Muito Alto" em verde escuro, "Alto" em esmeralda, "Moderado" em limão, "Baixo" em amarelo, "Nulo/Água" em azul).

### 4. Correção de Closures Estáticas no Botão de Execução
- Como o React Flow gerencia estados de nós persistentes e callbacks como `onExecute` capturam closures de renderizações antigas, o botão de play no canvas não atualizava o estado de execução corretamente.
- Solucionou-se isso implementando um `handleExecuteRef = useRef(handleExecute)` que se mantém atualizado a cada renderização. O `onExecute` dos nós de trigger agora aponta para `() => handleExecuteRef.current?.(true)`, garantindo chamadas sempre frescas com os setters de estado de nós corretos.
- Inicializou-se a propriedade `isExecuted: false` nos fluxos de `onDrop` (arrastar novos nós) e `handlePaste` (copiar e colar nós) para assegurar conformidade do ciclo de vida.

---

## 🛠️ Comandos e Códigos Utilizados
As alterações foram concentradas nos seguintes arquivos:
1. [CustomNodes.tsx](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/frontend/src/components/CustomNodes.tsx): Correção de `getNdviDataForNode` para unificar feições de múltiplos inputs e adição da verificação de `isExecuted` nos renderizadores de canvas.
2. [WorkflowEditor.tsx](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/frontend/src/pages/WorkflowEditor.tsx): Adição do `handleExecuteRef` para desvincular closures estáticas, inicialização da flag nos nós criados ou colados, e barra visual empilhada de distribuição no painel de configuração NDVI.

Comandos para validação:
- Build do Frontend: `npm run build` na pasta `frontend` (Compilado com sucesso).
- Build do Backend: `dotnet build` na pasta `backend` (Compilado com sucesso).

---

## 🐛 Erros Resolvidos
1. **Erro de Exportação do `getNdviDataForNode` (TS2459)**:
   - **Causa**: O compilador TypeScript falhou ao tentar compilar a build do Docker do frontend porque `WorkflowEditor.tsx` importava `getNdviDataForNode` do arquivo `CustomNodes.tsx`, porém o componente declarava esta função localmente sem o prefixo `export`.
   - **Resolução**: Adicionou-se `export` à declaração `export const getNdviDataForNode = ...` em `CustomNodes.tsx` permitindo a importação correta em outros arquivos.

---

# Documentação: Nome das Áreas, Dados Dinâmicos e Nó de E-mail

## 📌 Resumo do Prompt
O usuário solicitou as seguintes melhorias e funcionalidades:
1. **Nome Personalizado nas Áreas**: Permitir adicionar um nome de área no nó correspondente e passá-lo para o NDVI para nomear os talhões no fluxo.
2. **Dados Dinâmicos e Aleatórios**: Evitar dados idênticos (mockados iguais) para diferentes áreas. Tornar a simulação de NDVI e as análises estatísticas mais randômicas e únicas para cada talhão.
3. **Exibição Multilinhas no Gráfico**: Mostrar as curvas de NDVI de cada uma das áreas conectadas no gráfico de linha, com uma legenda associando as cores dos traços aos nomes das áreas.
4. **Nó de E-mail (`EmailNode`)**: Criar um nó que recebe as análises realizadas, gera um corpo de e-mail estilizado corporativo em HTML contendo a tabela de talhões, status e recomendações automáticas, e exibe o rascunho em tempo real no painel de configurações na direita.

---

## 💡 Resolução e Resposta

### 1. Customização do Nome da Área
- Adicionou-se um campo do tipo `text` de "Nome da Área" no `NodeConfigPanel` de nós de Áreas (`WorkflowEditor.tsx`).
- O canvas passou a exibir dinamicamente o nome configurado (`areaName`) no card do `AreasNode`.

### 2. Sementes Determinísticas e Randomização Avançada
- Modificou-se a função de simulação `getNdviDataForNode` no frontend (`CustomNodes.tsx`) e a lógica do backend (`NodeExecutorService.cs`) para gerar um hash a partir da combinação de `${nodeId}-${featureIndex}-${areaCombinedName}`.
- Com isso, cada área gera suas próprias curvas de sazonalidade, tendências históricas e limites de dispersão estatística (boxplot) sem sobreposições ou similaridades.

### 3. Exibição de Múltiplas Linhas e Legenda no Canvas
- O nó de análise temporal desenha uma linha SVG para cada área conectada.
- Adicionou-se uma mini-legenda de cores e nomes no próprio nó da análise temporal no canvas, permitindo identificar facilmente a qual área cada traço pertence.

### 4. Nó de E-mail (`EmailNode`)
- **Visualização**: Implementou-se um card com borda roxa (`#d946ef` / purple-500) e ícone de carta (`Mail`).
- **Prévia**: Renderiza uma prévia fiel do e-mail HTML corporativo no painel lateral de configurações, permitindo alterar Destinatário (`to`) e Assunto (`subject`) dinamicamente.
- **Logs**: O backend .NET simula o mesmo corpo HTML e realiza a impressão estruturada em formato de texto e código HTML nos logs do console durante as execuções.

---

## 🛠️ Comandos e Códigos Utilizados

### Execução de Builds de Validação
```bash
# Validação do Frontend
cd frontend
npm run build

# Validação do Backend
cd backend
dotnet build
```

### Correções Aplicadas nos Arquivos
1. **[CustomNodes.tsx](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/frontend/src/components/CustomNodes.tsx)**: Hash determinístico com ID de nó, legenda no rodapé de `AnalysisTemporalNode`, helper de e-mail e componente visual do nó de e-mail.
2. **[WorkflowEditor.tsx](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/frontend/src/pages/WorkflowEditor.tsx)**: Mapeamento de formulários para os nós de Áreas e E-mail com live preview HTML em container adaptado.
3. **[NodeExecutorService.cs](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/backend/Services/NodeExecutorService.cs)**: Formatação estruturada de inputs de área, randomização C# e mock de e-mail com logging em console.

---

## 🐛 Erros Resolvidos
1. **Aviso CS8620 no Backend (dotnet build warning)**:
   - **Causa**: Atribuição de tupla contendo tipo de string anulável a uma lista tipada estritamente com string não-anulável (`List<(JsonElement feature, string customAreaName)>`).
   - **Resolução**: Tratou-se explicitamente a nulidade do retorno de `anProp.GetString()` aplicando o operador coalescente nulo (`?? "Área"`).

---

# Documentação: Saídas nas Análises e Validação de Conexão Trigger-Email

## 📌 Resumo do Prompt
O usuário solicitou as seguintes melhorias:
1. **Ponto de Saída nos Nós de Análise**: Permitir que os nós de análise (Temporal, Boxplot, Barras) tenham pontos de saída (source handles) para alimentar nós seguintes, como o de E-mail.
2. **Validação de Conexões**: Adicionar validações de modo que o nó de gatilho por botão não consiga se conectar diretamente com o nó de E-mail.

---

## 💡 Resolução e Resposta

### 1. Pontos de Saída (Source Handles) nos Nós de Análise
- **Frontend**: Modificou-se o arquivo `CustomNodes.tsx` adicionando `<Handle type="source" ... />` ao final dos componentes `AnalysisTemporalNode` (Indigo), `AnalysisBoxplotNode` (Fuchsia) e `AnalysisBarNode` (Orange).
- **Backend**: Atualizou-se o método de utilidade `ExtractNdviData` no backend `NodeExecutorService.cs` para detectar se a entrada vem envelopada dentro de um objeto contendo a propriedade `data` (retorno padrão dos nós de análise), e realizar a extração para leitura correta dos registros de NDVI.

### 2. Validação da Conexão Gatilho de Botão -> E-mail
- **Frontend (Canvas)**: Definido o callback `isValidConnection` e passado como prop a `<ReactFlow>` no arquivo `WorkflowEditor.tsx`. Isso impede fisicamente a ligação visual no canvas de gatilhos para nós de e-mail.
- **Frontend (Feedback UX)**: Adicionou-se lógica dentro do `onConnect` que, caso tentado, exibe uma mensagem de toast clara: *"O nó de Gatilho de Botão não pode se conectar diretamente ao nó de E-mail."*.
- **Backend**: Alterou-se o método `CreateConnection` em `ConnectionsController.cs` para validar as categorias dos nós de origem e destino diretamente no banco de dados, retornando `BadRequest` (400) em conexões proibidas de `trigger` -> `email`.

---

## 🛠️ Comandos e Códigos Utilizados

### Execução de Builds de Validação
```bash
# Validação do Frontend
cd frontend
npm run build

# Validação do Backend
cd backend
dotnet build
```

### Modificações nos Arquivos
1. **[CustomNodes.tsx](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/frontend/src/components/CustomNodes.tsx)**: Adicionados handles de saída correspondentes a cada nó de análise.
2. **[WorkflowEditor.tsx](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/frontend/src/pages/WorkflowEditor.tsx)**: Adicionados callbacks de validação `isValidConnection` e validação ativa com alerta de toast no `onConnect`.
3. **[ConnectionsController.cs](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/backend/Controllers/ConnectionsController.cs)**: Adicionado validação no banco de dados rejeitando conexões proibidas entre nós de categoria `trigger` e `email`.
4. **[NodeExecutorService.cs](file:///c:/Users/ddemi/Desktop/Faculdade/PI_p2/AgroFlow/backend/Services/NodeExecutorService.cs)**: Refatoração do `ExtractNdviData` para decodificar objetos que possuem a propriedade `"data"` interna.


