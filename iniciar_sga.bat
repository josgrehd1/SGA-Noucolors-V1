@echo off
chcp 65001 > nul
title SGA NouColors - Iniciando...

echo.
echo  =====================================================
echo   SGA NouColors - Arranque en MODO PRODUCCION
echo  =====================================================
echo.

set ROOT=%~dp0
set FRONTEND_DIR=%ROOT%frontend
set BACKEND_DIR=%ROOT%backend

echo [1/2] Compilando frontend React...
cd /d "%FRONTEND_DIR%"
call npm run build
if errorlevel 1 (
    echo.
    echo  ERROR: Fallo al compilar el frontend.
    pause
    exit /b 1
)
echo  Frontend compilado correctamente.
echo.

echo [2/2] Iniciando servidor Flask en modo produccion...
echo  El puerto se lee de la variable PORT en backend/.env (por defecto 5000)
echo  Si configuras PORT=60086, accede desde la red a: http://[IP-DEL-SERVIDOR]:60086
echo.
cd /d "%BACKEND_DIR%"
call venv\Scripts\activate.bat
python run.py

pause
