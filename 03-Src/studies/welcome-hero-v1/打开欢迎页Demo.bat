@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-demo.ps1"
if errorlevel 1 pause
