@echo off
echo ========================================
echo Parcel Tools - Rebuild with New Icons
echo ========================================
echo.

echo Step 1: Checking if icons exist...
if not exist "build\app-icon.ico" (
    echo Error: app-icon.ico not found!
    echo Please run: python create_app_and_file_icons.py
    pause
    exit /b 1
)

if not exist "build\file-icon.ico" (
    echo Error: file-icon.ico not found!
    echo Please run: python create_app_and_file_icons.py
    pause
    exit /b 1
)

echo [OK] Icons found!
echo.

echo Step 2: Installing dependencies (if needed)...
call npm install
if errorlevel 1 (
    echo Error: npm install failed
    pause
    exit /b 1
)
echo.

echo Step 3: Building React frontend...
call npm run build
if errorlevel 1 (
    echo Error: Frontend build failed
    pause
    exit /b 1
)
echo.

echo Step 4: Building Electron installer with new icons...
call npm run electron:build
if errorlevel 1 (
    echo Error: Electron build failed
    pause
    exit /b 1
)
echo.

echo ========================================
echo SUCCESS! Application rebuilt with new icons
echo ========================================
echo.
echo Your installer is ready in: dist-electron\
echo - Parcel Tools Setup 2.0.0.exe
echo - Parcel-Tools-Portable-2.0.0.zip
echo.
echo The new icons will appear:
echo 1. App Icon: On the application executable and shortcuts
echo 2. File Icon: On all .prcl project files
echo.
pause

