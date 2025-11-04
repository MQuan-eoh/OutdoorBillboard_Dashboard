# OTA System and GitHub Release Issues Analysis & Fixes

## Issues Identified

### 1. GitHub Actions Build Workflow Issues

**Problem**: File pattern mismatches in `build-release.yml`

- Build produces: `ITS Billboard Setup 1.0.2.exe`
- Workflow expects: `dist/ITS-Billboard-*.exe`
- Workflow pattern `dist/ITS-Billboard-*.nsis.exe` doesn't match anything
- Pattern `dist/*.yml` should be `dist/latest.yml`

**Root Cause**:

- Inconsistent naming between electron-builder config and workflow patterns
- NSIS installer uses default Windows naming convention
- Portable executable uses different naming pattern

### 2. GitHub Token Permission Issues

**Error**: "Resource not accessible by integration"

- Default `GITHUB_TOKEN` has limited permissions in some repository configurations
- Cannot create releases or upload assets without proper permissions

### 3. Electron-Updater Configuration Problems

**Issues**:

- File URL patterns don't match between build output and updater expectations
- `latest.yml` references wrong filename
- Auto-updater expects different file naming convention

## Fixes Applied

### 1. Updated Build Workflow (`build-release.yml`)

```yaml
# Fixed file patterns to match actual build output
files: |
  dist/ITS-Billboard-Setup-*.exe
  dist/ITS-Billboard-Portable-*.exe
  dist/latest.yml

# Added explicit permissions
permissions:
  contents: write
```

### 2. Updated Package.json Build Configuration

```json
"nsis": {
  "artifactName": "ITS-Billboard-Setup-${version}.exe"
},
"portable": {
  "artifactName": "ITS-Billboard-Portable-${version}.exe"
}
```

### 3. Updated latest.yml

```yaml
version: 1.0.2
files:
  - url: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases/download/v1.0.2/ITS-Billboard-Setup-1.0.2.exe
path: ITS-Billboard-Setup-1.0.2.exe
releaseDate: "2025-11-04T00:00:00.000Z"
```

### 4. Simplified Auto-Updater Configuration in main.js

Removed complex filename overrides that were causing conflicts.

## Expected Build Output After Fixes

When you run `npm run build:nsis`, you should now get:

- `dist/ITS-Billboard-Setup-1.0.2.exe` (NSIS installer)
- `dist/ITS-Billboard-Portable-1.0.2.exe` (Portable executable)
- `dist/latest.yml` (Auto-updater metadata)

## Testing Steps

### 1. Test Local Build

```powershell
npm run build:renderer
npm run build:nsis
```

### 2. Verify File Output

Check `dist/` folder contains:

- `ITS-Billboard-Setup-1.0.2.exe`
- `ITS-Billboard-Portable-1.0.2.exe`
- `latest.yml`

### 3. Test GitHub Release

1. Create a new tag: `git tag v1.0.3`
2. Push tag: `git push origin v1.0.3`
3. Monitor GitHub Actions workflow
4. Verify release assets are uploaded correctly

### 4. Test OTA Update

1. Deploy older version on test machine
2. Use admin-web to trigger OTA update
3. Verify download and installation works

## Additional Recommendations

### 1. GitHub Token Setup

If permission issues persist:

1. Create Personal Access Token with `repo` scope
2. Add as repository secret named `GH_PAT`
3. Update workflow to use: `${{ secrets.GH_PAT }}`

### 2. Auto-Updater Debugging

Add logging in main.js:

```javascript
autoUpdater.logger = console;
autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
});
```

### 3. Version Increment Strategy

For future releases:

1. Update `version` in `package.json`
2. Update `latest.yml` version and URLs
3. Create git tag matching version
4. Let GitHub Actions handle the build

### 4. Admin-Web OTA Configuration

Ensure admin-web update service points to correct GitHub release URLs:

- Use setup executable for OTA updates
- Match version patterns between client and server

## File Naming Convention Summary

| Build Type            | Old Pattern                             | New Pattern                             |
| --------------------- | --------------------------------------- | --------------------------------------- |
| NSIS Installer        | `ITS-Billboard.exe`                     | `ITS-Billboard-Setup-${version}.exe`    |
| Portable              | `ITS-Billboard-${version}-portable.exe` | `ITS-Billboard-Portable-${version}.exe` |
| Auto-updater metadata | `latest.yml`                            | `latest.yml` (unchanged)                |

## OTA Update Flow

1. Admin-web sends MQTT command with target version
2. Desktop app receives command via MQTT
3. Electron-updater checks GitHub releases for matching version
4. Downloads `ITS-Billboard-Setup-${version}.exe`
5. Installs update and restarts application
6. Reports success/failure via MQTT

This standardized approach should resolve all the file pattern matching issues and make the OTA system work reliably.
