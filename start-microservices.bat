@echo off
title Khoi dong NexusSocial Microservices
echo ===================================================================
echo   KHOI DONG HE THONG MICROSERVICES NEXUSSOCIAL (SHARED DATABASE)
echo ===================================================================

:: Thiet lap duong dan node_modules dung chung cho tat ca services
set "NODE_PATH=%~dp0backend\node_modules;%~dp0node_modules"

:: ---------------------------------------------------------------
:: Buoc 0: Giai phong cac cong cu neu con tien trinh chay ngam
:: ---------------------------------------------------------------
echo [0/8] Dang giai phong cac cong dang su dung (neu co)...
for %%P in (5000 5001 5002 5003 5004 8000 8001) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%P ^| findstr LISTENING') do (
        echo       Giai phong cong %%P - PID: %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)
timeout /t 1 >nul

echo [1/8] Khoi dong Platform API: Auth, Messages, Friends (Port 8000)...
start "Platform API (Python :8000)" cmd /k "cd /d %~dp0backend && call run_backend.bat"

timeout /t 3 >nul

echo [2/8] Khoi dong AI Inference Service (Port 8001)...
start "AI Inference Service (Python :8001)" cmd /k "call %~dp0services\ai-service\run.bat"

timeout /t 3 >nul

echo [3/8] Khoi dong User Service (Port 5001)...
start "User Service (:5001)" cmd /k "set NODE_PATH=%~dp0backend\node_modules&& node services/user-service/server.js"

echo [4/8] Khoi dong Social Content Service (Port 5002)...
start "Post Service (:5002)" cmd /k "set NODE_PATH=%~dp0backend\node_modules&& set AI_SERVICE_URL=http://127.0.0.1:8001&& set FASTAPI_URL=http://127.0.0.1:8000&& node services/post-service/server.js"

echo [5/8] Khoi dong Moderation Service (Port 5003)...
start "Moderation Service (:5003)" cmd /k "set NODE_PATH=%~dp0backend\node_modules&& node services/moderation-service/server.js"

echo [6/8] Khoi dong Realtime ^& Notification Service (Port 5004)...
start "Notification Service (:5004)" cmd /k "set NODE_PATH=%~dp0backend\node_modules&& node services/notification-service/server.js"

timeout /t 2 >nul

echo [7/8] Khoi dong API Gateway (Port 5000)...
start "API Gateway (:5000)" cmd /k "node gateway/server.js"

echo [8/8] Khoi dong Frontend React Vite (Port 5173)...
start "Frontend React (:5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ===================================================================
echo   HE THONG MICROSERVICES NEXUSSOCIAL DA KHOI DONG HOAN TAT!
echo ===================================================================
echo   - Frontend:       http://localhost:5173
echo   - API Gateway:    http://localhost:5000
echo   - Health Check:   http://localhost:5000/api/health
echo   - Routing Map:    http://localhost:5000/api/gateway/routes
echo   - Platform Docs:  http://localhost:8000/docs (internal; use gateway)
echo   - AI Inference:   http://localhost:8001 (internal; use gateway)
echo ===================================================================
echo.
echo [*] Dang cho he thong san sang de mo trinh duyet...

:: Cho API Gateway san sang
set TRIES=0
:WAIT_GATEWAY
curl -s http://127.0.0.1:5000/api/health >nul 2>&1
if %errorlevel% equ 0 goto GATEWAY_OK
set /a TRIES+=1
if %TRIES% gtr 30 goto OPEN_BROWSER
timeout /t 1 /nobreak >nul
goto WAIT_GATEWAY

:GATEWAY_OK
echo   -^> [OK] API Gateway da san sang!

:OPEN_BROWSER
echo [*] Dang mo trinh duyet...
timeout /t 2 /nobreak >nul
start http://localhost:5173
pause
