@echo off
echo ========================================
echo    BACKUP - Parcel Tools Project
echo ========================================
echo.

set BACKUP_NAME=parcel-tools-backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_NAME=%BACKUP_NAME: =0%

echo Creating backup: %BACKUP_NAME%.zip
echo.

echo [1/2] Creating backup folder...
mkdir "%BACKUP_NAME%" 2>nul

echo [2/2] Copying files...
xcopy "parcel-tools-app" "%BACKUP_NAME%\parcel-tools-app\" /E /I /H /Y /EXCLUDE:backup-exclude.txt
xcopy "parcel-tools-website" "%BACKUP_NAME%\parcel-tools-website\" /E /I /H /Y

echo.
echo ========================================
echo ✅ Backup Complete!
echo.
echo Saved to: %BACKUP_NAME%\
echo.
echo Files included:
echo   • Desktop app source code
echo   • Download website
echo   • All documentation
echo   • Configuration files
echo.
echo To restore: Just copy this folder back!
echo ========================================
pause



