# OTA Update Test Summary & Instructions

## 🔍 Current Situation Analysis

### Detected Configuration:

- **Local App Version**: 1.0.3 (package.json)
- **Available GitHub Release**: v1.0.2
- **latest.yml Version**: 1.0.2 (corrected to match available release)

### Files Available in GitHub Release v1.0.2:

✅ `ITS-Billboard-Setup-1.0.2.exe` (NSIS installer - for OTA)  
✅ `ITS-Billboard.exe` (portable exe - trong folder ITS-Billboard-win32-x64)  
✅ `latest.yml` (metadata file)

## 🧪 Test Scenarios

### Scenario 1: Test Downgrade (Recommended for immediate testing)

**Current**: App v1.0.3 → **Target**: v1.0.2  
**Type**: Forced downgrade update  
**Expected Behavior**: App should download and install v1.0.2

### Scenario 2: Test Same Version Reinstall

**Current**: Downgrade app to v1.0.2 first → **Target**: v1.0.2  
**Type**: Force reinstall  
**Expected Behavior**: App should reinstall same version

### Scenario 3: Test Real Upgrade (Requires new release)

**Current**: App v1.0.3 → **Target**: v1.0.4  
**Type**: Real upgrade  
**Expected Behavior**: App should download and install newer version

## 🚀 How to Test OTA Right Now

### Step 1: Test từ Admin-Web

1. Mở admin-web interface
2. Connect MQTT to billboard
3. Click "Kiểm Tra Cập Nhật" - Should detect no updates (current > available)
4. Force update with version "1.0.2"
5. Monitor logs for:
   - ✅ `status: "downloading"`
   - ✅ `status: "downgrade_requested"`
   - ✅ Download progress 0% → 100%

### Step 2: Verify Real Download

Monitor main process logs for:

```
[OTA] Performing real upgrade using electron-updater...
[OTA] Real update available: 1.0.2
AutoUpdater: Download progress: Downloaded X%
```

### Step 3: Expected Flow

1. **Admin-Web**: Send `force_update` command
2. **Desktop App**: Acknowledge command
3. **Desktop App**: Check GitHub release
4. **Desktop App**: Download real installer
5. **Desktop App**: Install and restart
6. **Result**: App version should be 1.0.2

## 🔧 If Test Fails - Debug Steps

### Check 1: MQTT Connection

- Verify admin-web can send commands to desktop app
- Check for acknowledgment messages

### Check 2: GitHub API Access

- Desktop app should access GitHub releases API
- Check for network connectivity issues

### Check 3: electron-updater Logs

```
AutoUpdater: Checking for update...
AutoUpdater: Update available: 1.0.2
AutoUpdater: Download progress: Downloaded X%
```

### Check 4: File Permissions

- Check if app can write to temp directory
- Verify Windows security doesn't block download

## 🎯 Next Steps After Successful Test

### For Production Use:

1. Create proper v1.0.4 release on GitHub
2. Update package.json to 1.0.4
3. Update latest.yml to point to v1.0.4
4. Build and upload artifacts
5. Test upgrade (1.0.3 → 1.0.4)

### Commands to Build v1.0.4:

```powershell
# Update package.json version to 1.0.4
# Build artifacts
npm run build:renderer
npm run build:nsis

# Upload to GitHub:
# dist/ITS-Billboard-Setup-1.0.4.exe
# dist/latest.yml (updated)
```

## 🚨 Important Notes

1. **OTA Uses NSIS Installer**: Not the portable .exe file
2. **GitHub Release Required**: Must exist before OTA works
3. **Version Logic**: Can upgrade, downgrade, or reinstall
4. **Real Download**: Modified code now uses electron-updater for real downloads
5. **Auto-Restart**: App will restart after successful install

## 🔗 Useful Commands

```bash
# Quick test OTA configuration
node ota-test-quick.js

# Check GitHub releases
curl -s "https://api.github.com/repos/MinhQuan7/ITS_OurdoorBillboard-/releases"

# Build new release
.\build-and-release.ps1 -Version "1.0.4" -Publish
```

---

_Última actualización: 2025-11-10_
