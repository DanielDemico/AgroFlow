# Paleta de Cores do AgroFlow

Esta paleta define o esquema de cores utilizado para os nós e gráficos do fluxo de trabalho.

## 🎨 Cores Base (Dark Mode)
- **Background Principal**: `#0f172a` (Slate 900)
- **Background Secundário / Cards**: `#1e293b` (Slate 800)
- **Bordas / Divisores**: `#334155` (Slate 700)
- **Texto Principal**: `#f1f5f9` (Slate 100)
- **Texto Secundário**: `#94a3b8` (Slate 400)

## 📌 Cores dos Nós

| Nó | Categoria | Cor Hex | Tailwind Class |
|---|---|---|---|
| **Trigger** | Trigger | `#3b82f6` (Blue 500) | `bg-blue-500` / `border-blue-500` |
| **Schedule** | Schedule | `#06b6d4` (Cyan 500) | `bg-cyan-500` / `border-cyan-500` |
| **Areas (Geodata)** | Geodata | `#38bdf8` (Sky 400) | `bg-sky-400` / `border-sky-400` |
| **NDVI** | Processamento | `#10b981` (Emerald 500) | `bg-emerald-500` / `border-emerald-500` |
| **Análise Temporal** | Análise | `#6366f1` (Indigo 500) | `bg-indigo-500` / `border-indigo-500` |
| **Análise Boxplot** | Análise | `#d946ef` (Fuchsia 500) | `bg-fuchsia-500` / `border-fuchsia-500` |
| **Gráfico de Barra** | Análise | `#f97316` (Orange 500) | `bg-orange-500` / `border-orange-500` |
| **Action** | Ação | `#22c55e` (Green 500) | `bg-green-500` / `border-green-500` |

## 📊 Cores de Dados NDVI (Vegetação)
- **NDVI Muito Alto (Saudável)**: `#047857` (Emerald 700) - NDVI > 0.7
- **NDVI Alto**: `#10b981` (Emerald 500) - NDVI 0.5 a 0.7
- **NDVI Moderado (Ralo)**: `#84cc16` (Lime 500) - NDVI 0.3 a 0.5
- **NDVI Baixo / Solo**: `#eab308` (Yellow 500) - NDVI 0.1 a 0.3
- **NDVI Nulo / Água**: `#3b82f6` (Blue 500) - NDVI < 0.1
