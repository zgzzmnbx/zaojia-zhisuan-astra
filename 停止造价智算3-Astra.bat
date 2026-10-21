@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\stop-preview.ps1" %*
if errorlevel 1 (
  echo.
  echo Astra did not stop. Please keep this error message for troubleshooting.
  pause
  exit /b 1
)
endlocal
