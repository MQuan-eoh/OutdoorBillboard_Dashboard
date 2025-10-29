# Hướng dẫn Toàn diện: Xây dựng Desktop App Hiện đại

**Mục đích tài liệu:** Dạy khái niệm, kiến trúc, workflow của một ứng dụng desktop (desktop app) hiện đại từ cơ bản đến triển khai production — độc lập với bất kỳ dự án cụ thể nào.

**Lưu ý:** Tất cả các thuật ngữ kỹ thuật giữ bằng tiếng Anh theo chuẩn industry; phần giải thích bằng tiếng Việt.

---

## Mục lục

1. [Giới thiệu & Định nghĩa](#giới-thiệu--định-nghĩa)
2. [Các thành phần chính](#các-thành-phần-chính)
3. [Các file JSON & vai trò](#các-file-json--vai-trò)
4. [Workflow phát triển → Production](#workflow-phát-triển--production)
5. [Ví dụ minh hoạ thực tế](#ví-dụ-minh-hoạ-thực-tế)
6. [Edge cases & Bẫy thường gặp](#edge-cases--bẫy-thường-gặp)
7. [Checklist & Best practices](#checklist--best-practices)

---

## 1. Giới thiệu & Định nghĩa

### Desktop App là gì?

**Desktop App** (ứng dụng desktop) là chương trình chạy trên máy tính của người dùng (Windows/macOS/Linux), có khả năng:

- Truy cập hệ thống tệp (file system)
- Tương tác với hệ điều hành (OS integrations)
- Giao tiếp với phần cứng
- Hoạt động offline (không phụ thuộc internet)
- Cập nhật tự động (auto-update)

**Khác biệt với Web App:**

- Web app: chạy trong browser, phụ thuộc server, truy cập giới hạn tài nguyên máy.
- Desktop app: toàn quyền truy cập máy, nhanh hơn, responsive hơn.

### Các kỹ thuật xây dựng Desktop App hiện đại

Ngày nay, một số framework phổ biến:

- **Electron:** dùng web tech (HTML/CSS/JS) để xây UI, Node.js + Chromium backend — _cross-platform_
- **NW.js:** tương tự Electron, ít phổ biến hơn
- **Qt (C++):** native, mạnh mẽ, tập hợp con nó
- **WPF (C#, Windows):** native Windows only
- **Swift/Cocoa:** native macOS
- **GTK/wxWidgets:** Linux native

**Lợi ích Electron:**

- Một codebase cho 3 nền tảng (Windows/macOS/Linux)
- Web skill (HTML/CSS/JS) → desktop app
- Lớn community, nhiều libraries

---

## 2. Các thành phần chính

Một desktop app (đặc biệt Electron) bao gồm các tầng:

### 2.1 Renderer Process (Tầng UI)

**Chức năng:**

- Hiển thị giao diện (UI) — html/css/javascript
- Xử lý tương tác người dùng (click, input, scroll)
- Render (vẽ) lên màn hình

**Công nghệ:**

- HTML5 + CSS3 + JavaScript (vanilla hoặc React/Vue/Angular)
- DOM API, event listeners
- Canvas, WebGL (for graphics)

**Đặc điểm:**

- Chạy trong "sandboxed" Chromium context
- Không có quyền truy cập Node.js hoặc OS APIs trực tiếp (bảo mật)
- Giao tiếp với Main process qua **IPC** (Inter-Process Communication)

**Ví dụ:**

```html
<!-- app.html (Renderer) -->
<button id="updateBtn">Kiểm tra cập nhật</button>
<script>
  document.getElementById("updateBtn").addEventListener("click", () => {
    // Không thể gọi trực tiếp updateApp() nếu nó dùng native API
    // Thay vào đó: gửi message qua IPC
    window.ipcRenderer.send("request:check-update");
  });
</script>
```

### 2.2 Main Process (Controller / Background)

**Chức năng:**

- Quản lý vòng đời app (lifecycle)
- Tạo windows (BrowserWindow)
- Xử lý native APIs:
  - File system (read/write files)
  - Network requests
  - Database
  - Auto-start, tray icon
  - Auto-update
- Xử lý IPC messages từ Renderer

**Đặc điểm:**

- Chỉ có 1 main process cho toàn app
- Chạy 1 lần từ start → quit
- Có toàn quyền truy cập Node.js + Electron APIs

**Ví dụ (Main process):**

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');

app.on('ready', () => {
  // Tạo window
  const win = new BrowserWindow({...});
  win.loadFile('app.html');

  // Lắng nghe IPC message từ renderer
  ipcMain.handle('request:check-update', async () => {
    // Đây là main process, có quyền gọi native APIs
    const updateInfo = await checkUpdateFromServer();
    return updateInfo;
  });
});
```

### 2.3 Preload Script (Secure Bridge)

**Chức năng:**

- "Cầu nối an toàn" giữa Renderer và Main process
- Expose (cung cấp) **một số hạn chế** của Node APIs cho Renderer (không toàn bộ)
- Chạy trong Renderer context nhưng có access vào Node

**Lý do tồn tại:**

- Bảo mật: Renderer không thể gọi tùy ý native code
- Chỉ allow những functions được explicitly expose
- Tránh lỗ hổng (XSS hoặc malicious script inject)

**Ví dụ (Preload):**

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Expose "safe" API cho Renderer
contextBridge.exposeInMainWorld("myApp", {
  checkUpdate: () => ipcRenderer.invoke("request:check-update"),
  onUpdateProgress: (callback) => {
    ipcRenderer.on("update:progress", (event, data) => callback(data));
  },
});
```

**Ở Renderer:**

```javascript
// app.html
<script>
  // Renderer có thể gọi myApp.checkUpdate() an toàn
  window.myApp.checkUpdate().then(info => console.log(info));
</script>
```

### 2.4 Data Storage & State Management

**Lựa chọn lưu trữ:**

| Loại              | Công dụng                  | Ví dụ                      |
| ----------------- | -------------------------- | -------------------------- |
| **JSON files**    | Config, simple data        | settings.json, config.json |
| **SQLite**        | Structured data, queries   | user database, logs        |
| **LevelDB**       | Key-value, fast reads      | cache                      |
| **IndexedDB**     | Browser-like DB ở Renderer | app state, offline data    |
| **Secrets vault** | Encrypt sensitive data     | API tokens, passwords      |

**Quy ước tổ chức:**

- **Config:** user-editable preferences, API endpoints → `~/.config/app/` (Linux/macOS) hoặc `%APPDATA%/app/` (Windows)
- **Cache:** auto-generated, có thể xóa mà không ảnh hưởng → `~/.cache/app/`
- **Secrets:** encrypt, never in repo → stored ở environment variables hoặc secure storage

### 2.5 Packaging & Installer

**Mục tiêu:** Từ source code → end-user executable (installer).

**Công cụ phổ biến:**

- **electron-builder:** chính thức, supports win/mac/linux, tạo NSIS installer (Windows), DMG (macOS), AppImage/DEB/RPM (Linux)
- **NSIS:** Windows installer framework
- **Packaging tools:** dpkg (Debian), rpm (RedHat), pkg (macOS)

**Artifacts (Đầu ra):**

- **Full installer:** cài toàn bộ app (lần đầu hoặc reinstall)
- **Portable version:** chạy không cần cài (Windows)
- **Delta update:** chỉ file/thư viện thay đổi (tiết kiệm bandwidth)

**Workflow:**

```
source code
    ↓
compile + bundle (webpack/rollup)
    ↓
sign binaries (code signing)
    ↓
electron-builder package
    ↓
[installer.exe] [app.dmg] [app.AppImage]
```

### 2.6 Auto-update (OTA - Over The Air)

**Chức năng:**

- Client (desktop app) định kỳ hoặc on-demand kiểm tra phiên bản mới
- So sánh với server metadata
- Nếu có bản mới: download, verify, install, restart

**Cơ chế chính:**

- App chứa bản hiện tại trong `package.json` → version 1.2.0
- Server (GitHub Releases, S3, etc.) cung cấp metadata → latest version 1.3.0
- Nếu 1.3.0 > 1.2.0 → download installer/delta
- Verify checksum/signature
- Khi user quit → install bản mới

**Libraries thường dùng:**

- **electron-updater:** official, support GitHub Releases, S3, generic HTTP host
- **electron-builder (built-in):** auto-update capabilities

**Ví dụ flow (code-level):**

```javascript
// main.js
const { autoUpdater } = require("electron-updater");

// Khởi tạo
autoUpdater.checkForUpdatesAndNotify();

// Hoặc kiểm tra thủ công khi user yêu cầu
autoUpdater.checkForUpdates().then((result) => {
  if (result.updateInfo.version > currentVersion) {
    // Download in background
    autoUpdater.downloadUpdate();
  }
});

// Khi download xong
autoUpdater.on("update-downloaded", () => {
  // Cài bản mới khi quit
  autoUpdater.quitAndInstall();
});
```

### 2.7 Telemetry, Logging & Crash Reporting

**Telemetry (Phân tích sử dụng):**

- Thu thập dữ liệu: người dùng dùng features nào, lỗi nào xảy ra
- Công cụ: Sentry, Mixpanel, custom analytics

**Logging (Ghi nhật ký):**

- Debug level → Error level: ghi chi tiết xảy ra trong app
- Local logs (file) hoặc remote (aggregator)
- Levels: DEBUG, INFO, WARN, ERROR, CRITICAL

**Crash Reporting:**

- Khi app crash → gửi stack trace + context tới server
- Team debug và fix nhanh hơn

**Privacy & Compliance:**

- Tuân theo GDPR/privacy rules
- Opt-in/opt-out telemetry
- Không collect PII (personally identifiable info) nếu không cần

### 2.8 Security & Code Signing

**Code Signing (Ký mã):**

- Ký installer/binary bằng private key của developer
- OS (Windows/macOS) kiểm tra chữ ký trước khi run
- Tránh tampering (sửa đổi malicious)

**Cách thức:**

- **Windows (Authenticode):** Kiểm tra digital certificate, smart screen, UAC
- **macOS (Gatekeeper):** Notarize app (scan cho malware), verify signature
- **Linux:** Package signed (if distro provides) hoặc GPG signature

**Secrets Management:**

- Private signing key: KHÔNG commit vào repo
- Lưu ở CI/CD secrets (GitHub Secrets, GitLab CI secrets)
- CI pipeline sử dụng secret để sign release

---

## 3. Các file JSON & vai trò

### 3.1 package.json (Project Metadata & Config)

**Chức năng:** Định nghĩa metadata project, dependencies, scripts, build config.

**Ví dụ:**

```json
{
  "name": "my-desktop-app",
  "version": "1.2.3",
  "description": "A sample desktop application",
  "author": "Company",
  "main": "main.js",
  "homepage": "https://example.com",

  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "dev": "electron-builder --dir"
  },

  "dependencies": {
    "electron-updater": "^6.0.0",
    "mqtt": "^4.0.0"
  },

  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest"
  },

  "build": {
    "appId": "com.example.myapp",
    "productName": "My App",
    "directories": {
      "buildResources": "assets",
      "output": "dist"
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "publish": [
      {
        "provider": "github",
        "owner": "mycompany",
        "repo": "my-app"
      }
    ]
  }
}
```

**Key fields:**

- **version:** Semantic versioning (MAJOR.MINOR.PATCH) — 1.2.3 = major=1, minor=2, patch=3
- **main:** Entry point (main.js)
- **scripts:** npm run commands
- **dependencies/devDependencies:** Package requirements
- **build.publish:** Nơi publish release (GitHub, S3, etc.)

### 3.2 config.json (Runtime Configuration)

**Chức năng:** Cấu hình app tại runtime (có thể thay đổi mà không rebuild).

**Ví dụ:**

```json
{
  "apiBase": "https://api.example.com",
  "apiTimeout": 30000,
  "enableTelemetry": true,
  "logLevel": "info",
  "features": {
    "darkMode": true,
    "autoUpdate": true,
    "offlineMode": false
  },
  "database": {
    "host": "localhost",
    "port": 5432
  }
}
```

**Quy ước:**

- Có default config (ship với app)
- User có thể override ở `~/.config/app/config.json`
- Merge: local config + defaults

### 3.3 manifest.json (App Manifest)

**Chức năng:** Mô tả app cho hệ thống hoặc admin panel.

**Ví dụ (Web manifest style):**

```json
{
  "name": "My Desktop App",
  "short_name": "MyApp",
  "version": "1.2.3",
  "description": "A productive tool",
  "icons": [
    { "src": "icon-16.png", "sizes": "16x16" },
    { "src": "icon-256.png", "sizes": "256x256" }
  ],
  "start_url": "app.html",
  "display": "standalone",
  "permissions": ["file", "network"]
}
```

**Hoặc (App manifest kiểu admin):**

```json
{
  "id": "app-v1-2-3",
  "name": "My App",
  "version": "1.2.3",
  "releaseDate": "2025-01-15",
  "checksum": "abc123def456",
  "downloadUrl": "https://releases.example.com/app-1.2.3.exe",
  "minSupportedVersion": "1.0.0",
  "breakingChanges": ["removed feature X", "API endpoint changed"]
}
```

### 3.4 settings.json (User Preferences)

**Chức náng:** Lưu trữ tuỳ chọn người dùng (theme, language, layout).

**Ví dụ:**

```json
{
  "theme": "dark",
  "language": "vi",
  "autoLaunch": true,
  "windowSize": { "width": 1280, "height": 720 },
  "notifications": { "enabled": true, "sound": true }
}
```

**Vị trí lưu:**

- Linux/macOS: `~/.config/app/settings.json`
- Windows: `%APPDATA%\app\settings.json`

### 3.5 env.json & .env (Environment Variables)

**Chức năng:** Biến môi trường riêng cho dev vs production (KHÔNG commit secrets).

**Ví dụ .env file (dev):**

```
API_BASE=http://localhost:3000
DEBUG=true
LOG_LEVEL=debug
GITHUB_TOKEN=your_token_here_dev_only
```

**Ví dụ .env file (production):**

```
API_BASE=https://api.example.com
DEBUG=false
LOG_LEVEL=info
# GITHUB_TOKEN không có ở đây; sử dụng CI secret thay thế
```

**Best practice:**

- KHÔNG commit `.env` với secrets
- Commit `.env.example` (với placeholder)
- CI pipeline inject secrets via environment variables

### 3.6 locales.json (Dịch - i18n)

**Chức năng:** Chứa translations cho app.

**Ví dụ:**

```json
{
  "en": {
    "home.title": "Welcome",
    "home.description": "Click to start",
    "settings.language": "Language"
  },
  "vi": {
    "home.title": "Chào mừng",
    "home.description": "Nhấn để bắt đầu",
    "settings.language": "Ngôn ngữ"
  }
}
```

**Hoặc theo cấu trúc folder:**

```
locales/
  en.json
  vi.json
  de.json
```

---

## 4. Workflow phát triển → Production

Quá trình đưa app từ code lên máy user cuối:

### Bước 1: Development (Development phase)

**Hoạt động:**

- Developer: write code, test locally
- Run app: `npm start` (development mode)
- Hot reload enabled (auto-reload khi code thay đổi)
- Debug tools available (DevTools)

**Example:**

```powershell
# Terminal - Windows
npm install
npm start
# App starts, DevTools open for debugging
```

### Bước 2: Versioning & Git tag

**Lưu ý:**

- Khi sẵn sàng release → bump version (package.json)
- Version theo Semantic Versioning: MAJOR.MINOR.PATCH
  - MAJOR: breaking changes
  - MINOR: new features (backward compatible)
  - PATCH: bug fixes
- Git tag (v1.2.3) để mark release point

**Example:**

```bash
# Tại repo root
# 1. Edit package.json: version "1.2.3" → "1.3.0"
# 2. Commit
git add package.json
git commit -m "bump: v1.3.0"

# 3. Tag và push
git tag v1.3.0
git push origin main --tags
```

### Bước 3: CI/CD Pipeline (Automated Build)

**Trigger:** Tag push → CI system (GitHub Actions, GitLab CI, etc.) start job

**CI Steps:**

```yaml
# Pseudo GitHub Actions workflow
name: Build Release
on:
  push:
    tags:
      - "v*"

jobs:
  build:
    runs-on: windows-latest # or macos-latest, ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci # Clean install from lock file
      - run: npm run build:renderer # Build UI
      - run: npm run test # Run tests
      - run: npx electron-builder -w # Windows build
      - uses: softprops/action-gh-release@v1
        with:
          files: dist/** # Upload artifacts to GitHub Releases
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Đầu ra (Artifacts):**

- `app-1.3.0.exe` (Windows installer)
- `app-1.3.0.dmg` (macOS)
- `app-1.3.0.AppImage` (Linux)
- `latest.yml` (metadata + checksums)
- Delta updates (`.blockmap`, patches)

### Bước 4: Code Signing (Security)

**Mục đích:** Đảm bảo binary không bị tampering, OS tin tưởng.

**Process:**

- Cấp certificate (signing key) từ trusted authority
- Lưu private key ở CI secret (KHÔNG commit)
- CI pipeline: sign binary trước upload

**Example (Windows Authenticode in CI):**

```yaml
# GitHub Actions
- name: Sign Windows Build
  run: |
    # Sử dụng certificate từ secret
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    $cert.Import([System.Convert]::FromBase64String(${{ secrets.WIN_SIGNING_CERT }}), ${{ secrets.WIN_CERT_PASSWORD }})
    signtool sign /f cert.pfx /p ${{ secrets.WIN_CERT_PASSWORD }} app-1.3.0.exe
```

### Bước 5: Publish Release

**Host options:**

- **GitHub Releases** (free, integrated with GitHub)
- **S3 + CloudFront** (CDN, scalable)
- **Private update server** (self-hosted)

**GitHub Releases (easiest):**

- CI automatic: create release on tag, upload artifacts
- URL: `https://github.com/owner/repo/releases/tag/v1.3.0`
- electron-updater auto-fetch from GitHub Releases

**Example (latest.yml generated by electron-builder):**

```yaml
version: 1.3.0
files:
  - url: app-1.3.0.exe
    sha512: abc123...
    size: 125000000
  - url: app-1.3.0.exe.blockmap
    sha512: def456...
    size: 500000
path: app-1.3.0.exe
sha512: abc123...
releaseDate: "2025-01-15T10:00:00.000Z"
```

### Bước 6: Client Update Flow

**User máy có app v1.2.0, server có v1.3.0**

```
App (v1.2.0) running
  ↓
checkForUpdates()
  ↓
[Fetch latest.yml from server]
  ↓
Compare: v1.3.0 > v1.2.0 → YES
  ↓
downloadUpdate()
  ↓
[Download .exe]
  ↓
verifyChecksum() → OK
  ↓
User closes app / schedules install
  ↓
[Install v1.3.0]
  ↓
App restart → v1.3.0 running
```

**Lợi ích Delta updates:**

- Instead download full 150MB installer → download only 5MB delta
- Nhanh hơn, tiết kiệm bandwidth

### Bước 7: Monitoring & Alerting

**Post-release:**

- Monitor crash rates (Sentry, Rollbar)
- Check user feedback
- Logs aggregation (stack traces, errors)

**Nếu vấn đề:**

- Issue 1: Critical bug → publish v1.3.1 hotfix immediately
- Issue 2: Many crashes → disable auto-update, serve v1.2.0 lại (rollback)
- Issue 3: Data corruption → release migration script

### Bước 8: Rollback Strategy

**Rollback:** Khôi phục về bản cũ an toàn.

**Methods:**

1. **Re-publish old version:** update server serve v1.2.0 as latest
2. **Allowlist approach:** server maintain list of approved versions → client only allow those
3. **Quick hotfix:** release v1.3.1 ngay khi phát hiện v1.3.0 có vấn đề

**Data migration rollback:**

- Luôn backup dữ liệu user trước migration
- Cung cấp restore script

---

## 5. Ví dụ minh hoạ thực tế

### Ví dụ 1: Simple Auto-update Flow

**Scenario:** App v1.0 user muốn update lên v1.1

```
package.json (v1.0):
  "version": "1.0.0",
  "build": {
    "publish": [{ "provider": "github", "owner": "acme", "repo": "my-app" }]
  }

↓ Developer:
  1. Thay đổi code
  2. Bump version → "1.1.0"
  3. Commit + Tag v1.1.0
  4. git push --tags

↓ GitHub Actions (CI):
  1. Detect tag v1.1.0
  2. npm ci && npm run build
  3. npx electron-builder -w
  4. Upload artifacts to GitHub Releases/v1.1.0

↓ Latest.yml:
  version: 1.1.0
  path: my-app-1.1.0.exe
  sha512: xxxxx

↓ User App (v1.0):
  1. checkForUpdatesAndNotify()
  2. Fetch https://github.com/acme/my-app/releases/download/v1.1.0/latest.yml
  3. Parse version: 1.1.0 > 1.0.0 → Update available
  4. Download my-app-1.1.0.exe
  5. Verify checksum
  6. Schedule install on quit
  7. Restart → v1.1.0

Result: User app auto-updated ✓
```

### Ví dụ 2: Remote-triggered Update (Admin Command)

**Scenario:** Admin control panel (admin-web) remote trigger device update

```
Architecture:
  Desktop App (Renderer + Main)
    ↓ MQTT subscribe
  MQTT Broker (command topic: its/billboard/commands)
    ↑ MQTT publish
  Admin-web UI (publish "force_update" command)

Flow:
  1. Admin-web: User click "Force Update"
  2. Admin-web publish: Topic="its/billboard/commands", Message="force_update"
  3. Desktop App Main process listen on topic
  4. Receive "force_update" → trigger autoUpdater.checkForUpdates()
  5. Even if not schedule, app check now
  6. If new version → download + install
  7. Desktop App publish status: "update_downloading" → 50% → "update_installing" → "update_complete"
  8. Admin-web subscribe to status topic, show progress

Result: Admin trigger, device auto-update ✓
```

### Ví dụ 3: Rollback on Critical Error

**Scenario:** Release v2.0 causes crash, rollback to v1.9.5

```
Timeline:
  Day 1: Release v2.0
  Day 2: Monitor show 40% crash rate (vs 2% normal)
  Day 3: Team root-cause: bug in config parsing

Options:
  A) Publish v2.0.1 hotfix (fast if simple fix)
  B) Serve v1.9.5 as latest (fast if bug complex)

Implementation (Option B):
  1. Server admin: edit manifest → set version: 1.9.5 as "latest"
  2. Update server rebuild latest.yml
  3. Users on v2.0 call checkForUpdates()
  4. Get latest.yml → version 1.9.5 < 2.0 → "No update"
  5. BUT: if client can detect "version not in allowlist", trigger rollback
  6. Download v1.9.5, install → rollback complete

Timeline rollback:
  Day 3 afternoon: Decision + hotfix code
  Day 3 evening: Publish v2.0.1 or switch to v1.9.5
  Day 4 morning: Monitor crash rate ↓ back to normal

Result: Minimal user impact ✓
```

### Ví dụ 4: Config & Secrets Management

**Scenario:** API keys for different environments

```
Dev environment:
  package.json: version = 1.0.0-dev
  .env.local: API_KEY=dev_key_12345, DEBUG=true
  ~/.config/app/config.json: apiBase=http://localhost:3000

Production environment:
  package.json: version = 1.0.0
  (GitHub Actions secret) API_KEY=prod_key_abcde (set via GITHUB_TOKEN)
  Release artifact config.json: apiBase=https://api.prod.example.com

CI build:
  npm ci
  # Inject secrets
  echo "API_KEY=${{ secrets.API_KEY }}" > .env.production
  npm run build
  electron-builder
  # .env.production never commit, CI auto-inject

Result: Secrets safe, no hardcode ✓
```

---

## 6. Edge cases & Bẫy thường gặp

### 6.1 Download bị gián đoạn (Network interruption)

**Problem:**

- User download update 500MB, đến 300MB thì mất internet
- Bắt đầu lại từ 0 → lãng phí bandwidth

**Solution:**

- **Resumable downloads:** HTTP Range header support
- **Partial file validation:** verify downloaded chunks
- **Retry logic:** exponential backoff
- **Delta updates:** only changed files

**Code example:**

```javascript
autoUpdater.on("download-progress", (progress) => {
  console.log(`Downloaded ${progress.percent}%`);
});

// electron-updater tự hỗ trợ resumable downloads
```

### 6.2 Checksum validation fail

**Problem:**

- Downloaded file corrupted hoặc tampered
- Kiểm tra checksum fail → abort install

**Solution:**

- Always verify: SHA512 hash, GPG signature
- If fail → delete file, retry download
- If retry fail multiple times → alert user, don't install

**Code example:**

```javascript
const crypto = require("crypto");

function verifyChecksum(filePath, expectedSha512) {
  const hash = crypto.createHash("sha512");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  const computed = hash.digest("hex");

  if (computed !== expectedSha512) {
    throw new Error("Checksum mismatch!");
  }
}
```

### 6.3 Platform-specific installer quirks

**Problem:**

- Windows UAC prompt → user có thể cancel
- macOS notarization fail → Gatekeeper block
- Linux permission issue → package manager conflict

**Solutions:**

- **Windows:** Bundle as NSIS (supports silent install), test UAC scenario
- **macOS:** Sign + notarize early, test with different user accounts
- **Linux:** Support multiple package formats (DEB, RPM, AppImage)

### 6.4 Database migration on update

**Problem:**

- v1.0 → v2.0: database schema change
- User data incompatible, can crash on open

**Solution:**

- Implement migration script in app
- Backup data before migration
- Provide rollback migration (v2.0 → v1.9)

**Example:**

```javascript
// app startup
async function initDatabase() {
  const currentVersion = getStoredSchemaVersion(); // e.g., 1
  const targetVersion = 2;

  if (currentVersion < targetVersion) {
    console.log(`Migrating DB from v${currentVersion} to v${targetVersion}`);
    await backupDatabase();

    if (currentVersion === 1 && targetVersion === 2) {
      await migratev1Tov2();
    }

    storeSchemaVersion(targetVersion);
  }

  openDatabase();
}

async function migratev1Tov2() {
  // Add new column, rename tables, etc.
  const db = sqlite3.open("app.db");
  await db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
}
```

### 6.5 Hardcoded secrets in binary

**Problem:**

- API key hardcoded vào source → commit to repo → public on GitHub
- Anyone can use key, call API with your quota

**Solution:**

- NEVER hardcode secrets
- Use environment variables (CI inject)
- Use secure storage API (OS keychain for passwords)
- Rotate secrets immediately if leaked

**Good practice:**

```javascript
// ❌ WRONG
const API_KEY = "sk-1234567890abcdef"; // NEVER

// ✅ CORRECT
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY not set");
```

### 6.6 Preload context isolation bypass

**Problem:**

- Preload script bị XSS inject → attacker gain access to Node APIs
- Could read files, execute code

**Solution:**

- Enable `contextIsolation: true` in BrowserWindow
- Use `contextBridge.exposeInMainWorld()` explicitly
- Validate all inputs from renderer
- Use Content Security Policy (CSP)

**Good practice:**

```javascript
// main.js
const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true, // ✓ Isolate renderer
    enableRemoteModule: false,
    nodeIntegration: false,
    preload: path.join(__dirname, "preload.js"),
  },
});

// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// ✓ Expose ONLY what needed
contextBridge.exposeInMainWorld("api", {
  getData: () => ipcRenderer.invoke("get-data"),
  // NOT exposing fs, require, eval, etc.
});
```

---

## 7. Checklist & Best practices

### 7.1 Pre-release Checklist

- [ ] **Code review:** all changes reviewed
- [ ] **Tests pass:** unit + integration tests green
- [ ] **Build clean:** no compilation errors/warnings
- [ ] **Lint pass:** code style consistent
- [ ] **Dependencies updated:** `npm audit` no high vulnerabilities
- [ ] **Version bumped:** package.json + git tag match
- [ ] **Changelog updated:** document breaking changes
- [ ] **Signing keys ready:** certificates not expired
- [ ] **Monitoring configured:** Sentry/Rollbar ready
- [ ] **Rollback plan documented:** know how to revert if needed

### 7.2 Deployment Checklist

- [ ] **Artifacts signed:** Windows (Authenticode), macOS (notarized)
- [ ] **Release metadata valid:** latest.yml, checksums correct
- [ ] **Release published:** visible on GitHub/S3/host
- [ ] **CDN warmed:** cache populated (if applicable)
- [ ] **Status page updated:** communicate release
- [ ] **Monitoring active:** watch crash rates, errors
- [ ] **Runbook available:** incident response documented

### 7.3 Post-release Checklist

- [ ] **Early telemetry:** collect initial error reports
- [ ] **User feedback:** monitor support channels
- [ ] **Crash rates:** compare vs previous release
- [ ] **Performance:** latency, memory usage
- [ ] **Rollback trigger decided:** if > X% increase in crashes → rollback?
- [ ] **Runbook execution:** if issue detected → follow steps
- [ ] **Post-mortem:** if incident → document root cause + fix

### 7.4 Best practices

1. **Version everything:** git tags, semantic versioning
2. **Automate build:** CI/CD pipeline, no manual steps
3. **Sign releases:** code signing, verify signatures
4. **Test updates:** locally test full update flow before production
5. **Monitor always:** crash reports, performance metrics
6. **Rollback ready:** quick procedure to revert if needed
7. **Document:** runbooks, troubleshooting guide
8. **Secure secrets:** never hardcode, use CI secret management
9. **Cross-platform test:** build/test for Windows, macOS, Linux
10. **User communication:** changelog, migration guide if breaking changes

---

## 8. Tài liệu & Lệnh tham khảo

### Tài liệu chính thức

| Công nghệ           | URL                                    |
| ------------------- | -------------------------------------- |
| Electron            | https://www.electronjs.org/docs        |
| electron-builder    | https://www.electron.build/            |
| electron-updater    | https://www.electron.build/auto-update |
| GitHub Actions      | https://docs.github.com/actions        |
| Semantic Versioning | https://semver.org/                    |

### Lệnh thường dùng (tham khảo)

```powershell
# Setup & Dev
npm install
npm start                      # Run in dev mode

# Build
npm run build:renderer         # Build UI (if separate step)
npx electron-builder -w        # Windows build
npx electron-builder -m        # macOS build
npx electron-builder -l        # Linux build

# Release
git tag v1.2.3
git push origin main --tags    # Trigger CI to build release

# Testing
npm run test                   # Unit tests
npm run test:e2e               # End-to-end tests
```

### Glossary (Thuật ngữ kỹ thuật)

| Term               | Định nghĩa                                                            |
| ------------------ | --------------------------------------------------------------------- |
| **IPC**            | Inter-Process Communication — giao tiếp giữa Renderer và Main process |
| **BrowserWindow**  | Electron object đại diện cho window của app                           |
| **Preload**        | Script chạy trước Renderer, có access Node APIs                       |
| **Packaging**      | Tạo installer/binary từ source code                                   |
| **Auto-update**    | Mechanism cập nhật app tự động                                        |
| **Delta update**   | Chỉ tải file thay đổi, không full app                                 |
| **Checksum**       | Hash giá trị để verify file integrity                                 |
| **Code signing**   | Ký mã bằng private key → OS trust                                     |
| **Notarization**   | macOS: Apple scan app cho malware                                     |
| **Rollback**       | Khôi phục về bản trước đó                                             |
| **Sentry/Rollbar** | Crash reporting services                                              |
| **Telemetry**      | Thu thập dữ liệu sử dụng app                                          |
| **CI/CD**          | Continuous Integration/Delivery → automation                          |
| **OTA**            | Over-The-Air — cập nhật từ xa                                         |
| **MQTT**           | Lightweight messaging protocol for IoT                                |

---

## 9. Kết luận

Xây dựng desktop app hiện đại đòi hỏi:

1. **Hiểu kiến trúc:** Renderer (UI) ↔ Main (background) ↔ Preload (bridge)
2. **Quản lý release:** Git tags → CI build → sign → publish
3. **Auto-update:** client check server → download → verify → install
4. **Security:** sign code, manage secrets, context isolation
5. **Monitoring:** telemetry + crash reports + alerts
6. **Rollback plan:** biết cách revert nếu issue

**Key takeaway:** Tự động hóa tất cả (CI/CD), an toàn code (signing), giám sát (monitoring), sẵn sàng rollback (safety net).

---

**Tài liệu này được viết cho mục đích giáo dục — để dạy khái niệm tổng quát về desktop app, không phụ thuộc vào bất kỳ dự án cụ thể nào.**

**Last updated:** October 29, 2025
