# 🚀 HƯỚNG DẪN SETUP GITHUB RELEASES CHO OTA UPDATE

## 📋 STEPS SETUP GITHUB RELEASE

### Bước 1: Tạo Release trên GitHub Web

1. Mở browser và vào: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases
2. Click **"Create a new release"**
3. Điền thông tin:

   - **Tag version:** `v1.0.0` (đã được tạo)
   - **Release title:** `ITS Billboard v1.0.0`
   - **Description:**

     ```
     🚀 ITS Billboard v1.0.0 - Initial Release

     ## ✨ Features
     - 384x384 LED Billboard Display
     - Real-time weather integration
     - MQTT IoT connectivity
     - Logo banner management
     - Admin web interface
     - OTA (Over-The-Air) updates

     ## 📦 Installation
     1. Download ITS-Billboard-1.0.0-setup.exe
     2. Run the installer
     3. Launch ITS Billboard

     ## 🔄 Auto-Updates
     This release supports automatic updates via GitHub Releases.
     ```

### Bước 2: Upload Files cần thiết

**QUAN TRỌNG:** Cần upload các files sau để OTA update hoạt động:

1. **ITS-Billboard-1.0.0-setup.exe** (Installer chính)
2. **latest.yml** (File metadata cho electron-updater)
3. **ITS-Billboard-1.0.0-portable.zip** (Optional - Portable version)

### Bước 3: Tạo file latest.yml

Tạo file `latest.yml` với nội dung:

```yaml
version: 1.0.0
files:
  - url: ITS-Billboard-1.0.0-setup.exe
    sha512: [SHA512_HASH_OF_SETUP_EXE]
    size: [FILE_SIZE_IN_BYTES]
path: ITS-Billboard-1.0.0-setup.exe
sha512: [SHA512_HASH_OF_SETUP_EXE]
releaseDate: "2025-10-29T00:00:00.000Z"
```

### Bước 4: Build proper installer

```bash
# Clean build
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npm install

# Build NSIS installer
npm run build:nsis

# Hoặc build portable
npm run build:win
```

### Bước 5: Upload và Publish

1. Upload `ITS-Billboard-1.0.0-setup.exe` vào Assets
2. Upload `latest.yml` vào Assets
3. Click **"Publish release"**

## 🔧 CÁCH TẠO FILE latest.yml CHÍNH XÁC

### Dùng electron-builder (Khuyến nghị):

```bash
npm run build:nsis
# File latest.yml sẽ được tự động tạo trong dist/
```

### Tạo manual (Nếu build fail):

```bash
# Get SHA512 hash
$hash = Get-FileHash -Algorithm SHA512 "dist/ITS-Billboard-1.0.0-setup.exe"
$size = (Get-Item "dist/ITS-Billboard-1.0.0-setup.exe").Length

# Tạo latest.yml với hash và size chính xác
```

## ⚡ TEST OTA UPDATE

Sau khi setup release:

1. Chạy app cũ (v1.0.0)
2. Tạo release mới (v1.0.1)
3. Test update từ admin-web
4. App sẽ tự động download và install

## 🚨 LƯU Ý QUAN TRỌNG

- **File latest.yml PHẢI CÓ** để electron-updater detect updates
- **SHA512 hash phải chính xác**
- **File size phải đúng**
- **Repository phải public** hoặc có proper access token
- **GitHub token cần quyền repo** nếu repository private

## 🛠️ TROUBLESHOOTING

### Lỗi "Update check failed":

- Kiểm tra latest.yml có trong release assets
- Verify SHA512 hash chính xác
- Check repository permissions

### Lỗi "Download failed":

- File size mismatch
- Network connection
- GitHub rate limits

### Lỗi "Installation failed":

- User permissions
- Antivirus blocking
- Corrupted download
