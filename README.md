# SGA NouColors V1 (React + Flask + Vite + Ant Design)

Sistema de Gestión de Almacén (SGA) para NouColors y Kleantek con conexión a SAP Business One sobre **Microsoft SQL Server**.

## 🚀 Estructura del Proyecto

- `backend/`: API Server en Flask (Python) con arquitectura en 3 capas:
  - **`routes/api.py`**: Puntos de entrada REST unificados.
  - **`services/`**: Lógica de negocio (Semi Preparar reparado, Stock, Albaranes, Impresión ZPL Zebra).
  - **`data/sap_repository.py`**: Capa exclusiva OData v2 (`/b1s/v2/`) para Microsoft SQL Server.
- `frontend/`: Aplicación SPA en React + Vite + Ant Design (`Row`/`Col` Grid) + LocalStorage.

## 🛠️ Cómo Ejecutar

### 1. Backend (Flask)
```bash
cd backend
pip install -r requirements.txt
python run.py
```
*El servidor Flask iniciará en http://localhost:5000*

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
*La aplicación cliente iniciará en http://localhost:5173 (con proxy automático a http://localhost:5000)*
