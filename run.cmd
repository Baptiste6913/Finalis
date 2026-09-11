@echo off
rem Finalis AI Prescreen: start the local server (Windows).
cd /d "%~dp0"
where python >nul 2>nul || (
  echo Python 3 is required. Install it from https://www.python.org/downloads/ and run this again.
  exit /b 1
)
python server.py %*
