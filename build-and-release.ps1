# 🚀 BUILD AND RELEASE SCRIPT
# Automatic build and GitHub release creation

Write-Host "🚀 ITS Billboard - Build & Release Script" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Step 1: Kill running processes
Write-Host "1️⃣ Stopping running processes..." -ForegroundColor Yellow
taskkill /f /im electron.exe 2>$null
taskkill /f /im ITS-Billboard.exe 2>$null
Start-Sleep -Seconds 2

# Step 2: Clean build directory
Write-Host "2️⃣ Cleaning build directory..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Step 3: Build renderer
Write-Host "3️⃣ Building renderer..." -ForegroundColor Yellow
npm run build:renderer

# Step 4: Build installer
Write-Host "4️⃣ Building NSIS installer..." -ForegroundColor Yellow
try {
    npm run build:nsis
    Write-Host "✅ NSIS build successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ NSIS build failed, trying portable build..." -ForegroundColor Red
    npm run build:win
    Write-Host "✅ Portable build completed!" -ForegroundColor Green
}

# Step 5: Check build output
Write-Host "5️⃣ Checking build output..." -ForegroundColor Yellow
$distPath = "dist"
if (Test-Path $distPath) {
    Get-ChildItem $distPath -Recurse -Name | Where-Object { $_ -like "*.exe" -or $_ -like "*.yml" }
    Write-Host "📦 Build files ready!" -ForegroundColor Green
} else {
    Write-Host "❌ No build output found!" -ForegroundColor Red
    exit 1
}

# Step 6: Instructions for GitHub Release
Write-Host "`n6️⃣ GitHub Release Instructions:" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow
Write-Host "1. Go to: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases" -ForegroundColor Cyan
Write-Host "2. Click 'Create a new release'" -ForegroundColor Cyan
Write-Host "3. Use tag: v1.0.0" -ForegroundColor Cyan
Write-Host "4. Upload these files from dist/ folder:" -ForegroundColor Cyan
Write-Host "   - ITS-Billboard-Setup-1.0.0.exe (main installer)" -ForegroundColor White
Write-Host "   - latest.yml (update metadata)" -ForegroundColor White
Write-Host "   - latest-mac.yml (if exists)" -ForegroundColor White
Write-Host "5. Click 'Publish release'" -ForegroundColor Cyan

Write-Host "`n✅ Build completed! Ready for GitHub Release!" -ForegroundColor Green