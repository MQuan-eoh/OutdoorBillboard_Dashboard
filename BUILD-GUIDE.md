# 🚀 HƯỚNG DẪN BUILD APP THÀNH FILE .EXE

## 📦 BUILD APP THÀNH EXECUTABLE

### Cách 1: Build Executable (Khuyến nghị - Dùng Electron Packager)

```bash
npm run build:win
```

- Tạo folder `ITS-Billboard-win32-x64` trong `dist/`
- Chứa executable `ITS-Billboard.exe` (~160MB)
- Không cần install, click đúp để chạy
- Giải pháp đơn giản, ổn định, không có vấn đề file lock

### Cách 2: Build NSIS Installer (Yêu cầu setup riêng)

```bash
npm run build:nsis
```

- Tạo file NSIS installer setup
- Cho phép user install vào máy
- Tạo shortcut trên Desktop và Start Menu
- ⚠️ Có thể gặp lỗi file lock do Windows Defender

### Cách 3: Legacy Build (Không khuyến nghị)

```bash
npm run pack
```

- Build sử dụng electron-packager trực tiếp
- Tương tự Cách 1 nhưng command khác

---

## 📋 CÁC BƯỚC THỰC HIỆN

### Bước 1: Chuẩn bị

```bash
cd "f:\EoH Company\ITS_OurdoorScreen"

# Đảm bảo đã cài electron-builder
npm install electron-builder --save-dev
```

### Bước 2: Build

```bash
# Build executable (Khuyến nghị)
npm run build:win
```

### Bước 3: Tìm file .exe

- Mở thư mục `dist/ITS-Billboard-win32-x64/`
- File executable: `ITS-Billboard.exe`
- Kích thước khoảng 160MB (bao gồm Electron runtime)

### Bước 4: Test

- Copy file .exe hoặc toàn bộ folder `ITS-Billboard-win32-x64` ra Desktop hoặc USB
- Double-click `ITS-Billboard.exe` để chạy
- App sẽ mở với layout 384x384 như demo

---

## ⚙️ CẤU HÌNH BUILD

### Package.json đã được cấu hình:

```json
{
  "build": {
    "win": {
      "target": ["nsis", "portable"],
      "arch": ["x64"]
    },
    "portable": {
      "artifactName": "ITS-Billboard-Portable.exe"
    }
  }
}
```

### Files được đóng gói:

- `main.js` - Electron main process
- `renderer/` - UI files (HTML, CSS, JS)
- `package.json` - App metadata
- Node.js runtime + Electron framework

---

## 🎯 TÍNH NĂNG .EXE

### ✅ Standalone Application:

- Không cần cài Node.js hoặc Electron
- Chạy trên mọi Windows 10/11 x64
- Kích thước: ~150-200MB (self-contained)

### ✅ Desktop Integration:

- Icon trên Desktop (nếu dùng installer)
- Start Menu entry
- Windows Explorer integration

### ✅ Production Ready:

- Code signing (nếu có certificate)
- Auto-updater ready
- Error handling và logging

---

## 🛠️ TROUBLESHOOTING

### Lỗi "File is being used by another process" (Windows Defender):

**Root Cause:** Windows Defender real-time scanning locks files during build

**Solution:**

```bash
# Sử dụng electron-packager (không có vấn đề file lock)
npm run build:win

# Hoặc thêm folder dist vào Windows Defender exclusions:
# Settings → Virus & threat protection → Virus & threat protection settings
# → Add exclusions → Folder: F:\EoH Company\ITS_OurdoorScreen\dist
```

### Lỗi "electron-builder not found":

```bash
npm install electron-builder --save-dev --force
```

### Lỗi build failed:

```bash
# Clear cache và rebuild
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install
npm run build:win
```

### File .exe không chạy:

- Kiểm tra Windows Defender/Antivirus
- Chạy as Administrator
- Kiểm trace Windows version compatibility (Windows 10/11 x64 needed)

### App window không hiển thị:

- Kiểm tra screen resolution
- Alt+Tab để tìm window
- Check TaskManager có process không

---

## 📝 DEPLOYMENT OPTIONS

### For Development/Testing (Recommended):

```bash
npm run build:win
# Output: dist/ITS-Billboard-win32-x64/ITS-Billboard.exe
# Copy folder và test trên máy khác
```

### For Enterprise Deployment:

- Code signing với certificate
- Group Policy deployment
- Silent installation options
- NSIS installer (yêu cầu riêng)

---

## 🎪 KẾT QUẢ MONG ĐỢI

Sau khi build thành công:

- ✅ Folder `dist/ITS-Billboard-win32-x64/`
- ✅ File `ITS-Billboard.exe` (~160MB)
- ✅ Double-click để chạy ngay
- ✅ Window 384x384 pixels
- ✅ Đầy đủ tính năng như npm start
- ✅ Chạy offline, không cần internet
- ✅ Có thể copy folder sang máy khác chạy

---

_Build xong là có thể copy folder chạy trên bất kỳ máy Windows 10/11 x64 nào!_
