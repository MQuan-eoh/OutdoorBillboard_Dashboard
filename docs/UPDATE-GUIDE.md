# ITS Billboard - Auto-Update Implementation Guide

## 🚨 **VẤN ĐỀ HIỆN TẠI: CHƯA CÓ GITHUB RELEASE**

**Tại sao "Kiểm tra cập nhật" trả về "no_updates"?**

Vì **chưa có GitHub Release nào** được tạo cho repository `MinhQuan7/ITS_OurdoorBillboard-`!

**Giải pháp:** Tạo GitHub Release đầu tiên với file .exe đã build.

---

## 📋 **HƯỚNG DẪN TẠO GITHUB RELEASE NGAY BÂY GIỜ**

### **Bước 1: Build Ứng Dụng**

```bash
# 1. Kill tất cả process Electron
npm run kill

# 2. Clean dist folder
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# 3. Build renderer
npm run build:renderer

# 4. Build Windows app
npm run build:win
```

**Kết quả mong đợi:**

```
dist/
├── win-unpacked/          # App unpacked
├── ITS-Billboard-1.0.0-setup.exe    # NSIS Installer
├── ITS-Billboard-1.0.0-portable.exe # Portable version
└── latest.yml             # Update manifest (quan trọng!)
```

### **Bước 2: Tạo Git Tag**

```bash
# Tạo tag cho version hiện tại (1.0.0)
git tag -a v1.0.0 -m "Release version 1.0.0 - Initial release"

# Push tag lên GitHub
git push origin v1.0.0
```

### **Bước 3: Tạo GitHub Release**

1. **Truy cập GitHub:**

   - Đi đến: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases

2. **Tạo Release mới:**

   - Click **"Create a new release"**
   - **Tag version:** `v1.0.0` (sẽ tự động select nếu đã push tag)
   - **Release title:** `Release v1.0.0`
   - **Description:**

     ```
     Initial release of ITS Outdoor Billboard App

     Features:
     - LED Billboard display
     - MQTT IoT integration
     - Logo management via GitHub CDN
     - Auto-update capability
     ```

3. **Upload Files:**

   - **Bắt buộc upload:** `latest.yml` (nằm trong folder `dist/`)
   - **Upload thêm:** `ITS-Billboard-1.0.0-setup.exe` và `ITS-Billboard-1.0.0-portable.exe`

4. **Publish Release:**
   - Click **"Publish release"**

---

## 🔍 **KIỂM TRA RELEASE ĐÃ TẠO THÀNH CÔNG**

Sau khi tạo release, truy cập:

```
https://api.github.com/repos/MinhQuan7/ITS_OurdoorBillboard-/releases/latest
```

**Response mong đợi:**

```json
{
  "tag_name": "v1.0.0",
  "assets": [
    {
      "name": "latest.yml",
      "browser_download_url": "https://github.com/.../latest.yml"
    },
    {
      "name": "ITS-Billboard-1.0.0-setup.exe",
      "browser_download_url": "https://github.com/.../setup.exe"
    }
  ]
}
```

---

## 🧪 **TEST UPDATE NGAY BÂY GIỜ**

Sau khi tạo release:

1. **Mở Admin-Web**
2. **Click "Kiểm tra cập nhật"**
3. **Kỳ vọng thấy:** `Update available: v1.0.0`

4. **Hoặc force update ngay:**
   - Click "Cập nhật ngay"
   - Xác nhận dialog
   - App sẽ download và restart

---

## 📝 **CẬP NHẬT VERSION CHO RELEASE TIẾP THEO**

Khi có thay đổi code:

```bash
# 1. Update version trong package.json
{
  "version": "1.0.1"
}

# 2. Commit thay đổi
git add package.json
git commit -m "Bump version to 1.0.1"

# 3. Tạo tag mới
git tag -a v1.0.1 -m "Release v1.0.1 - Bug fixes"

# 4. Push tag
git push origin v1.0.1

# 5. Tạo release trên GitHub (như bước 3 ở trên)
```

---

## ⚙️ **CẤU HÌNH ELECTRON-UPDATER**

**Repository trong package.json:**

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "MinhQuan7",
      "repo": "ITS_OurdoorBillboard-"
    }
  }
}
```

**Auto-updater trong main.js:**

```javascript
// Đã được cấu hình đúng
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;
await autoUpdater.checkForUpdates();
```

---

## 🔧 **TROUBLESHOOTING**

### **Lỗi: Build thất bại**

```bash
# Kill tất cả process
taskkill /f /im electron.exe /im node.exe

# Clean và rebuild
Remove-Item -Recurse -Force dist,node_modules/.cache
npm install
npm run build:renderer
npm run build:win
```

### **Lỗi: "No updates available"**

- ✅ Kiểm tra release đã publish chưa
- ✅ Kiểm tra file `latest.yml` có trong release không
- ✅ Kiểm tra version trong package.json vs tag version

### **Lỗi: Download failed**

- ✅ Kiểm tra internet connection
- ✅ Kiểm tra file .exe không bị corrupt
- ✅ Kiểm tra quyền write vào app folder

---

## 📊 **MONITOR UPDATE STATUS**

**MQTT Topics để monitor:**

| Topic                         | Direction      | Mô tả                                       |
| ----------------------------- | -------------- | ------------------------------------------- |
| `its/billboard/commands`      | Admin → Device | Gửi lệnh check/force update                 |
| `its/billboard/update/status` | Device → Admin | Status update (available/downloading/error) |

**Status codes:**

- `"update_available"` - Có update mới
- `"no_updates"` - Đã là version mới nhất
- `"downloading"` - Đang download
- `"update_in_progress"` - Đang cài đặt
- `"error"` - Lỗi update

---

## 🎯 **TÓM TẮT QUY TRÌNH**

```
1. Code changes → Update package.json version
2. Commit & push code
3. Tạo git tag (v1.0.1)
4. Push tag → Trigger build (nếu có GitHub Actions)
5. Tạo GitHub Release với file .exe + latest.yml
6. App tự động detect update qua electron-updater
7. Admin-web có thể trigger manual update qua MQTT
```

**Bước quan trọng nhất:** File `latest.yml` phải có trong release để electron-updater biết có update!

## Architecture

### 1. Release Build Process

```
Code Push to main/release branch
    ↓
GitHub Actions Workflow (build-release.yml)
    ↓
Build Electron app with electron-builder
    ↓
Create .exe (NSIS Installer + Portable)
    ↓
Upload to GitHub Releases
    ↓
Desktop apps detect & download updates
```

### 2. MQTT Communication

#### Command Broker (HiveMQ)

- **Topic**: `its/billboard/commands`
- **Message**: `{ action: "check_update"|"force_update", timestamp, source }`
- **Response**: Published to `its/billboard/update/status`

#### E-Ra IoT Broker

- **Topic**: `eoh/chip/{gatewayToken}/config/+/value`
- **Usage**: Sensor data (không dùng cho commands)

---

## Release Process

### Step 1: Prepare Release

```bash
# Update version in package.json
"version": "1.0.1"

# Commit changes
git add package.json
git commit -m "Bump version to 1.0.1"
```

### Step 2: Create GitHub Tag

```bash
# Create tag
git tag -a v1.0.1 -m "Release version 1.0.1 - Bug fixes and improvements"

# Push tag to trigger CI/CD
git push origin v1.0.1
```

### Step 3: GitHub Actions Build

- Workflow file: `.github/workflows/build-release.yml`
- Triggered on: Tag push (`v*`)
- Outputs:
  - `ITS-Billboard-1.0.1-nsis.exe` (NSIS Installer)
  - `ITS-Billboard-1.0.1-portable.exe` (Portable)
  - `latest.yml` (Update manifest)

### Step 4: Verify Release

1. Go to: https://github.com/MQuan-eoh/ITS_OurdoorBillboard-/releases
2. Check artifacts uploaded
3. Create release notes (optional)

---

## Update Triggers

### Auto-Check

- Desktop app checks every **1 hour** by default
- Configured in `autoUpdater.checkForUpdates()`

### Manual Check from Admin-Web

```
Admin-Web UI → "Check Updates" Button
    ↓
MQTT: Publish to `its/billboard/commands`
    { action: "check_update" }
    ↓
Desktop App receives command
    ↓
Check GitHub Releases via electron-updater
    ↓
Response via `its/billboard/update/status`
    { status: "update_available", version: "1.0.1" }
```

### Force Update from Admin-Web

```
Admin-Web UI → "Force Update" Button
    ↓
MQTT: Publish to `its/billboard/commands`
    { action: "force_update" }
    ↓
Desktop App:
  1. Check for updates
  2. Download .exe
  3. Install silently
  4. Restart app
    ↓
Status: `its/billboard/update/status`
```

---

## Configuration

### Package.json Build Settings

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "MQuan-eoh",
      "repo": "ITS_OurdoorBillboard-"
    },
    "win": {
      "target": ["nsis", "portable"]
    }
  }
}
```

### Main.js Auto-Updater Settings

```javascript
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;
await autoUpdater.checkForUpdates();
```

---

## Troubleshooting

### Issue: "Update check failed"

**Causes:**

- Internet connection lost
- GitHub API rate limit exceeded
- HiveMQ broker not connected

**Solution:**

```javascript
// Check dual broker status
console.log("E-Ra connected:", mqttService.isConnected);
console.log("Command connected:", mqttService.isCommandConnected);

// Check GitHub token
// Verify .github/workflows/build-release.yml has GITHUB_TOKEN
```

### Issue: "App failed to install update"

**Causes:**

- App running during update
- Permission denied to write files
- Update file corrupted

**Solution:**

```javascript
// Check app exit before install
autoUpdater.quitAndInstall(false, true); // isSilent=true, forceRunAfter=true

// Logs: Check electron logs
// %APPDATA%/ITS-Outdoor-Billboard/logs/
```

### Issue: "No updates available"

**Possible:**

- Already on latest version
- GitHub API issue
- Release not built properly

**Solution:**

```bash
# Verify release exists
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/MQuan-eoh/ITS_OurdoorBillboard-/releases
```

---

## Rollback

### Manual Rollback

1. **Stop current app**

   ```bash
   taskkill /f /im electron.exe
   ```

2. **Restore previous version**

   - Delete `%AppData%/ITS-Outdoor-Billboard/update.asar`
   - Restart app with previous installer

3. **Or downgrade version tag**
   ```bash
   git tag -d v1.0.1
   git push origin :refs/tags/v1.0.1
   ```

### Auto-Rollback (electron-updater feature)

- If update fails during install, app reverts to previous version
- Check logs for rollback confirmation

---

## Admin-Web Update Interface

### Buttons

1. **Check Updates** (🔍)

   - Sends check_update command
   - Shows available version
   - Enables Force Update button if update available

2. **Force Update** (⬇️)
   - Requires confirmation
   - Downloads & installs update
   - Shows progress bar
   - App auto-restarts after install

### Status Display

```
Status Messages:
✅ Update available: v1.0.1
⬇️ Downloading v1.0.1...
🔄 Update in progress...
❌ Error: {error message}
```

---

## File Locations

### Desktop App

```
%APPDATA%/ITS-Outdoor-Billboard/
├── config.json          # App config
├── logs/
│   └── main.log        # Auto-updater logs
├── pending/            # Downloaded update
└── app-update.yml      # Current update info
```

### GitHub

```
Repository: https://github.com/MQuan-eoh/ITS_OurdoorBillboard-
├── main branch          # Source code
├── Releases             # Built .exe files
└── .github/workflows/
    └── build-release.yml
```

---

## MQTT Topics Reference

| Topic                         | Direction    | Payload                       |
| ----------------------------- | ------------ | ----------------------------- |
| `its/billboard/commands`      | admin→device | `{action, timestamp, source}` |
| `its/billboard/update/status` | device→admin | `{status, version, error}`    |
| `its/billboard/reset/status`  | device→admin | `{status, timestamp}`         |

---

## Next Steps

1. **Test Release Process**

   - Create test tag `v1.0.0-test`
   - Verify GitHub Actions runs
   - Confirm .exe artifacts created

2. **Test Update Flow**

   - Trigger from admin-web
   - Monitor desktop app logs
   - Verify restart

3. **User Documentation**
   - How to update (automatic vs manual)
   - What to do if update fails
   - Support contact

---

## Support

For issues:

1. Check logs: `%APPDATA%/ITS-Outdoor-Billboard/logs/`
2. Verify MQTT connection: admin-web status indicator
3. Check GitHub release: https://github.com/MQuan-eoh/ITS_OurdoorBillboard-/releases
4. Contact development team
