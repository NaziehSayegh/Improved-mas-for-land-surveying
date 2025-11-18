@echo off
echo ============================================
echo  Creating Icon for Parcel Tools
echo ============================================
echo.
echo STEP 1: Opening icon converter website...
echo.
start https://convertio.co/svg-ico/
echo.
echo STEP 2: Do this on the website:
echo   1. Click "Choose Files"
echo   2. Select: public\icon.svg (from this folder)
echo   3. Click "Convert"
echo   4. Download the icon.ico file
echo.
echo STEP 3: Save the downloaded file as:
echo   build\icon.ico
echo.
echo STEP 4: Come back here and press any key...
pause
echo.
echo ============================================
echo  Now Creating Favicon for Website...
echo ============================================
echo.
echo Opening PNG converter...
start https://convertio.co/svg-png/
echo.
echo Do this:
echo   1. Upload the same icon.svg
echo   2. Convert to PNG
echo   3. Download and save as: favicon.png
echo      (in the main python folder)
echo.
pause
echo.
echo ============================================
echo Done! Now rebuild the app:
echo   npm run electron:build
echo ============================================
pause

