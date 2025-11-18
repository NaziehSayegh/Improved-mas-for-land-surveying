# Parcel Tools - Create Installer Package
# This script creates a self-installing archive

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Creating Parcel Tools Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Administrator privileges required for creating installer." -ForegroundColor Yellow
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit
}

# Create installer using IExpress
$sourcePath = "improved mas\parcel-tools-app\dist-electron\win-unpacked"

if (Test-Path $sourcePath) {
    Write-Host "✓ Found application files" -ForegroundColor Green
    
    # Create a simple ZIP-based installer
    Write-Host "Creating installer package..." -ForegroundColor Cyan
    
    $installerZip = "Parcel-Tools-Setup-2.0.0.zip"
    
    if (Test-Path $installerZip) {
        Remove-Item $installerZip -Force
    }
    
    Compress-Archive -Path "$sourcePath\*" -DestinationPath $installerZip -CompressionLevel Optimal
    
    Write-Host "✓ Installer created: $installerZip" -ForegroundColor Green
    Write-Host ""
    Write-Host "File size: $([math]::Round((Get-Item $installerZip).Length / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Upload this file to GitHub Releases" -ForegroundColor White
    Write-Host "2. Users download and extract the ZIP" -ForegroundColor White
    Write-Host "3. Run 'Parcel Tools.exe' from the extracted folder" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✗ Application files not found at: $sourcePath" -ForegroundColor Red
    Write-Host "Please build the application first." -ForegroundColor Yellow
}

pause

