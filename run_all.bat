@echo off
title NexusSocial - Khoi dong toan bo he thong
echo ================================================================
echo    KHOI DONG NEN TANG PHONG CHONG BAO LUC MANG (NEXUSSOCIAL)
echo ================================================================

echo [1/3] Khoi dong Backend FastAPI Python (Port 8000)...
start "NexusSocial - FastAPI (8000)" cmd /k "cd /d %~dp0backend && run_backend.bat"

echo [2/3] Khoi dong Backend Express Node.js (Port 5000)...
start "NexusSocial - Node.js Express (5000)" cmd /k "cd /d %~dp0backend && run_node_backend.bat"

echo [3/3] Khoi dong Frontend React Vite (Port 5173)...
start "NexusSocial - Frontend (5173)" cmd /k "cd /d %~dp0frontend && run_frontend.bat"

echo.
echo ================================================================
echo   [HE THONG] DANG KIEM TRA TRANG THAI SAN SANG (HEALTH CHECK)...
echo ================================================================

echo [*] Dang cho Backend FastAPI (8000) nap AI PhoBERT va ket noi CSDL...
set FASTAPI_TRIES=0
:WAIT_FASTAPI
curl -s http://127.0.0.1:8000/api/health >nul 2>&1
if %errorlevel% equ 0 goto FASTAPI_OK
set /a FASTAPI_TRIES+=1
if %FASTAPI_TRIES% gtr 35 (
    echo   -> [CANH BAO] FastAPI mat nhieu thoi gian hon binh thuong.
    goto WAIT_EXPRESS
)
timeout /t 1 /nobreak >nul
goto WAIT_FASTAPI

:FASTAPI_OK
echo   -> [OK] Backend FastAPI (Port 8000) da san sang!

echo [*] Dang kiem tra Backend Express Node.js (Port 5000)...
set EXPRESS_TRIES=0
:WAIT_EXPRESS
curl -s http://127.0.0.1:5000/api/health >nul 2>&1
if %errorlevel% equ 0 goto EXPRESS_OK
set /a EXPRESS_TRIES+=1
if %EXPRESS_TRIES% gtr 20 (
    echo   -> [CANH BAO] Express mat nhieu thoi gian hon binh thuong.
    goto FINISH_STARTUP
)
timeout /t 1 /nobreak >nul
goto WAIT_EXPRESS

:EXPRESS_OK
echo   -> [OK] Backend Express (Port 5000) da san sang!

:FINISH_STARTUP
echo.
echo ================================================================
echo   TAT CA DICH VU DA SAN SANG 100%! DANG MO TRINH DUYET...
echo   - Frontend:       http://localhost:5173
echo   - Backend FastAPI: http://localhost:8000
echo     + Swagger API:  http://localhost:8000/docs
echo   - Backend Express: http://localhost:5000
echo ================================================================
timeout /t 1 /nobreak >nul
start http://localhost:5173
pause