@echo off
title NexusSocial Node.js Backend (Port 5000)
set "PATH=C:\Program Files\nodejs;%PATH%"
echo =======================================================
echo KHOI DONG BACKEND NODE.JS EXPRESS - NEXUSSOCIAL (PORT 5000)
echo URL: http://localhost:5000
echo =======================================================
cd /d "%~dp0"
npm run dev
pause
