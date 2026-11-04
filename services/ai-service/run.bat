@echo off
cd /d "%~dp0..\.."
if exist backend\.venv\Scripts\python.exe (
  backend\.venv\Scripts\python.exe services\ai-service\main.py
) else (
  python services\ai-service\main.py
)
