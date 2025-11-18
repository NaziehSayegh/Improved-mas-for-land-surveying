@echo off
echo ============================================
echo Parcel Tools - Debug Mode (With Console Logs)
echo ============================================
echo.
echo This will run Parcel Tools in debug mode so you can see
echo what's happening when you try to save.
echo.
echo Press Ctrl+C to exit when done.
echo.
pause

cd "improved mas\parcel-tools-app\dist-electron\win-unpacked"
"Parcel Tools.exe"

pause

