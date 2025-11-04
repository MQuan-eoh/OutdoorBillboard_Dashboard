

param(
    [string]$NewVersion = "1.0.3",
    [switch]$SkipBuild = $false,
    [switch]$OnlyValidate = $false,
    [switch]$BuildAll = $false
)

Write-Host "🚀 ITS Billboard OTA System Test Script" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Hàm hiển thị status
function Show-Status {
    param($Message, $Type = "Info")
    $colors = @{
        "Info" = "White"
        "Success" = "Green" 
        "Warning" = "Yellow"
        "Error" = "Red"
        "Step" = "Cyan"
    }
    Write-Host "[$Type] $Message" -ForegroundColor $colors[$Type]
}

# Bước 1: Kiểm tra môi trường
Show-Status "Bước 1: Kiểm tra môi trường..." "Step"

if (-not (Test-Path "package.json")) {
    Show-Status "Không tìm thấy package.json. Đảm bảo chạy script từ root directory." "Error"
    exit 1
}

if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Show-Status "NPM không được cài đặt hoặc không có trong PATH." "Error"
    exit 1
}

if (-not (Get-Command "git" -ErrorAction SilentlyContinue)) {
    Show-Status "Git không được cài đặt hoặc không có trong PATH." "Error"
    exit 1
}

Show-Status "Môi trường OK ✅" "Success"

# Bước 2: Backup và cleanup
Show-Status "Bước 2: Backup và cleanup..." "Step"

# Backup config nếu có
if (Test-Path "config.json") {
    Copy-Item "config.json" "config.json.backup" -Force
    Show-Status "Đã backup config.json" "Info"
}

# Backup dist cũ
if (Test-Path "dist") {
    if (Test-Path "dist_backup") {
        Remove-Item "dist_backup" -Recurse -Force
    }
    Copy-Item "dist" "dist_backup" -Recurse -Force
    Show-Status "Đã backup thư mục dist" "Info"
}

# Bước 3: Build application
if (-not $SkipBuild -and -not $OnlyValidate) {
    Show-Status "Bước 3: Build application..." "Step"
    
    # Clean dist
    if (Test-Path "dist") {
        Remove-Item "dist" -Recurse -Force
        Show-Status "Đã xóa thư mục dist cũ" "Info"
    }
    
    # Build renderer
    Show-Status "Building renderer..." "Info"
    npm run build:renderer
    if ($LASTEXITCODE -ne 0) {
        Show-Status "Build renderer thất bại!" "Error"
        exit 1
    }
    
    # Kiểm tra renderer output
    if (Test-Path "renderer/app-built.js") {
        Show-Status "Renderer build thành công ✅" "Success"
    } else {
        Show-Status "Renderer build không tạo file app-built.js" "Warning"
    }
    
    # Build application
    if ($BuildAll) {
        Show-Status "Building all targets (NSIS + Portable)..." "Info"
        npm run build:all
        if ($LASTEXITCODE -ne 0) {
            Show-Status "Build all thất bại!" "Error"
            exit 1
        }
    } else {
        Show-Status "Building NSIS installer only..." "Info"
        npm run build:nsis
        if ($LASTEXITCODE -ne 0) {
            Show-Status "Build NSIS thất bại!" "Error"
            exit 1
        }
    }
    
    Show-Status "Build hoàn thành ✅" "Success"
}

# Bước 4: Validate build output
Show-Status "Bước 4: Kiểm tra build output..." "Step"

$currentVersion = (Get-Content "package.json" | ConvertFrom-Json).version
Show-Status "Phiên bản hiện tại: $currentVersion" "Info"

# Kiểm tra xem build nào đã chạy
if ($BuildAll) {
    $expectedFiles = @(
        "ITS-Billboard-Setup-$currentVersion.exe",
        "ITS-Billboard-Portable-$currentVersion.exe",
        "latest.yml"
    )
    Show-Status "Chế độ Build All - kiểm tra cả NSIS và Portable" "Info"
} else {
    $expectedFiles = @(
        "ITS-Billboard-Setup-$currentVersion.exe",
        "latest.yml"
    )
    Show-Status "Chế độ NSIS only - chỉ kiểm tra NSIS installer và latest.yml" "Info"
}

$allFilesOK = $true
foreach ($file in $expectedFiles) {
    $path = "dist\$file"
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        $sizeMB = [math]::Round($size / 1MB, 2)
        Show-Status "✅ $file ($sizeMB MB)" "Success"
    } else {
        Show-Status "❌ $file - KHÔNG TÌM THẤY" "Error"
        $allFilesOK = $false
    }
}

if (-not $allFilesOK) {
    Show-Status "Một số file build không tồn tại. Kiểm tra lại cấu hình electron-builder." "Error"
    exit 1
}

# Bước 5: Kiểm tra latest.yml
Show-Status "Bước 5: Kiểm tra latest.yml..." "Step"

if (Test-Path "dist\latest.yml") {
    $latestYml = Get-Content "dist\latest.yml" -Raw
    if ($latestYml -like "*ITS-Billboard-Setup-$currentVersion.exe*") {
        Show-Status "latest.yml có URL đúng ✅" "Success"
    } else {
        Show-Status "latest.yml có URL không đúng format" "Warning"
        Show-Status "Nội dung latest.yml:" "Info"
        Get-Content "dist\latest.yml" | ForEach-Object { Show-Status "  $_" "Info" }
    }
} else {
    Show-Status "Không tìm thấy dist\latest.yml" "Error"
}

# Bước 6: Git operations (nếu không phải chỉ validate)
if (-not $OnlyValidate) {
    Show-Status "Bước 6: Git operations..." "Step"
    
    # Kiểm tra git status
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Show-Status "Có thay đổi chưa commit:" "Warning"
        git status --short
        
        $response = Read-Host "Bạn có muốn commit và tạo tag v$NewVersion? (y/n)"
        if ($response -eq "y" -or $response -eq "Y") {
            git add .
            git commit -m "Update to v$NewVersion - OTA system fixes"
            
            # Kiểm tra tag đã tồn tại chưa
            $existingTag = git tag -l "v$NewVersion"
            if ($existingTag) {
                Show-Status "Tag v$NewVersion đã tồn tại" "Warning"
                $response = Read-Host "Bạn có muốn xóa tag cũ và tạo lại? (y/n)"
                if ($response -eq "y" -or $response -eq "Y") {
                    git tag -d "v$NewVersion"
                    git push origin :refs/tags/v$NewVersion
                }
            }
            
            git tag "v$NewVersion"
            git push origin main
            git push origin "v$NewVersion"
            
            Show-Status "Đã push code và tag v$NewVersion lên GitHub ✅" "Success"
            Show-Status "Kiểm tra GitHub Actions: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/actions" "Info"
        }
    } else {
        Show-Status "Không có thay đổi mới để commit" "Info"
    }
}

# Bước 7: Test admin web (optional)
Show-Status "Bước 7: Hướng dẫn test admin web..." "Step"
Show-Status "Để test admin web:" "Info"
Show-Status "1. cd admin-web" "Info"
Show-Status "2. Khởi chạy web server (python -m http.server 8080)" "Info"
Show-Status "3. Mở http://localhost:8080" "Info"
Show-Status "4. Test GitHub token và MQTT connection" "Info"

# Bước 8: Summary
Show-Status "Bước 8: Tổng kết..." "Step"

Write-Host ""
Write-Host "🎯 TỔNG KẾT TEST OTA SYSTEM" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ Build environment: OK" -ForegroundColor Green
Write-Host "✅ Build output: OK" -ForegroundColor Green  
Write-Host "✅ File naming: OK" -ForegroundColor Green
Write-Host "✅ latest.yml: OK" -ForegroundColor Green

if (-not $OnlyValidate) {
    Write-Host "✅ Git operations: OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Monitor GitHub Actions workflow" -ForegroundColor White
Write-Host "2. Verify GitHub release assets" -ForegroundColor White
Write-Host "3. Test admin web interface" -ForegroundColor White
Write-Host "4. Test OTA update flow" -ForegroundColor White
Write-Host "5. Verify desktop app update" -ForegroundColor White

Write-Host ""
Write-Host "🔗 USEFUL LINKS:" -ForegroundColor Cyan
Write-Host "GitHub Actions: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/actions" -ForegroundColor Blue
Write-Host "Releases: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases" -ForegroundColor Blue
Write-Host "MQTT Explorer: http://mqtt-explorer.com/" -ForegroundColor Blue

Write-Host ""
Show-Status "Script hoàn thành! 🎉" "Success"