@echo off
echo ========================================
echo    PARCEL TOOLS - Installation
echo ========================================
echo.

echo [1/3] Installing Node.js dependencies...
call npm install

echo.
echo [2/3] Installing Python dependencies...
cd backend
call pip install -r requirements.txt
cd ..

echo.
echo [3/3] Setup complete!
echo.
echo ========================================
echo Installation finished successfully!
echo.
echo To start the app, run: start.bat
echo Or use: npm run electron:dev
echo ========================================
pause


