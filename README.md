# Mini N8N - Workflow Automation

A full-stack replica of a workflow automation tool like N8N.

## 🚀 Features

- **Visual Workflow Editor**: Powered by React Flow with drag-and-drop nodes.
- **Node Categories**: 
  - 🟢 **Button Trigger**: Manually start a workflow.
  - 🔴 **Console Alert**: Emit alerts to the server console.
  - 🔵 **Print Log**: Log messages with timestamps.
- **Direct Execution**: Run workflows from the dashboard or the canvas.
- **Auth System**: JWT-based authentication with Refresh Tokens.
- **Real-time Statistics**: View active/inactive workflow counts.

## 🛠️ Tech Stack

- **Backend**: C# (.NET 8 Web API), EF Core, SQLite, JWT Bearer.
- **Frontend**: React, Vite, TypeScript, TailwindCSS, React Flow, React Query, Axios.

## ⚙️ Setup Instructions

### Backend
1. Navigate to the `backend` folder.
2. Ensure you have the .NET 8 SDK installed.
3. Run `dotnet restore` to install dependencies.
4. Run `dotnet run` to start the API (typically on `https://localhost:7112`).
   - The database (`minin8n.db`) will be created automatically on the first run.

### Frontend
1. Navigate to the `frontend` folder.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and confirm `VITE_API_BASE_URL=/api`.
4. Run `npm run build` to generate production assets.

### Azure / nginx
1. Build the frontend and make the `dist` contents available under your nginx site root.
2. Run the backend API on the VM at `http://127.0.0.1:5188`.
3. Use `nginx.conf` as a reverse proxy so browser requests go to the static frontend and `/api/*` forwards to the backend.

## 📂 Project Structure

- `/backend`: .NET 8 Web API with Feature-based organization.
- `/frontend`: React + TypeScript application with TailwindCSS and React Flow.

## 📝 Usage

1. **Register** a new account.
2. **Login** to access your dashboard.
3. **Create** a new workflow.
4. **Open** the canvas and drag nodes from the sidebar.
5. **Connect** the nodes (e.g., Trigger -> Alert -> Log).
6. **Click "Execute"** to see results in the server's console.
7. Use the **Play button** on the dashboard card for quick execution.
