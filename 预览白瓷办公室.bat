@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 goto use_py
python "tools\office-twin\porcelain\preview.py" %*
if errorlevel 1 pause
exit /b
:use_py
py -3 "tools\office-twin\porcelain\preview.py" %*
if errorlevel 1 pause
