$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Join-Path $ProjectRoot "desktop"

if (-not (Test-Path $DesktopDir)) {
    throw "desktop folder not found: $DesktopDir"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "RISEORA ERP WINDOWS INSTALLER BUILD" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $DesktopDir

Write-Host "[1/3] Installing/updating desktop build dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed."
}

Write-Host ""
Write-Host "[2/3] Building Riseora Windows installer..." -ForegroundColor Yellow
npm run build:win
if ($LASTEXITCODE -ne 0) {
    throw "Installer build failed."
}

$Installer = Join-Path $DesktopDir "release\Riseora-ERP-Setup-1.0.0.exe"

Write-Host ""
Write-Host "[3/3] Checking output..." -ForegroundColor Yellow

if (-not (Test-Path $Installer)) {
    throw "Build finished but installer was not found at: $Installer"
}

$Info = Get-Item $Installer

Write-Host ""
Write-Host "RESULT: PASS - Riseora ERP installer created." -ForegroundColor Green
Write-Host "Installer: $($Info.FullName)"
Write-Host "Size: $([math]::Round($Info.Length / 1MB, 2)) MB"
Write-Host ""
Write-Host "Before giving it to the owner, install it on a test Windows user/PC and verify login, purchase, production, sale, invoice PDF and backup." -ForegroundColor Cyan
