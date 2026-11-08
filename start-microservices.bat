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
start "Platform API (Python :8000)" /D "%~dp0backend" "%ComSpec%" /k run_backend.bat
call :WAIT_FOR_URL "Platform API" "http://127.0.0.1:8000/api/health" 90 || goto STARTUP_FAILED

echo [2/8] Khoi dong AI Inference Service (Port 8001)...
start "AI Inference Service (Python :8001)" /D "%~dp0" "%ComSpec%" /k call services\ai-service\run.bat
call :WAIT_FOR_URL "AI Inference Service PhoBERT va EfficientNet" "http://127.0.0.1:8001/health" 180 || goto STARTUP_FAILED

echo [3/8] Khoi dong User Service (Port 5001)...
start "User Service (:5001)" /D "%~dp0" "%ComSpec%" /k node services\user-service\server.js
call :WAIT_FOR_URL "User Service" "http://127.0.0.1:5001/health" 60 || goto STARTUP_FAILED

echo [4/8] Khoi dong Social Content Service (Port 5002)...
start "Post Service (:5002)" /D "%~dp0" "%ComSpec%" /k "set AI_SERVICE_URL=http://127.0.0.1:8001 && set FASTAPI_URL=http://127.0.0.1:8000 && node services\post-service\server.js"
call :WAIT_FOR_URL "Social Content Service" "http://127.0.0.1:5002/health" 60 || goto STARTUP_FAILED

echo [5/8] Khoi dong Moderation Service (Port 5003)...
start "Moderation Service (:5003)" /D "%~dp0" "%ComSpec%" /k node services\moderation-service\server.js
call :WAIT_FOR_URL "Moderation Service" "http://127.0.0.1:5003/health" 60 || goto STARTUP_FAILED

echo [6/8] Khoi dong Realtime ^& Notification Service (Port 5004)...
start "Notification Service (:5004)" /D "%~dp0" "%ComSpec%" /k node services\notification-service\server.js
call :WAIT_FOR_URL "Realtime / Notification Service" "http://127.0.0.1:5004/health" 60 || goto STARTUP_FAILED

echo [7/8] Khoi dong API Gateway (Port 5000)...
start "API Gateway (:5000)" /D "%~dp0" "%ComSpec%" /k node gateway\server.js
call :WAIT_FOR_URL "API Gateway" "http://127.0.0.1:5000/api/gateway/routes" 30 || goto STARTUP_FAILED

echo [8/8] Khoi dong Frontend React Vite (Port 5173)...
start "Frontend React (:5173)" /D "%~dp0frontend" "%ComSpec%" /k npm run dev

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
goto :EOF

:WAIT_FOR_URL
setlocal
set "WAIT_NAME=%~1"
set "WAIT_URL=%~2"
set /a WAIT_REMAINING=%~3
:WAIT_FOR_URL_RETRY
curl.exe -fsS --max-time 2 "%WAIT_URL%" >nul 2>&1
if not errorlevel 1 goto WAIT_FOR_URL_READY
if %WAIT_REMAINING% LEQ 0 goto WAIT_FOR_URL_FAILED
timeout /t 1 /nobreak >nul
set /a WAIT_REMAINING-=1
goto WAIT_FOR_URL_RETRY

:WAIT_FOR_URL_READY
echo       [OK] %WAIT_NAME% da san sang.
endlocal & exit /b 0

:WAIT_FOR_URL_FAILED
echo       [LOI] %WAIT_NAME% khong san sang sau %~3 giay: %~2
endlocal & exit /b 1

:STARTUP_FAILED
echo.
echo [LOI] Mot service khong khoi dong kip. Kiem tra cua so service tuong ung.
pause
exit /b 1
