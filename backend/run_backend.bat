@echo off
title NexusSocial FastAPI Backend
echo =======================================================
echo KHOI DONG BACKEND FASTAPI - NEXUSSOCIAL (PORT 8000)
echo Swagger Docs: http://localhost:8000/docs
echo =======================================================
:: Tu dong giai phong cong 8000 neu co tien trinh cu chay ngam
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo [NexusSocial] Dang giai phong cong 8000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

python main.py
pause

