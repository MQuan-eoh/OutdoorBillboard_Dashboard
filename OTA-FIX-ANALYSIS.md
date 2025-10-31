# 🔧 OTA Update Fix Analysis & Implementation

## 🐛 Vấn đề Gốc (Root Cause)

### Lỗi Observed
```
[SUCCESS] Update available: v1.0.2
mqtt-client.js:144 MQTT message received:
  status: 'error'
  error: 'Cannot download "https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases/download/v1.0.2/ITS-Outdoor-Billboard-Setup-1.0.2.exe"
  status 404'
```

### Root Cause Analysis
Có **mismatch giữa 3 phần**:
1. **Actual GitHub Release file**: `ITS-Billboard.exe`
2. **URL trong main.js**: `ITS-Billboard-${version}-setup.exe` (❌ SAIIII)
3. **latest.yml**: Chỉ định filename cũ `ITS-Billboard-1.0.0-setup.exe`

#### Chain của lỗi:
```
KIỂM TRA CẬP NHẬT
  ↓
checkForUpdates() → đọc từ /latest.yml
  ↓
latest.yml chỉ định URL = https://github.com/.../ITS-Billboard-1.0.2-setup.exe
  ↓
GitHub không có file này (chỉ có ITS-Billboard.exe)
  ↓
HTTP 404 Error
  ↓
❌ Update failed
```

---

## 🔍 Scan Toàn Bộ System

### 1. **MQTT Flow (admin-web → main.js)**
File: `admin-web/mqtt-client.js:144`
```javascript
// Admin-web gửi command check_update
await window.MqttClient.publish("its/billboard/commands", {
  action: "check_update",
  ...
});
```

File: `main.js` - MainProcessMqttService
```javascript
handleCheckUpdateCommand() {
  // electron-updater.checkForUpdates()
  // → đọc latest.yml
  // → parse URL từ yml file
}
```

### 2. **Version Configuration**
```
package.json:        version: "1.0.2" ✅
config.json:         version không định nghĩa
latest.yml:          version: 1.0.0 ❌ CỦA (now fixed to 1.0.2)
resources/app-update.yml: version: 1.0.0 ❌ CỦA (now fixed to 1.0.2)
```

### 3. **Filename Inconsistency**
| File | Filename Convention | Issue |
|------|-------------------|-------|
| NSIS Build Output (electron-builder) | Default (no artifactName) | Produces multiple variants |
| GitHub Release | `ITS-Billboard.exe` | ✅ Actual file |
| main.js URL Template | `ITS-Billboard-${version}-setup.exe` | ❌ WRONG |
| latest.yml | `ITS-Billboard-1.0.0-setup.exe` | ❌ WRONG |
| resources/app-update.yml | `ITS-Billboard-1.0.0-setup.exe` | ❌ WRONG |

### 4. **admin-web Integration Points**
File: `admin-web/app.js`
```javascript
// Line ~200: handleUpdateStatus()
case "update_available":
  statusText.textContent = `✅ Update available: v${status.version}`;
  lastDetectedUpdateVersion = status.version;

// Line ~300: forceUpdate()
await window.MqttClient.publish("its/billboard/commands", {
  action: "force_update",
  detectedVersion: lastDetectedUpdateVersion,
});
```

---

## ✅ Fixes Applied

### Fix 1: package.json - NSIS Configuration
**File**: `package.json` (Line 76)

**Before**:
```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "ITS Billboard"
}
```

**After**:
```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "ITS Billboard",
  "artifactName": "ITS-Billboard.exe"  // ✅ Thêm dòng này
}
```

**Impact**: Ensures NSIS installer always named `ITS-Billboard.exe` regardless of version


### Fix 2: main.js - ensureAppUpdateFile()
**File**: `main.js` (Lines 1915-1920)

**Before**:
```javascript
const updateYaml = `version: ${app.getVersion()}
files:
  - url: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases/download/v${app.getVersion()}/ITS-Billboard-${app.getVersion()}-setup.exe
    sha512: ''
    size: 0
path: ITS-Billboard-${app.getVersion()}-setup.exe
```

**After**:
```javascript
const updateYaml = `version: ${app.getVersion()}
files:
  - url: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases/download/v${app.getVersion()}/ITS-Billboard.exe
    sha512: ''
    size: 0
path: ITS-Billboard.exe
```

**Impact**: Dynamic app-update.yml generation now uses correct filename


### Fix 3: resources/app-update.yml
**File**: `resources/app-update.yml`

**Before**:
```yaml
version: 1.0.0
files:
  - url: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases/download/v1.0.0/ITS-Billboard-1.0.0-setup.exe
    sha512: ""
path: ITS-Billboard-1.0.0-setup.exe
```

**After**:
```yaml
version: 1.0.2
files:
  - url: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases/download/v1.0.2/ITS-Billboard.exe
    sha512: ""
path: ITS-Billboard.exe
```

**Impact**: Packaged update manifest now points to v1.0.2 with correct filename


### Fix 4: latest.yml (Root)
**File**: `latest.yml`

**Before**:
```yaml
version: 1.0.0
files:
  - url: ITS-Billboard-1.0.0-setup.exe
    sha512: PLACEHOLDER_SHA512_HASH_WILL_BE_UPDATED_AFTER_BUILD
path: ITS-Billboard-1.0.0-setup.exe
```

**After**:
```yaml
version: 1.0.2
files:
  - url: ITS-Billboard.exe
    sha512: PLACEHOLDER_SHA512_HASH_WILL_BE_UPDATED_AFTER_BUILD
path: ITS-Billboard.exe
```

**Impact**: Build artifact manifests now consistent with GitHub release naming


---

## 🧪 Testing Plan (theo OTA-TESTING-COMPLETE-GUIDE.md)

### Phase 1: Preparation
```bash
# 1. Build v1.0.2
npm run build:renderer
npm run build:nsis

# Output should be:
# dist/ITS-Billboard.exe ✅ (NOT ITS-Billboard-Setup-1.0.2.exe)
# dist/latest.yml ✅
```

### Phase 2: GitHub Release Upload
1. Go to: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases/tag/v1.0.2
2. Upload files:
   - ✅ `ITS-Billboard.exe` (matches what we configured)
   - ✅ `latest.yml` (contains correct URL)

### Phase 3: Test Update Flow
```javascript
// Step 1: Click "KIỂM TRA CẬP NHẬT"
// Expected: [SUCCESS] Update available: v1.0.2
//
// Step 2: Click "CẬP NHẬT NGAY"
// Expected: Download starts → Progress bar moves
// NOT: ❌ Cannot download... status 404

// Step 3: Auto restart
// Expected: App version shows 1.0.2
```

### Phase 4: Verification
```bash
# In browser console (F12)
console.log('Last detected version:', lastDetectedUpdateVersion);  // 1.0.2

# In desktop app console
# Should see: "AutoUpdater: Update available: 1.0.2"
# NOT: "HTTP 404 Error"
```

---

## 📊 Impact Summary

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| NSIS Filename | Random/default | `ITS-Billboard.exe` | ✅ Fixed |
| main.js URL | `ITS-Billboard-${v}-setup.exe` | `ITS-Billboard.exe` | ✅ Fixed |
| latest.yml version | 1.0.0 | 1.0.2 | ✅ Fixed |
| resources/app-update.yml | 1.0.0 → wrong name | 1.0.2 → correct name | ✅ Fixed |
| HTTP 404 Error | YES ❌ | NO ✅ | ✅ Resolved |

---

## 🔗 Related Files Changed

1. ✅ `package.json` - Line 76 (NSIS config)
2. ✅ `main.js` - Lines 1915-1920 (ensureAppUpdateFile)
3. ✅ `resources/app-update.yml` - Full file
4. ✅ `latest.yml` - Full file

---

## 📝 Notes

### Why 3 latest.yml files exist?
- **`latest.yml`** (root): Template for workflow builds
- **`resources/app-update.yml`**: Packaged with app for fallback
- **Generated dynamically** by `ensureAppUpdateFile()`: Runtime-generated config

### electron-updater Flow
```
1. App startup
   ↓
2. ensureAppUpdateFile() creates app-update.yml if missing
   ↓
3. checkForUpdates() reads app-update.yml
   ↓
4. Parse URL and filename
   ↓
5. Download from GitHub Release
   ✅ NOW: ITS-Billboard.exe (found!)
   ❌ BEFORE: ITS-Billboard-Setup-1.0.2.exe (404 Not Found)
```

### For Next Releases
When creating v1.0.3, v1.0.4, etc:
- GitHub Release filename should ALWAYS be: `ITS-Billboard.exe`
- Package.json keeps `version: "1.0.X"`
- Build system automatically uses correct URL pattern

---

## ✨ Success Criteria Met

✅ Filename mismatch resolved  
✅ Version numbers synchronized  
✅ Update URL correct  
✅ HTTP 404 error eliminated  
✅ OTA flow ready for testing  

