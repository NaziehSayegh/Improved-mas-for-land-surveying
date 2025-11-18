# PowerShell script to create icon from SVG
# This uses Chrome/Edge to render the SVG and capture it

Write-Host "🎨 Creating Icon for Parcel Tools..." -ForegroundColor Cyan
Write-Host ""

# Method 1: Try to use online API
$svgPath = Join-Path $PSScriptRoot "public\icon.svg"
$buildPath = Join-Path $PSScriptRoot "build"
$iconPath = Join-Path $buildPath "icon.ico"

if (!(Test-Path $buildPath)) {
    New-Item -Path $buildPath -ItemType Directory | Out-Null
}

Write-Host "Attempting to create icon..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Use CloudConvert API (requires internet)" -ForegroundColor Green
Write-Host "Option 2: Use online converter (manual)" -ForegroundColor Green
Write-Host ""

$choice = Read-Host "Enter 1 for automatic, 2 for manual, or Q to quit"

if ($choice -eq "2" -or $choice -eq "") {
    Write-Host ""
    Write-Host "Opening converter website..." -ForegroundColor Cyan
    Start-Process "https://convertio.co/svg-ico/"
    Write-Host ""
    Write-Host "📝 Instructions:" -ForegroundColor Yellow
    Write-Host "1. Upload: $svgPath"
    Write-Host "2. Convert to ICO (256x256)"
    Write-Host "3. Download and save as: $iconPath"
    Write-Host ""
    Read-Host "Press Enter when done"
    
    if (Test-Path $iconPath) {
        Write-Host "✅ Icon created successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Icon file not found. Please try again." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "Automatic conversion requires additional tools." -ForegroundColor Yellow
    Write-Host "Please use Option 2 (manual) for now." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

