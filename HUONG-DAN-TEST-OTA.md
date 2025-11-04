# Hướng Dẫn Test Hệ Thống OTA Update - Tiếng Việt

## Bước 1: Chuẩn Bị Môi Trường Test

### 1.1 Kiểm Tra Cấu Hình Hiện Tại

```powershell
# Kiểm tra version hiện tại trong package.json
Get-Content package.json | Select-String '"version"'

# Kiểm tra các file trong thư mục dist
Get-ChildItem dist -Name
```

### 1.2 Backup Cấu Hình Quan Trọng

```powershell
# Backup file config.json (nếu có)
Copy-Item config.json config.json.backup -ErrorAction SilentlyContinue

# Backup thư mục dist hiện tại
Copy-Item dist dist_backup -Recurse -ErrorAction SilentlyContinue
```

## Bước 2: Test Build Local

### 2.1 Clean Build Environment

```powershell
# Xóa thư mục dist cũ
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue

# Xóa node_modules cache (nếu cần)
# Remove-Item node_modules -Recurse -Force
# npm install
```

### 2.2 Build Renderer và Application

```powershell
# Build renderer trước
npm run build:renderer

# Kiểm tra kết quả build renderer
Write-Host "=== Kiểm tra Renderer Build ===" -ForegroundColor Green
Test-Path "renderer/app-built.js"

# Build NSIS installer
npm run build:nsis

# Kiểm tra kết quả build
Write-Host "=== Kiểm tra Build Output ===" -ForegroundColor Green
Get-ChildItem dist -Name | Where-Object { $_ -like "*.exe" -or $_ -like "*.yml" }
```

### 2.3 Kiểm Tra Tên File Đúng Định Dạng

```powershell
# Kiểm tra các file được tạo có đúng tên không
$expectedFiles = @(
    "ITS-Billboard-Setup-1.0.2.exe",
    "ITS-Billboard-Portable-1.0.2.exe",
    "latest.yml"
)

Write-Host "=== Kiểm Tra File Names ===" -ForegroundColor Yellow
foreach ($file in $expectedFiles) {
    if (Test-Path "dist\$file") {
        Write-Host "✅ $file - OK" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - KHÔNG TÌM THẤY" -ForegroundColor Red
    }
}
```

## Bước 3: Test GitHub Release Workflow

### 3.1 Chuẩn Bị Release Mới

```powershell
# Tăng version trong package.json (thủ công hoặc dùng npm)
# Ví dụ: từ 1.0.2 -> 1.0.3

# Kiểm tra git status
git status

# Add và commit changes
git add .
git commit -m "Fix OTA system and update to v1.0.3"
```

### 3.2 Tạo Tag và Push

```powershell
# Tạo tag mới
git tag v1.0.3

# Push code và tag lên GitHub
git push origin main
git push origin v1.0.3

Write-Host "🚀 Tag v1.0.3 đã được push lên GitHub" -ForegroundColor Green
Write-Host "Kiểm tra GitHub Actions tại: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/actions" -ForegroundColor Yellow
```

### 3.3 Monitor GitHub Actions

1. Mở trình duyệt và đi tới: `https://github.com/MinhQuan7/ITS_OurdoorBillboard-/actions`
2. Tìm workflow `Build & Release` đang chạy
3. Click vào workflow để xem chi tiết
4. Kiểm tra từng bước:
   - ✅ Set up job
   - ✅ Checkout repository
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Build renderer
   - ✅ Build application
   - ✅ List build output for debugging
   - ✅ Upload to GitHub Release

### 3.4 Kiểm Tra Release Page

```powershell
# Mở Release page để kiểm tra
Start-Process "https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases"
```

Kiểm tra xem release mới có:

- ✅ File `ITS-Billboard-Setup-1.0.3.exe`
- ✅ File `ITS-Billboard-Portable-1.0.3.exe`
- ✅ File `latest.yml`

## Bước 4: Test Admin Web Interface

### 4.1 Khởi Chạy Admin Web

```powershell
# Chuyển đến thư mục admin-web
Set-Location "admin-web"

# Khởi chạy web server (nếu có script)
# python -m http.server 8080
# hoặc
# npx serve . -p 8080

# Mở admin web trong browser
Start-Process "http://localhost:8080"
```

### 4.2 Test GitHub Token

1. Trong admin web, tìm phần "GitHub Configuration"
2. Nhập GitHub Personal Access Token
3. Kiểm tra kết nối với repository
4. Verify repository access: `MinhQuan7/ITS_OurdoorBillboard-`

### 4.3 Test MQTT Connection

1. Trong admin web, kiểm tra MQTT status
2. Verify connection tới HiveMQ broker
3. Test publish/subscribe các topics:
   - `its/billboard/commands`
   - `its/billboard/update/status`

## Bước 5: Test Desktop Application

### 5.1 Cài Đặt Phiên Bản Cũ

```powershell
# Cài đặt phiên bản cũ từ dist_backup hoặc từ GitHub release cũ
$oldVersion = "dist_backup\ITS-Billboard-Setup-1.0.2.exe"
if (Test-Path $oldVersion) {
    Write-Host "Cài đặt phiên bản cũ để test update..." -ForegroundColor Yellow
    Start-Process $oldVersion -Wait
}
```

### 5.2 Kiểm Tra Desktop App

```powershell
# Chạy desktop app
Start-Process "C:\Program Files\ITS Billboard\ITS Billboard.exe" -ErrorAction SilentlyContinue

Write-Host "=== Hướng dẫn kiểm tra Desktop App ===" -ForegroundColor Cyan
Write-Host "1. App khởi chạy với kích thước 384x384px"
Write-Host "2. Nhấn F1 để mở Config mode"
Write-Host "3. Kiểm tra MQTT connection status"
Write-Host "4. Kiểm tra Era IoT data (nếu có cấu hình)"
```

### 5.3 Test MQTT Communication

Trong Config mode của desktop app:

1. Kiểm tra MQTT connection status
2. Verify topic subscriptions
3. Test nhận commands từ admin-web

## Bước 6: Test OTA Update Flow

### 6.1 Trigger Update Từ Admin Web

1. Trong admin web, tìm phần "OTA Update"
2. Nhập version mới: `1.0.3`
3. Click "Force Update"
4. Monitor status messages

### 6.2 Monitor Desktop App

Quan sát desktop app console logs để thấy:

```
[OTA] Force update initiated
[OTA] Calling autoUpdater.downloadUpdate()
AutoUpdater: Download progress: ...
AutoUpdater: Update downloaded: 1.0.3
```

### 6.3 Verify Update Success

```powershell
# Kiểm tra version sau khi update
$appPath = "C:\Program Files\ITS Billboard\ITS Billboard.exe"
if (Test-Path $appPath) {
    $version = (Get-ItemProperty $appPath).VersionInfo.FileVersion
    Write-Host "Current app version: $version" -ForegroundColor Green
}
```

## Bước 7: Test Scenarios & Troubleshooting

### 7.1 Test Cases Chính

```powershell
Write-Host "=== Test Scenarios ===" -ForegroundColor Magenta
Write-Host "✅ Scenario 1: Build local thành công"
Write-Host "✅ Scenario 2: GitHub release upload thành công"
Write-Host "✅ Scenario 3: Admin web connect GitHub thành công"
Write-Host "✅ Scenario 4: MQTT communication hoạt động"
Write-Host "✅ Scenario 5: OTA update download thành công"
Write-Host "✅ Scenario 6: App restart và verify version mới"
```

### 7.2 Common Issues & Solutions

```powershell
Write-Host "=== Troubleshooting Guide ===" -ForegroundColor Red
Write-Host "❌ Lỗi 'Resource not accessible': Check GitHub token permissions"
Write-Host "❌ Lỗi 'Pattern not match': Check file naming trong workflow"
Write-Host "❌ Lỗi 'MQTT not connected': Check HiveMQ broker status"
Write-Host "❌ Lỗi 'Download failed': Check latest.yml file URLs"
Write-Host "❌ Lỗi 'Update not found': Check version matching"
```

### 7.3 Debug Commands

```powershell
# Kiểm tra GitHub API response
$headers = @{ "Authorization" = "token YOUR_GITHUB_TOKEN" }
$response = Invoke-RestMethod -Uri "https://api.github.com/repos/MinhQuan7/ITS_OurdoorBillboard-/releases/latest" -Headers $headers
$response | ConvertTo-Json -Depth 3

# Test MQTT connection
# Có thể dùng MQTT client tools như MQTT Explorer
Write-Host "Download MQTT Explorer: http://mqtt-explorer.com/" -ForegroundColor Blue
```

## Bước 8: Validation Checklist

### 8.1 Build Validation

- [ ] `npm run build:renderer` chạy thành công
- [ ] `npm run build:nsis` tạo file đúng tên
- [ ] File `latest.yml` có URL đúng
- [ ] File sizes hợp lý (>100MB)

### 8.2 GitHub Integration

- [ ] GitHub Actions workflow hoàn thành
- [ ] Release page có đầy đủ assets
- [ ] Download links hoạt động
- [ ] Token permissions đủ quyền

### 8.3 OTA System

- [ ] Admin web connect GitHub thành công
- [ ] MQTT broker kết nối ổn định
- [ ] Update command gửi/nhận đúng
- [ ] Download progress hiển thị
- [ ] App restart và version update

### 8.4 End-to-End Test

- [ ] Toàn bộ flow từ build -> release -> update hoạt động
- [ ] Không có broken dependencies
- [ ] Performance acceptable
- [ ] Error handling proper

## Ghi Chú Quan Trọng

⚠️ **Lưu ý khi test:**

1. Luôn backup trước khi test
2. Test trên máy ảo hoặc máy test riêng
3. Không test trên production environment
4. Monitor logs carefully
5. Keep rollback plan ready

🔧 **Tools hữu ích:**

- MQTT Explorer (test MQTT connection)
- Postman (test GitHub API)
- Process Monitor (monitor file operations)
- Git Bash (better terminal experience)

📝 **Log locations:**

- Desktop app: Console output hoặc log files
- Admin web: Browser Developer Console
- GitHub Actions: Actions tab trên GitHub
- MQTT: Broker logs hoặc MQTT client logs
