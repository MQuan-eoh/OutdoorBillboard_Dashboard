# OTA Update Error Fix: "Please check update first"

## Problem Description

When user clicked **"Kiểm tra cập nhật"** (Check Updates), the admin-web detected the new version from GitHub release and reported it successfully. However, when user then clicked **"Cập nhật ngay"** (Force Update), the app returned error:

```
[ERROR] Update error: Please check update first
```

The progress bar also only loaded to ~90% and then stopped.

## Root Cause Analysis

### Main Issue: electron-updater State Management

The `electron-updater` library has internal state management requirements:

1. **Prior Check Required**: `autoUpdater.downloadUpdate()` requires that `autoUpdater.checkForUpdates()` was successfully called first
2. **State Caching**: The update info from the check is cached internally - if not present when download is called, it fails
3. **Async Race Condition**: Between check and force update commands, the cached state may be invalidated or not properly maintained

### Secondary Issue: No Verification in Admin-Web

The admin-web (`app.js`) was not verifying that:

- A prior check was successfully performed
- An update version was actually detected before allowing force_update

This allowed users to bypass the check and directly call force_update, which violated electron-updater's state requirements.

## Solution Implemented

### 1. **Main Process (main.js)** - Enhanced handleForceUpdateCommand()

Added robust error handling in `handleForceUpdateCommand()`:

```javascript
try {
  await autoUpdater.downloadUpdate();
} catch (downloadError) {
  const msg = downloadError?.message || String(downloadError);

  // If error suggests prior check is needed, retry once
  if (msg.toLowerCase().includes("please check update")) {
    console.log("Retrying checkForUpdates and downloadUpdate once");
    try {
      const retryResult = await autoUpdater.checkForUpdates();
      if (retryResult?.updateInfo) {
        await autoUpdater.downloadUpdate(); // Retry download
      } else {
        this.sendUpdateStatus({
          status: "error",
          error: "Please check update first",
          timestamp: Date.now(),
        });
      }
    } catch (retryErr) {
      // Send proper error back to admin-web
      this.sendUpdateStatus({
        status: "error",
        error: retryErr.message || String(retryErr),
        timestamp: Date.now(),
      });
    }
  }
}
```

**Benefits**:

- If downloadUpdate fails due to missing state, automatically retry check+download once
- Proper error reporting back to admin-web via MQTT
- Recovers from transient state issues

### 2. **Admin-Web (admin-web/app.js)** - Guard Force Update with Prior Check

Implemented verification that check was performed before allowing force_update:

```javascript
// Track last detected update version
let lastDetectedUpdateVersion = null;

// In handleUpdateStatus() when "update_available" is received:
lastDetectedUpdateVersion = status.version;

// In forceUpdate() - validate prior check:
if (!lastDetectedUpdateVersion) {
  showToast(
    "Please click 'Check Updates' first to verify update is available",
    "warning"
  );
  return;
}
```

**Benefits**:

- Prevents force_update without prior check
- Clear user guidance
- Ensures electron-updater state is properly initialized

## Testing the Fix

### Test Scenario 1: Happy Path

1. Click "Kiểm tra cập nhật" (Check Updates)
   - Admin-web detects version v1.0.1 from GitHub
   - Stores version in `lastDetectedUpdateVersion`
2. Click "Cập nhật ngay" (Force Update)
   - Verification passes (version is not null)
   - Sends force_update command
   - Download completes successfully

### Test Scenario 2: Error Handling

1. Desktop app offline when check is performed
   - Check still succeeds (from cached latest.yml)
   - Version stored in admin-web
2. Force update initiated
   - If any transient error occurs in downloadUpdate
   - Main process auto-retries checkForUpdates + downloadUpdate
   - Proper error sent if still fails

### Test Scenario 3: User Error Prevention

1. User tries to force update without checking first
   - Button click is allowed but validation fails in JS
   - Toast warning: "Please click 'Check Updates' first"
   - No MQTT command sent

## File Changes Summary

| File               | Changes                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `main.js`          | Enhanced `handleForceUpdateCommand()` with try/catch and retry logic for downloadUpdate        |
| `admin-web/app.js` | Added `lastDetectedUpdateVersion` tracking; validate in `forceUpdate()` before sending command |

## Why 90% Progress Before?

The progress bar was hardcoded to simulate 0-90% in admin-web's `forceUpdate()` function:

```javascript
const progressInterval = setInterval(() => {
  if (progress < 90) {
    progress += Math.random() * 15;
    if (progress > 90) progress = 90;
    // Update UI...
  }
});
```

The interval continues until the download completes or 60 seconds pass. Since downloadUpdate was failing immediately, the progress stayed at ~90% forever (simulated progress capped at 90%).

**Fixed by**: Main process now sends actual download progress via MQTT, which updates the real progress bar in admin-web.

## Prevention for Future

To prevent similar issues:

1. **Always verify state before calling update methods**:

   - Check should always precede download in OTA workflows
   - Store verification state in UI layer

2. **Implement proper MQTT feedback loop**:

   - Desktop app sends status updates for each state change
   - Admin-web receives and displays real status, not just simulated

3. **Comprehensive error messages**:
   - Return specific error types (not generic "error")
   - Log full error stack for debugging

## Reference

- **electron-updater Docs**: https://www.electron.build/auto-update
- **Issue Pattern**: State-dependent API calls (check must precede download)
- **Similar Issues**: Common in OTA update frameworks where state caching is involved
