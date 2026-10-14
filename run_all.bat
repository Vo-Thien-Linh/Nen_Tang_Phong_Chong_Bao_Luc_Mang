@echo off
title NexusSocial - Khoi dong toan bo he thong
echo ================================================================
echo    KHOI DONG NEN TANG PHONG CHONG BAO LUC MANG (NEXUSSOCIAL)
echo ================================================================
echo [1/3] Khoi dong Backend FastAPI Python (Port 8000)...
start "NexusSocial - FastAPI (8000)" cmd /k "cd /d %~dp0backend && run_backend.bat"

timeout /t 2 /nobreak >nul

echo [2/3] Khoi dong Backend Express Node.js (Port 5000)...
start "NexusSocial - Node.js Express (5000)" cmd /k "cd /d %~dp0backend && run_node_backend.bat"

timeout /t 2 /nobreak >nul

echo [3/3] Khoi dong Frontend React Vite (Port 5173)...
start "NexusSocial - Frontend (5173)" cmd /k "cd /d %~dp0frontend && run_frontend.bat"

timeout /t 3 /nobreak >nul

echo ================================================================
echo   TAT CA DICH VU DA DUOC KHOI DONG THANH CONG!
echo   - Frontend:       http://localhost:5173
echo   - Backend FastAPI: http://localhost:8000
echo     + Swagger API:  http://localhost:8000/docs
echo   - Backend Express: http://localhost:5000
echo ================================================================
start http://localhost:5173
pause
