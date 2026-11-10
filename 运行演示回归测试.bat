@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "runtime\astra-service\.venv\Scripts\python.exe" (
  echo 正式 Python 环境不存在，请先核对本项目的运行目录。
  pause
  exit /b 1
)
"runtime\astra-service\.venv\Scripts\python.exe" "tools\demo-regression\run.py" --open
set "REGRESSION_EXIT=%ERRORLEVEL%"
echo.
if "%REGRESSION_EXIT%"=="0" echo 全部验收通过。
if "%REGRESSION_EXIT%"=="1" echo 发现失败或运行异常，请查看本轮报告。
if "%REGRESSION_EXIT%"=="2" echo 自动流程结束，仍有未完成的验收项，请查看本轮报告。
pause
exit /b %REGRESSION_EXIT%
