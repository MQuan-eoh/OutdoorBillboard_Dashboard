# 🚀 OTA BUILD AND RELEASE SCRIPT - Enhanced Version
# Automatic build, version management, and GitHub release creation
# Usage: .\build-and-release.ps1 [-Version "1.0.4"] [-Publish] [-DryRun]

param(
    [string]$Version,
    [switch]$Publish,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 ITS Billboard OTA Build & Release Tool" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Read current version from package.json if not provided
if (-not $Version) {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $Version = $packageJson.version
    Write-Host "📋 Using current version from package.json: $Version" -ForegroundColor Cyan
} else {
    Write-Host "📋 Target version: $Version" -ForegroundColor Cyan
}

Write-Host "🔧 Options: Publish=$($Publish.IsPresent), DryRun=$($DryRun.IsPresent)" -ForegroundColor Cyan
Write-Host ""

# Step 1: Environment validation
Write-Host "1️⃣ Validating environment..." -ForegroundColor Yellow

if (!(Test-Path "package.json")) {
    throw "❌ package.json not found. Run this script from project root."
}

# Check for required tools
if (!(Get-Command "npm" -ErrorAction SilentlyContinue)) {
    throw "❌ npm not found. Install Node.js first."
}

if ($Publish -and !(Get-Command "git" -ErrorAction SilentlyContinue)) {
    throw "❌ git not found. Required for publishing."
}

Write-Host "✅ Environment validated" -ForegroundColor Green

# Step 2: Version management
Write-Host "2️⃣ Managing version..." -ForegroundColor Yellow

$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version

if ($Version -ne $currentVersion) {
    Write-Host "📝 Updating package.json: $currentVersion -> $Version" -ForegroundColor Cyan
    
    if (!$DryRun) {
        $packageJson.version = $Version
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
        Write-Host "✅ Version updated in package.json" -ForegroundColor Green
    } else {
        Write-Host "🔍 Would update package.json version" -ForegroundColor Gray
    }
    
    # Update latest.yml
    $latestYmlContent = @"
version: $Version
files:
  - url: https://github.com/MQuan-eoh/OutdoorBillboard_Dashboard/releases/download/v$Version/ITS-Billboard-Setup-$Version.exe
    sha512: PLACEHOLDER_SHA512_HASH_WILL_BE_UPDATED_AFTER_BUILD
    size: 0
path: ITS-Billboard-Setup-$Version.exe
sha512: PLACEHOLDER_SHA512_HASH_WILL_BE_UPDATED_AFTER_BUILD
releaseDate: "$((Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"))"
"@
    
    if (!$DryRun) {
        Set-Content "latest.yml" -Value $latestYmlContent
        Write-Host "✅ Updated latest.yml for v$Version" -ForegroundColor Green
    } else {
        Write-Host "🔍 Would update latest.yml" -ForegroundColor Gray
    }
}

# Step 3: Kill running processes
Write-Host "3️⃣ Stopping running processes..." -ForegroundColor Yellow
if (!$DryRun) {
    taskkill /f /im electron.exe 2>$null
    taskkill /f /im ITS-Billboard.exe 2>$null
    Start-Sleep -Seconds 2
    Write-Host "✅ Processes stopped" -ForegroundColor Green
} else {
    Write-Host "🔍 Would stop running processes" -ForegroundColor Gray
}

# Step 4: Clean build directory
Write-Host "4️⃣ Cleaning build directory..." -ForegroundColor Yellow
if (!$DryRun) {
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    Write-Host "✅ Build directory cleaned" -ForegroundColor Green
} else {
    Write-Host "🔍 Would clean dist directory" -ForegroundColor Gray
}

# Step 5: Build renderer
Write-Host "5️⃣ Building renderer..." -ForegroundColor Yellow
if (!$DryRun) {
    npm run build:renderer
    if ($LASTEXITCODE -ne 0) {
        throw "❌ Renderer build failed"
    }
    Write-Host "✅ Renderer build completed" -ForegroundColor Green
} else {
    Write-Host "🔍 Would run: npm run build:renderer" -ForegroundColor Gray
}

# Step 6: Build Electron app
Write-Host "6️⃣ Building Electron app..." -ForegroundColor Yellow
if (!$DryRun) {
    try {
        npm run build:nsis
        Write-Host "✅ NSIS installer build successful!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ NSIS build failed, trying portable..." -ForegroundColor Yellow
        npm run build:win
        Write-Host "✅ Portable build completed!" -ForegroundColor Green
    }
} else {
    Write-Host "🔍 Would run: npm run build:nsis" -ForegroundColor Gray
}

# Step 7: Verify artifacts
Write-Host "7️⃣ Verifying build artifacts..." -ForegroundColor Yellow

$expectedSetup = "dist\ITS-Billboard-Setup-$Version.exe"
$expectedPortable = "dist\ITS-Billboard-Portable-$Version.exe"
$expectedLatestYml = "dist\latest.yml"

if (!$DryRun) {
    if (Test-Path "dist") {
        Write-Host "📦 Build artifacts:" -ForegroundColor Cyan
        Get-ChildItem "dist" -Filter "*.exe" | ForEach-Object {
            $size = [math]::Round($_.Length / 1MB, 1)
            Write-Host "   ✅ $($_.Name) ($size MB)" -ForegroundColor Green
        }
        
        Get-ChildItem "dist" -Filter "*.yml" | ForEach-Object {
            Write-Host "   ✅ $($_.Name)" -ForegroundColor Green
        }
        
        if (!(Test-Path $expectedSetup)) {
            Write-Host "⚠️ Expected setup artifact not found: $expectedSetup" -ForegroundColor Yellow
        }
    } else {
        throw "❌ No build output found in dist/"
    }
} else {
    Write-Host "🔍 Would verify: $expectedSetup, $expectedPortable, $expectedLatestYml" -ForegroundColor Gray
}

# Step 8: Git operations (if publishing)
if ($Publish) {
    Write-Host "8️⃣ Git operations..." -ForegroundColor Yellow
    
    if (!$DryRun) {
        # Stage version files
        git add package.json latest.yml
        git commit -m "chore: bump version to $Version for OTA release"
        
        # Create tag
        git tag -a "v$Version" -m "Release v$Version - OTA Update"
        
        # Push to remote
        git push origin main
        git push origin "v$Version"
        
        Write-Host "✅ Git tag v$Version created and pushed" -ForegroundColor Green
    } else {
        Write-Host "🔍 Would create git commit and tag v$Version" -ForegroundColor Gray
    }
}

# Step 9: GitHub release (if publishing)
if ($Publish) {
    Write-Host "9️⃣ Creating GitHub release..." -ForegroundColor Yellow
    
    if (!$DryRun) {
        Write-Host "📤 Publishing release with electron-builder..." -ForegroundColor Cyan
        npm run publish-release
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ GitHub release published!" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Auto-publish may have failed. Manual release may be needed." -ForegroundColor Yellow
        }
    } else {
        Write-Host "🔍 Would create GitHub release" -ForegroundColor Gray
    }
}

# Step 10: Run verification
Write-Host "🔟 Running OTA verification..." -ForegroundColor Yellow
if (!$DryRun) {
    if (Test-Path "ota-verify-comprehensive.js") {
        node ota-verify-comprehensive.js
    } else {
        Write-Host "⚠️ OTA verification script not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "🔍 Would run OTA verification" -ForegroundColor Gray
}

# Final Summary
Write-Host ""
Write-Host "🎉 BUILD SUMMARY" -ForegroundColor Green
Write-Host "===============" -ForegroundColor Green
Write-Host "Version: $Version" -ForegroundColor Cyan
Write-Host "Published: $($Publish.IsPresent)" -ForegroundColor Cyan
Write-Host "Dry Run: $($DryRun.IsPresent)" -ForegroundColor Cyan

if (!$DryRun) {
    Write-Host ""
    Write-Host "📁 Build Output:" -ForegroundColor Yellow
    if (Test-Path "dist") {
        Get-ChildItem "dist" -Name | ForEach-Object {
            Write-Host "   $($_)" -ForegroundColor White
        }
    }
}

if ($Publish -and !$DryRun) {
    Write-Host ""
    Write-Host "🔗 GitHub Release: https://github.com/MQuan-eoh/OutdoorBillboard_Dashboard/releases/tag/v$Version" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Test OTA update from admin-web" -ForegroundColor White
    Write-Host "2. Verify on production devices" -ForegroundColor White
    Write-Host "3. Monitor for issues" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Manual Release Instructions:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/MQuan-eoh/OutdoorBillboard_Dashboard/releases" -ForegroundColor Cyan
    Write-Host "2. Create new release with tag: v$Version" -ForegroundColor Cyan
    Write-Host "3. Upload build artifacts from dist/ folder" -ForegroundColor Cyan
    Write-Host "4. Test OTA update functionality" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "✅ Build process completed!" -ForegroundColor Green