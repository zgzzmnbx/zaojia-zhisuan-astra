@echo off
setlocal
set "ASTRA_DEMO_PYTHON=%~dp0..\..\..\runtime\astra-service\.venv\Scripts\python.exe"
"%ASTRA_DEMO_PYTHON%" -B -X utf8 "%~dp0serve.py" --open
if errorlevel 1 pause
