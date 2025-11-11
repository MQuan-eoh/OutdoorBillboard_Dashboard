

## 1. E-Ra IoT MQTT API

### Mô tả

API MQTT để kết nối với hệ thống E-Ra IoT, nhận dữ liệu cảm biến thời gian thực.

### Thông số kết nối MQTT

- **Broker**: `mqtt1.eoh.io:1883`
- **Protocol**: MQTT over TCP
- **QoS**: 1 (At least once delivery)
- **Username**: `{gatewayToken}`
- **Password**: `{gatewayToken}`
- **Client ID**: `billboard_{gatewayToken}_{timestamp}`

### Topics MQTT

#### Subscribe Topics (Nhận dữ liệu)

```
eoh/chip/{gatewayToken}/config/{configId}/value
```

#### Publish Topics (Gửi lệnh)

```
its/billboard/commands
its/billboard/update/status
its/billboard/reset/status
its/billboard/update/ack
```

#### Command Broker (HiveMQ - cho admin-web)

```
wss://broker.hivemq.com:8884/mqtt
Topic: its/billboard/commands
```

### Định dạng Message

#### Dữ liệu cảm biến (Sensor Data)

```json
{
  "v": 25.5
}
// hoặc
{
  "temperature": 25.5
}
// hoặc giá trị trực tiếp
"25.5"
```

#### Lệnh từ admin-web

```json
{
  "action": "check_update",
  "source": "admin-web",
  "timestamp": 1234567890
}
```

#### Phản hồi trạng thái

```json
{
  "status": "update_available",
  "currentVersion": "1.0.0",
  "latestVersion": "1.1.0",
  "timestamp": 1234567890
}
```

### Mapping Config ID sang Sensor Type

```javascript
const sensorConfigs = {
  temperature: 145634,
  humidity: 145615,
  pm25: 145635,
  pm10: 145636,
};
```

### Cú pháp kết nối MQTT

```javascript
const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://mqtt1.eoh.io:1883", {
  username: gatewayToken,
  password: gatewayToken,
  clientId: `billboard_${gatewayToken}_${Date.now()}`,
  keepalive: 60,
  connectTimeout: 15000,
  clean: true,
});

// Subscribe to sensor data
client.subscribe(`eoh/chip/${gatewayToken}/config/+/value`, { qos: 1 });

// Handle incoming messages
client.on("message", (topic, message) => {
  const configIdMatch = topic.match(/\/config\/(\d+)\/value$/);
  if (configIdMatch) {
    const configId = parseInt(configIdMatch[1]);
    const value = parseEraValue(message.toString());
    // Process sensor data
  }
});
```

### Hàm parse giá trị E-Ra

```javascript
function parseEraValue(valueStr) {
  // Handle JSON format
  try {
    const data = JSON.parse(valueStr);
    if (data.v !== undefined) return parseFloat(data.v);
    if (data.value !== undefined) return parseFloat(data.value);
  } catch (e) {
    // Not JSON, try direct parsing
  }

  // Handle direct numeric values
  const numValue = parseFloat(valueStr.replace("+", ""));
  return isNaN(numValue) ? null : numValue;
}
```

## 3. Logo Manifest API (GitHub CDN)

### Mô tả

API để tải manifest logo từ GitHub CDN, quản lý banner công ty động.

### Cấu trúc Manifest

```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "settings": {
    "logoMode": "loop",
    "logoLoopDuration": 5
  },
  "logos": [
    {
      "id": "company-logo-001",
      "name": "Logo Công ty ABC",
      "filename": "logo-abc.png",
      "url": "https://cdn.github.com/logos/logo-abc.png",
      "size": "384x96",
      "type": "banner",
      "active": true,
      "priority": 1,
      "checksum": "abc123...",
      "uploadedAt": "2024-01-15T09:00:00Z"
    }
  ]
}
```

### API Endpoints

#### Lấy Manifest

```javascript
// Trong main process
const manifest = await axios.get(config.manifestUrl, {
  timeout: 15000,
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
});
```

#### Tải Logo

```javascript
const response = await axios({
  method: "GET",
  url: logo.url,
  responseType: "stream",
  timeout: 30000,
});
```

### IPC API (Electron)

#### Main Process APIs

```javascript
// Lấy manifest hiện tại
ipcMain.handle("get-logo-manifest", async () => {
  return currentManifest;
});

// Force sync manifest
ipcMain.handle("force-sync-manifest", async () => {
  return await logoManifestService.forceSync();
});

// Lấy trạng thái service
ipcMain.handle("get-manifest-status", async () => {
  return logoManifestService.getStatus();
});

// Khởi động lại service
ipcMain.handle("restart-manifest-service", async () => {
  await initializeLogoManifestService();
  return { success: true };
});
```

#### Renderer Process APIs

```javascript
// Lấy manifest
const manifest = await window.electronAPI.getLogoManifest();

// Force sync
const result = await window.electronAPI.forceSyncManifest();

// Lấy trạng thái
const status = await window.electronAPI.getManifestStatus();

// Khởi động lại service
await window.electronAPI.restartManifestService();

// Listen for updates
window.electronAPI.onLogoManifestUpdated((event, data) => {
  console.log("Manifest updated:", data);
});
```

### Download Banner API

```javascript
// Download single banner
const result = await window.electronAPI.downloadBanner({
  url: bannerUrl,
  filename: bannerFilename,
});

// IPC handler trong main process
ipcMain.handle("download-banner", async (event, bannerData) => {
  return await logoManifestService.downloadSingleBanner(
    bannerData.url,
    bannerData.filename
  );
});
```

## 4. Electron IPC APIs

### Config Management

```javascript
// Load config
const config = await window.electronAPI.getConfig();

// Save config
await window.electronAPI.saveConfig(updatedConfig);

// Listen for config updates
window.electronAPI.onConfigUpdated((event, config) => {
  // Handle config update
});
```

### E-Ra IoT Data APIs

```javascript
// Get current sensor data
const data = await window.electronAPI.getEraIotData();

// Refresh connection
await window.electronAPI.refreshEraIotConnection();

// Listen for data updates
window.electronAPI.onEraIotDataUpdate((event, data) => {
  // Handle sensor data update
});

// Listen for status updates
window.electronAPI.onEraIotStatusUpdate((event, status) => {
  // Handle connection status change
});
```

### Authentication APIs

```javascript
// Update auth token
await window.electronAPI.updateAuthToken(token);

// Get gateway token
const gatewayToken = await window.electronAPI.getGatewayToken();
```

### App Control APIs

```javascript
// Minimize window
await window.electronAPI.minimize();

// Close app
await window.electronAPI.close();

// Select logo files
const filePaths = await window.electronAPI.selectLogoFiles();
```

## 5. OTA Update APIs

### Electron Updater API

```javascript
const { autoUpdater } = require("electron-updater");

// Configure for GitHub releases
autoUpdater.setFeedURL({
  provider: "github",
  owner: "MinhQuan7",
  repo: "ITS_OurdoorBillboard-",
  releaseType: "release",
});

// Check for updates
await autoUpdater.checkForUpdates();

// Download update
await autoUpdater.downloadUpdate();

// Events
autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info.version);
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info.version);
  // Auto restart after download
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 1000);
});
```

### MQTT Command APIs cho OTA

```javascript
// Check for updates command
{
  "action": "check_update",
  "source": "admin-web",
  "timestamp": 1234567890
}

// Force update command
{
  "action": "force_update",
  "version": "1.1.0",
  "source": "admin-web",
  "timestamp": 1234567890
}

// Reset app command
{
  "action": "reset_app",
  "reason": "post_update",
  "timestamp": 1234567890
}
```

## 6. File System APIs

### Path Resolution API

```javascript
// Get app paths (packaged vs development)
const paths = await window.electronAPI.getAppPath();
// Returns:
// {
//   appPath: '/path/to/app',
//   logoBasePath: '/path/to/logos',
//   logoDownloadPath: '/downloads/logos',
//   isPackaged: true/false
// }
```

### Logo File Management

```javascript
// Select logo files via dialog
const filePaths = await window.electronAPI.selectLogoFiles();

// Download banner file
await window.electronAPI.downloadBanner({
  url: "https://cdn.example.com/logo.png",
  filename: "company-logo.png",
});
```

## 7. Error Handling & Logging

### API Error Responses

```javascript
// Standard error response format
{
  success: false,
  error: "Error message",
  code: "ERROR_CODE"
}

// Success response format
{
  success: true,
  data: { /* response data */ }
}
```

### Logging Levels

- `SUCCESS`: Operations completed successfully
- `ERROR`: Critical errors requiring attention
- `WARNING`: Non-critical issues
- `INFO`: General information
- `DEBUG`: Detailed debugging information

### Connection Status Codes

```javascript
const statusCodes = {
  connected: "Kết nối thành công",
  connecting: "Đang kết nối",
  error: "Lỗi kết nối",
  offline: "Mất kết nối",
  timeout: "Timeout kết nối",
};
```

## 8. Configuration Structure

### Main Config (config.json)

```json
{
  "logoMode": "loop",
  "logoImages": [],
  "logoLoopDuration": 5,
  "eraIot": {
    "enabled": true,
    "authToken": "token_here",
    "gatewayToken": "gateway_token",
    "baseUrl": "https://backend.eoh.io",
    "sensorConfigs": {
      "temperature": 145634,
      "humidity": 145615,
      "pm25": 145635,
      "pm10": 145636
    },
    "scaleConfig": {
      "scaleFactor": 0.1,
      "appliedSensors": {
        "temperature": false,
        "humidity": false,
        "pm25": false,
        "pm10": false
      }
    }
  },
  "logoManifest": {
    "enabled": true,
    "manifestUrl": "https://cdn.github.com/manifest.json",
    "pollInterval": 10,
    "downloadPath": "./downloads",
    "maxCacheSize": 50,
    "retryAttempts": 3,
    "retryDelay": 2000
  }
}
```

## 9. Testing APIs

### Weather API Test

```bash
node test-weather-api.js
```

### E-Ra MQTT Test

```bash
node test-era-mqtt-comprehensive.js
```

### Logo Manifest Test

```bash
node test-banner-logo-fix.js
```

### OTA Update Test

```bash
node test-ota-system.ps1
```

## 10. Troubleshooting

### Weather API Issues

- Check network connectivity
- Verify coordinates are correct
- Check API rate limits
- Validate timezone settings

### MQTT Connection Issues

- Verify gateway token is correct
- Check sensor config IDs
- Ensure broker is accessible
- Validate QoS settings

### Logo Manifest Issues

- Check manifest URL accessibility
- Verify CDN is responding
- Check file permissions
- Validate checksums

### IPC Communication Issues

- Ensure preload script is loaded
- Check contextBridge configuration
- Verify event listeners are attached
- Check for race conditions

---

_Tài liệu được tạo tự động từ phân tích codebase ITS Billboard. Cập nhật lần cuối: November 8, 2025_</content>
<parameter name="filePath">f:\EoH Company\ITS_OurdoorScreen\API-DOCUMENTATION.md
