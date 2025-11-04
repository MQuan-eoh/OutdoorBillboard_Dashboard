// preload.js - IPC Bridge for secure communication
const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Config operations
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  exitConfig: () => ipcRenderer.invoke("exit-config"),

  // File operations for logo management
  selectLogoFiles: () => ipcRenderer.invoke("select-logo-files"),

  // App control
  minimize: () => ipcRenderer.invoke("minimize-app"),
  close: () => ipcRenderer.invoke("close-app"),

  // Event listeners for config updates
  onConfigUpdated: (callback) => ipcRenderer.on("config-updated", callback),
  removeConfigListener: () => ipcRenderer.removeAllListeners("config-updated"),

  // Logo-specific config updates for immediate interval changes
  onLogoConfigUpdated: (callback) =>
    ipcRenderer.on("logo-config-updated", callback),
  removeLogoConfigListener: () =>
    ipcRenderer.removeAllListeners("logo-config-updated"),

  // Force service refresh handler for hot-reload
  onForceRefreshServices: (callback) =>
    ipcRenderer.on("force-refresh-services", callback),
  removeForceRefreshListener: () =>
    ipcRenderer.removeAllListeners("force-refresh-services"),

  // E-Ra IoT specific handlers
  updateEraIotConfig: (config) =>
    ipcRenderer.invoke("update-era-iot-config", config),
  onEraIotConfigUpdated: (callback) =>
    ipcRenderer.on("era-iot-config-updated", callback),

  // E-Ra IoT MQTT data handlers (NEW)
  getEraIotData: () => ipcRenderer.invoke("get-era-iot-data"),
  refreshEraIotConnection: () =>
    ipcRenderer.invoke("refresh-era-iot-connection"),
  onEraIotDataUpdate: (callback) =>
    ipcRenderer.on("era-iot-data-update", callback),
  onEraIotStatusUpdate: (callback) =>
    ipcRenderer.on("era-iot-status-update", callback),
  removeEraIotDataListener: () =>
    ipcRenderer.removeAllListeners("era-iot-data-update"),
  removeEraIotStatusListener: () =>
    ipcRenderer.removeAllListeners("era-iot-status-update"),

  // Authentication handlers
  updateAuthToken: (token) => ipcRenderer.invoke("update-auth-token", token),
  onAuthTokenUpdated: (callback) =>
    ipcRenderer.on("auth-token-updated", callback),
  // Convenience method: return parsed gateway token (without the "Token " prefix)
  getGatewayToken: () => ipcRenderer.invoke("get-gateway-token"),

  // Logo Manifest Service handlers (GitHub CDN Integration)
  getLogoManifest: () => ipcRenderer.invoke("get-logo-manifest"),
  forceSyncManifest: () => ipcRenderer.invoke("force-sync-manifest"),
  getManifestStatus: () => ipcRenderer.invoke("get-manifest-status"),
  restartManifestService: () => ipcRenderer.invoke("restart-manifest-service"),

  // Logo Manifest event listeners
  onLogoManifestUpdated: (callback) =>
    ipcRenderer.on("logo-manifest-updated", callback),
  removeLogoManifestListener: () =>
    ipcRenderer.removeAllListeners("logo-manifest-updated"),

  // Banner download operations
  downloadBanner: (url, filename) =>
    ipcRenderer.invoke("download-banner", url, filename),
});
