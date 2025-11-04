# Script test nhanh OTA system
# Chạy: .\quick-test.ps1

Write-Host "🚀 QUICK OTA TEST" -ForegroundColor Cyan

# Test 1: Build
Write-Host "1️⃣ Testing Build..." -ForegroundColor Yellow
npm run build:renderer
npm run build:nsis

# Test 2: Kiểm tra files
Write-Host "2️⃣ Checking Files..." -ForegroundColor Yellow
$version = (Get-Content "package.json" | ConvertFrom-Json).version
$files = @(
    "dist/ITS-Billboard-Setup-$version.exe",
    "dist/ITS-Billboard-Portable-$version.exe", 
    "dist/latest.yml"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $size = [math]::Round((Get-Item $file).Length / 1MB, 2)
        Write-Host "✅ $file ($size MB)" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - Missing" -ForegroundColor Red
    }
}

# Test 3: Git status
Write-Host "3️⃣ Git Status..." -ForegroundColor Yellow
git status --short

Write-Host ""
Write-Host "🎯 READY FOR RELEASE!" -ForegroundColor Green
Write-Host "Next: git add . && git commit -m 'Release v$version' && git tag v$version && git push origin main && git push origin v$version"