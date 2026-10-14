@echo off
title NexusSocial Express Node.js Backend
echo =======================================================
echo KHOI DONG BACKEND EXPRESS NODE.JS - NEXUSSOCIAL (PORT 5000)
echo =======================================================
:: Tu dong giai phong cong 5000 neu co tien trinh cu chay ngam
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo [NexusSocial] Dang giai phong cong 5000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

npm start
pause
