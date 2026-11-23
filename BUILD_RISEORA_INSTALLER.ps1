$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Join-Path $ProjectRoot "desktop"
$VersionScript = Join-Path $ProjectRoot "scripts/version.mjs"

Write-Host "RISEORA ERP WINDOWS INSTALLER BUILD" -ForegroundColor Cyan

Write-Host "[1/4] Synchronizing and validating application version..." -ForegroundColor Yellow
node $VersionScript
if ($LASTEXITCODE -ne 0) { throw "Version synchronization failed." }
node $VersionScript --check
if ($LASTEXITCODE -ne 0) { throw "Version consistency check failed." }
$Version = node $VersionScript --print
if ($LASTEXITCODE -ne 0) { throw "Unable to read application version." }
$Installer = Join-Path $DesktopDir "release\Riseora-ERP-Setup-$Version.exe"

Write-Host "[2/4] Installing locked build dependencies..." -ForegroundColor Yellow
foreach ($Package in @("client", "desktop")) {
    Push-Location (Join-Path $ProjectRoot $Package)
    try {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed for $Package." }
    } finally { Pop-Location }
}

Write-Host "[3/4] Building Riseora $Version Windows installer..." -ForegroundColor Yellow
$BuildStarted = [DateTime]::UtcNow
Push-Location $DesktopDir
try {
    npm.cmd run build:win
    if ($LASTEXITCODE -ne 0) { throw "Installer build failed." }
} finally { Pop-Location }

Write-Host "[4/4] Checking output..." -ForegroundColor Yellow
node $VersionScript --verify-installer $Installer
if ($LASTEXITCODE -ne 0) { throw "Installer version verification failed." }
$Info = Get-Item -LiteralPath $Installer
if ($Info.LastWriteTimeUtc -lt $BuildStarted) { throw "Installer was not produced by this build: $Installer" }

Write-Host "RESULT: PASS - Riseora ERP $Version installer created." -ForegroundColor Green
Write-Host "Installer: $($Info.FullName)"
Write-Host "Size: $([math]::Round($Info.Length / 1MB, 2)) MB"
Get-FileHash -LiteralPath $Installer -Algorithm SHA256 | Format-List
Write-Host "Before giving it to the owner, install it on a test Windows user/PC and verify login, purchase, production, sale, invoice PDF and backup." -ForegroundColor Cyan
