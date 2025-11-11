# 🎯 ICON MANAGEMENT SYSTEM

Hệ thống quản lý icon cho ITS Billboard App - tách biệt rõ ràng giữa **App Icon** và **Company Banner Logos**.

## 📁 CẤU TRÚC FILE

```
ITS_OurdoorScreen/
├── 🎯 ICON CONVERSION SCRIPTS
│   ├── convert-images-to-icons.ps1    # Script chính convert ảnh
│   └── setup-icons.ps1                # Script setup nhanh
│
├── 🔧 APP ICONS (cho shortcut exe)
│   ├── assets/icon.png                # Icon chính cho Electron
│   └── assets/icon.ico                # Icon cho file .exe
│
└── 🏢 COMPANY BANNERS (cho billboard display)
    └── downloads/logos/               # Logo công ty động
        ├── company_logo_square_384x384.png
        ├── company_logo_banner_800x200.png
        ├── company_logo_fullscreen_1920x800.png
        └── company_logo_web_400x400.png
```

## 🚀 CÁCH SỬ DỤNG

### 1️⃣ SETUP NHANH (nếu có sample image)

```powershell
.\setup-icons.ps1
```

### 2️⃣ CONVERT APP ICON (logo shortcut exe)

```powershell
.\convert-images-to-icons.ps1 -SourcePath "C:\path\to\your\app-logo.png" -Type app
```

**Kết quả:**

- `assets/icon.png` - Icon chính cho Electron window
- `assets/icon.ico` - Icon cho file .exe và shortcut

### 3️⃣ CONVERT COMPANY BANNER (logo hiển thị trên billboard)

```powershell
.\convert-images-to-icons.ps1 -SourcePath "C:\path\to\company-banner.jpg" -Type banner
```

**Kết quả:**

- `downloads/logos/company_square_384x384.png` - Cho LED display
- `downloads/logos/company_banner_800x200.png` - Cho banner
- `downloads/logos/company_fullscreen_1920x800.png` - Cho fullscreen
- `downloads/logos/company_web_400x400.png` - Cho web admin

### 4️⃣ BUILD APP VỚI ICON MỚI

```powershell
npm run build:win
```

## 🔧 TÍCH HỢP VÀO BUILD PROCESS

### Package.json đã được cập nhật:

```json
{
  "scripts": {
    "convert:app-icon": "powershell -ExecutionPolicy Bypass -File convert-images-to-icons.ps1 -Type app",
    "convert:banner-logo": "powershell -ExecutionPolicy Bypass -File convert-images-to-icons.ps1 -Type banner"
  },
  "build": {
    "win": {
      "icon": "assets/icon.ico"
    }
  }
}
```

### Build Commands:

```powershell
# Build với electron-builder (dùng icon.ico)
npm run build:nsis

# Build với electron-packager (dùng icon.png)
npm run build:win
```

## 📐 KÍCH THƯỚC ICON

### App Icons:

- **16x16** - Small taskbar icon
- **24x24** - Small icon
- **32x32** - Standard icon
- **48x48** - Large icon
- **64x64** - Extra large icon
- **96x96** - Jumbo icon
- **128x128** - Large thumbnail
- **256x256** - Extra large thumbnail

### Banner Logos:

- **384x384** - LED Billboard display
- **800x200** - Banner format
- **1920x800** - Fullscreen banner
- **400x400** - Web admin preview

## 🛠️ YÊU CẦU HỆ THỐNG

Script sẽ tự động cài đặt **ImageMagick** qua:

1. **Chocolatey** (nếu có): `choco install imagemagick`
2. **WinGet** (nếu có): `winget install ImageMagick.ImageMagick`
3. **Manual**: Download từ https://imagemagick.org/script/download.php#windows

## 🎯 PHÂN BIỆT APP ICON VÀ BANNER LOGO

### 🔧 APP ICON (Type: app)

- **Mục đích**: Icon của ứng dụng (shortcut, taskbar, window)
- **Vị trí**: `assets/icon.png`, `assets/icon.ico`
- **Sử dụng**: Electron main window, file .exe
- **Kích thước**: Vuông, nhiều size từ 16x16 đến 256x256

### 🏢 BANNER LOGO (Type: banner)

- **Mục đích**: Logo công ty hiển thị trên billboard
- **Vị trí**: `downloads/logos/`
- **Sử dụng**: LED display, web admin, banner
- **Kích thước**: Đa dạng (vuông, banner, fullscreen)

## 🚨 LƯU Ý QUAN TRỌNG

1. **App Icon** phải tồn tại trước khi build
2. **Banner Logo** được load động qua LogoManifestService
3. **Format hỗ trợ**: PNG, JPG, BMP, GIF, TIFF
4. **Chất lượng**: Ảnh gốc nên có độ phân giải cao
5. **Background**: Script tự động tạo background transparent

## 📋 EXAMPLE WORKFLOW

```powershell
# 1. Convert logo công ty thành app icon
.\convert-images-to-icons.ps1 -SourcePath "company-logo.png" -Type app

# 2. Convert banner công ty thành banner logos
.\convert-images-to-icons.ps1 -SourcePath "company-banner.jpg" -Type banner

# 3. Build app với icon mới
npm run build:win

# 4. Check kết quả
ls assets/        # Xem app icons
ls downloads/logos/  # Xem banner logos
```

## 🆘 TROUBLESHOOTING

### ❌ ImageMagick not found

```powershell
# Cài đặt manual
choco install imagemagick -y
# hoặc
winget install ImageMagick.ImageMagick
```

### ❌ Icon không hiển thị sau build

1. Check file `assets/icon.png` và `assets/icon.ico` có tồn tại
2. Check package.json có config `"icon": "assets/icon.ico"`
3. Rebuild: `npm run build:win`

### ❌ Banner logo không load

1. Check file trong `downloads/logos/`
2. Update `logo-manifest.json`
3. Restart app để LogoManifestService reload

## 🎉 COMPLETED!

Hệ thống icon management đã sẵn sàng! Build app sẽ có logo mới cho cả app icon và banner display.
