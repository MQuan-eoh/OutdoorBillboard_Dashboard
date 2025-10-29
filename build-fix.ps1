# Build fix script - handles file locking issues with Windows Defender

param(
    [switch]$BuildPortable
)

function Clean-BuildDirectory {
    Write-Host "🧹 Cleaning build directories..." -ForegroundColor Cyan
    
    # Kill any node/electron processes
    taskkill /F /IM electron.exe 2>$null | Out-Null
    taskkill /F /IM node.exe 2>$null | Out-Null
    
    Start-Sleep -Milliseconds 500
    
    # Remove dist directory with retries
    $maxRetries = 5
    $retryCount = 0
    
    while ((Test-Path -Path "dist") -and $retryCount -lt $maxRetries) {
        try {
            Remove-Item -Recurse -Force "dist" -ErrorAction Stop
            Write-Host "✓ dist directory removed" -ForegroundColor Green
            break
        } catch {
            $retryCount++
            Write-Host "⚠️  Retry $retryCount/$maxRetries..." -ForegroundColor Yellow
            Start-Sleep -Milliseconds 500
        }
    }
    
    if (Test-Path -Path "dist") {
        Write-Host "⚠️  Warning: dist directory still exists, proceeding anyway..." -ForegroundColor Yellow
    }
}

function Build-Application {
    Write-Host "`n🔨 Building application..." -ForegroundColor Cyan
    
    $buildCmd = if ($BuildPortable) {
        "npm run build:portable"
    } else {
        "npm run build:win"
    }
    
    # Set environment variables to help with build
    $env:SKIP_NOTARIZE = "true"
    $env:WIN_CSC_LINK = ""
    
    # Run build with retry logic
    $maxRetries = 2
    $retryCount = 0
    
    while ($retryCount -lt $maxRetries) {
        try {
            Invoke-Expression $buildCmd
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`n✓ Build completed successfully!" -ForegroundColor Green
                return $true
            } else {
                $retryCount++
                if ($retryCount -lt $maxRetries) {
                    Write-Host "`n⚠️  Build failed, retrying in 3 seconds... (Attempt $($retryCount+1)/$maxRetries)" -ForegroundColor Yellow
                    Start-Sleep -Seconds 3
                    Clean-BuildDirectory
                } else {
                    Write-Host "`n✗ Build failed after $maxRetries attempts" -ForegroundColor Red
                    return $false
                }
            }
        } catch {
            Write-Host "Error during build: $_" -ForegroundColor Red
            $retryCount++
        }
    }
    
    return $false
}

# Main execution
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ITS Outdoor Billboard Build Script    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan

Clean-BuildDirectory
$success = Build-Application

if ($success) {
    Write-Host "`n✓ Build process completed!" -ForegroundColor Green
    Write-Host "Executable location: ./dist/" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "`n✗ Build process failed!" -ForegroundColor Red
    Write-Host "`nTroubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Disable Windows Defender real-time protection temporarily"
    Write-Host "2. Exclude 'dist' folder from Windows Defender scans"
    Write-Host "3. Try running: npm install --force"
    Write-Host "4. Close any file explorer windows showing the dist folder"
    exit 1
}
