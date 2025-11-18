@echo off
echo ========================================
echo   Parcel Tools - Building Installer
echo ========================================
echo.

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Building frontend...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build frontend
    pause
    exit /b 1
)

echo.
echo [3/4] Copying backend files...
if not exist dist\backend mkdir dist\backend
xcopy /E /I /Y backend dist\backend
if errorlevel 1 (
    echo ERROR: Failed to copy backend
    pause
    exit /b 1
)

echo.
echo [4/4] Building Windows installer...
call npm run electron:build
if errorlevel 1 (
    echo ERROR: Failed to build installer
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.
echo Installer location:
dir /B dist-electron\*.exe 2>nul
if errorlevel 1 (
    echo No installer found in dist-electron folder
) else (
    echo.
    echo Full path:
    echo %CD%\dist-electron\
    echo.
    echo File size:
    for %%F in (dist-electron\*.exe) do echo %%~zF bytes (%%~nF)
)

echo.
echo Next steps:
echo 1. Test the installer in dist-electron\
echo 2. Upload to GitHub Releases or file hosting
echo 3. Update website download link
echo.
pause



