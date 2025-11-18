# Parcel Tools - Build Installer (Run as Administrator)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Parcel Tools - Building Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script requires Administrator privileges." -ForegroundColor Yellow
    Write-Host "Requesting elevation..." -ForegroundColor Cyan
    
    # Relaunch as administrator
    Start-Process PowerShell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Navigate to the app directory
Set-Location -Path $PSScriptRoot

# Run the build
Write-Host "Starting build process..." -ForegroundColor Cyan
npm run electron:build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # Find the installer
    $installer = Get-ChildItem -Path "dist-electron" -Filter "*.exe" -Recurse | Select-Object -First 1
    
    if ($installer) {
        Write-Host "Installer created: $($installer.FullName)" -ForegroundColor Green
        Write-Host "Size: $([math]::Round($installer.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    }
} else {
    Write-Host ""
    Write-Host "Build failed. Please check the errors above." -ForegroundColor Red
}

Write-Host ""
pause

