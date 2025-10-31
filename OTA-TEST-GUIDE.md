# 🚀 HƯỚNG DẪN TEST OTA UPDATE

## 🎯 CÁCH TEST ĐƠN GIẢN NHẤT

### Bước 1: Thay đổi Version và Build Release Mới

```bash
# 1. Thay đổi version trong package.json
# Từ: "version": "1.0.0"
# Thành: "version": "1.0.1"

# 2. Build release mới
npm run build:nsis

# 3. Upload lên GitHub Release v1.0.1
# - Upload ITS-Billboard-Setup-1.0.1.exe
# - Upload latest.yml (cập nhật version và hash)
```

### Bước 2: Test với App Cũ

```bash
# Chạy app version 1.0.0
npm start

# Mở admin-web và test:
# 1. Click "KIỂM TRA CẬP NHẬT" → Phải thấy "Update available: v1.0.1"
# 2. Click "CẬP NHẬT NGAY" → Phải download và install thành công
# 3. App tự restart và hiển thị version mới
```

---

## 🎨 CÁCH TEST DỄ NHẬN BIỆT (VISUAL INDICATOR)

### Thêm Visual Change để Nhận Biết Update

**Option 1: Thay đổi Background Color**

```javascript
// Trong main.js - createMainWindow()
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 384,
    height: 384,
    // ... existing code ...

    // Thêm background color để nhận biết version
    backgroundColor: app.getVersion() === "1.0.0" ? "#ffcccc" : "#ccffcc", // Đỏ cho v1.0.0, Xanh cho v1.0.1
  });
}
```

**Option 2: Thêm Version Text**

```javascript
// Trong renderer/app.js hoặc main.js
// Hiển thị version ở góc màn hình
const versionText = document.createElement("div");
versionText.textContent = `v${app.getVersion()}`;
versionText.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
  z-index: 9999;
`;
document.body.appendChild(versionText);
```

**Option 3: Thay đổi Logo hoặc Text**

```javascript
// Thay đổi text trong UI
const titleElement = document.getElementById("app-title");
if (titleElement) {
  titleElement.textContent = `ITS Billboard v${app.getVersion()}`;
}
```

---

## 🧪 CÁCH TEST NHANH (LOCAL SIMULATION)

### Sử dụng Local Build để Test

```bash
# 1. Build app hiện tại (v1.0.0)
npm run build:win

# 2. Copy app ra folder test
mkdir test-update
copy "dist/ITS-Billboard-win32-x64/*" "test-update/"

# 3. Thay đổi version thành 1.0.1 trong package.json
# 4. Build lại app mới (v1.0.1)
npm run build:win

# 5. Chạy app cũ (từ test-update folder)
# 6. Test update từ admin-web
```

---

## 📊 CÁCH TEST CHI TIẾT (FULL WORKFLOW)

### Test End-to-End OTA Update

```bash
# Bước 1: Setup GitHub Release
# - Tạo release v1.0.1 trên GitHub
# - Upload ITS-Billboard-Setup-1.0.1.exe
# - Upload latest.yml với đúng hash

# Bước 2: Chạy App Cũ
npm start  # Chạy v1.0.0

# Bước 3: Test từ Admin-Web
# 1. Mở admin-web
# 2. Click "KIỂM TRA CẬP NHẬT"
# 3. Verify: "Update available: v1.0.1"
# 4. Click "CẬP NHẬT NGAY"
# 5. Monitor progress bar đến 100%
# 6. App tự động restart
# 7. Verify version mới hiển thị

# Bước 4: Verify Update Thành Công
# - App hiển thị version mới
# - Visual indicators thay đổi
# - Không có lỗi trong console
```

---

## 🔍 CÁCH DEBUG NẾU UPDATE FAIL

### Check Logs

```bash
# 1. Mở Developer Tools (F12)
# 2. Check Console logs
# 3. Look for:
#    - "AutoUpdater: Update available"
#    - "MainProcessMqttService: Downloading"
#    - "AutoUpdater: Update downloaded"

# 3. Check Network tab
#    - Verify GitHub release assets được download
```

### Common Issues

```javascript
// Nếu update fail, check:
console.log("Current version:", app.getVersion());
console.log("App path:", app.getAppPath());
console.log("Resources path:", process.resourcesPath);

// Check app-update.yml exists
const fs = require("fs");
const path = require("path");
const updateFile = path.join(process.resourcesPath, "app-update.yml");
console.log("Update file exists:", fs.existsSync(updateFile));
```

---

## ✅ CRITERIA THÀNH CÔNG

### Update Thành Công Khi:

1. ✅ **Admin-web detect update**: "Update available: v1.0.1"
2. ✅ **Download progress**: Progress bar từ 0% → 100%
3. ✅ **Auto restart**: App tự động restart sau download
4. ✅ **Version change**: App hiển thị version mới
5. ✅ **Visual confirmation**: Background color/text thay đổi
6. ✅ **No errors**: Không có lỗi trong console logs

### Update Thất Bại Khi:

❌ Progress bar dừng lại < 100%
❌ Không tự động restart
❌ Version không thay đổi
❌ Có lỗi trong console
❌ MQTT disconnect trong quá trình update

---

## 🎯 RECOMMENDED TEST APPROACH

**Đơn giản nhất**: Thay đổi version + thêm version text display

```javascript
// Thêm vào renderer để hiển thị version
const versionDiv = document.createElement("div");
versionDiv.id = "version-indicator";
versionDiv.innerHTML = `v${window.BannerConfig.app.version}`;
versionDiv.style.cssText = `
  position: fixed;
  bottom: 10px;
  right: 10px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 14px;
  z-index: 10000;
`;
document.body.appendChild(versionDiv);
```

**Test flow:**

1. Build v1.0.0 → Run app → See "v1.0.0"
2. Change version to 1.0.1 → Build release → Upload to GitHub
3. Test update → App restart → See "v1.0.1"
