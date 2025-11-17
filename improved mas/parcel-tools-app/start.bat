@echo off
echo ========================================
echo    PARCEL TOOLS - Desktop App
echo    Starting Application...
echo ========================================
echo.

echo [1/2] Starting Python Backend...
start "Python Backend" cmd /k "python backend/app.py"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Electron App...
npm run electron:dev

echo.
echo Application started successfully!
pause


