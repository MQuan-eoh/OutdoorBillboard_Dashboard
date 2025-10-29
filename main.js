// main.js - Electron Main Process
// Manages main window and application lifecycle

const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");
const path = require("path");
const mqtt = require("mqtt");
const axios = require("axios");
const { autoUpdater } = require("electron-updater");

// Global variables
let mainWindow;
let configWindow;
let isConfigMode = false;

// Logo Manifest Service variables
let logoManifestService = null;
let currentManifest = null;
let manifestPollTimer = null;

// MQTT Service for E-Ra IoT Integration
let mqttService = null;
let currentSensorData = {
  temperature: null,
  humidity: null,
  pm25: null,
  pm10: null,
  lastUpdated: null,
  status: "offline",
};

/**
 * Logo Manifest Service - GitHub CDN Integration
 * Polls manifest.json from GitHub CDN and syncs logos
 */
class LogoManifestService {
  constructor(config) {
    this.config = config;
    this.isPolling = false;
    this.retryAttempts = 0;
    this.maxRetries = config.retryAttempts || 3;
    this.pollInterval = config.pollInterval * 1000; // Convert to milliseconds
    this.manifestUrl = config.manifestUrl;
    this.downloadPath = config.downloadPath;

    console.log("LogoManifestService: Initialized with config", {
      enabled: config.enabled,
      manifestUrl: config.manifestUrl,
      pollInterval: config.pollInterval,
    });
  }

  async startService() {
    if (!this.config.enabled) {
      console.log("LogoManifestService: Service disabled in config");
      return false;
    }

    try {
      console.log("LogoManifestService: Starting service...");

      // Create download directory
      await this.ensureDownloadDirectory();

      // Initial manifest fetch
      const success = await this.fetchManifest();
      if (!success) {
        console.error("LogoManifestService: Failed to fetch initial manifest");
        return false;
      }

      // Start periodic polling
      this.startPeriodicPolling();

      console.log("LogoManifestService: Service started successfully");
      return true;
    } catch (error) {
      console.error("LogoManifestService: Failed to start service:", error);
      return false;
    }
  }

  startPeriodicPolling() {
    if (manifestPollTimer) {
      clearInterval(manifestPollTimer);
    }

    manifestPollTimer = setInterval(async () => {
      if (!this.isPolling) {
        await this.checkForUpdates();
      }
    }, this.pollInterval);

    console.log(
      `LogoManifestService: Started polling every ${this.config.pollInterval}s`
    );
  }

  async checkForUpdates() {
    if (this.isPolling) return;

    this.isPolling = true;
    try {
      console.log("LogoManifestService: Checking for manifest updates...");

      const newManifest = await this.fetchManifestFromCDN();
      if (!newManifest) {
        console.log("LogoManifestService: No manifest available");
        return;
      }

      // Check if version changed
      if (currentManifest && currentManifest.version === newManifest.version) {
        console.log("LogoManifestService: No updates available");
        return;
      }

      console.log(
        `LogoManifestService: New version detected: ${currentManifest?.version} -> ${newManifest.version}`
      );

      // Process manifest updates
      await this.processManifestUpdate(newManifest);
    } catch (error) {
      console.error("LogoManifestService: Error checking for updates:", error);
    } finally {
      this.isPolling = false;
    }
  }

  async fetchManifestFromCDN() {
    try {
      console.log(
        `LogoManifestService: Fetching manifest from ${this.manifestUrl}`
      );

      const response = await axios.get(this.manifestUrl, {
        timeout: 15000,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.status === 200) {
        const manifest = response.data;
        console.log("LogoManifestService: Manifest fetched successfully", {
          version: manifest.version,
          logoCount: manifest.logos?.length || 0,
          lastUpdated: manifest.lastUpdated,
        });
        return manifest;
      }

      console.error(
        `LogoManifestService: HTTP ${response.status} - ${response.statusText}`
      );
      return null;
    } catch (error) {
      console.error("LogoManifestService: Failed to fetch manifest:", error);
      return null;
    }
  }

  async fetchManifest() {
    let attempts = 0;

    while (attempts < this.maxRetries) {
      try {
        const manifest = await this.fetchManifestFromCDN();
        if (manifest) {
          currentManifest = manifest;
          this.retryAttempts = 0;
          return true;
        }
      } catch (error) {
        console.error(
          `LogoManifestService: Fetch attempt ${attempts + 1} failed:`,
          error
        );
      }

      attempts++;
      if (attempts < this.maxRetries) {
        const delay = this.config.retryDelay || 2000;
        console.log(`LogoManifestService: Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.error("LogoManifestService: All fetch attempts failed");
    return false;
  }

  async processManifestUpdate(newManifest) {
    try {
      console.log("LogoManifestService: Processing manifest update...");

      const oldManifest = currentManifest;
      currentManifest = newManifest;

      // Download new/updated logos
      const downloadTasks = newManifest.logos
        .filter((logo) => logo.active)
        .map((logo) => this.downloadLogoIfNeeded(logo, oldManifest));

      const results = await Promise.allSettled(downloadTasks);

      // Log results
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(
        `LogoManifestService: Download results: ${successful} successful, ${failed} failed`
      );

      // Update local configuration
      await this.updateLocalConfigWithManifest(newManifest);

      // Notify renderer about manifest update
      this.notifyRendererManifestUpdate(newManifest);

      console.log(
        "LogoManifestService: Manifest update processed successfully"
      );
    } catch (error) {
      console.error(
        "LogoManifestService: Error processing manifest update:",
        error
      );
    }
  }

  async downloadLogoIfNeeded(logo, oldManifest) {
    try {
      // Check if logo already exists and is up to date
      const existingLogo = oldManifest?.logos.find((l) => l.id === logo.id);
      const localPath = this.getLocalLogoPath(logo);

      if (existingLogo && existingLogo.checksum === logo.checksum) {
        const fs = require("fs");
        if (fs.existsSync(localPath)) {
          console.log(
            `LogoManifestService: Logo ${logo.id} is up to date, skipping download`
          );
          return localPath;
        }
      }

      console.log(
        `LogoManifestService: Downloading logo ${logo.id} from ${logo.url}`
      );

      // Download logo
      const downloadedPath = await this.downloadLogo(logo);
      if (downloadedPath) {
        console.log(
          `LogoManifestService: Logo ${logo.id} downloaded successfully to ${downloadedPath}`
        );
        return downloadedPath;
      }

      return null;
    } catch (error) {
      console.error(
        `LogoManifestService: Error downloading logo ${logo.id}:`,
        error
      );
      return null;
    }
  }

  async downloadLogo(logo) {
    try {
      const fs = require("fs");
      const path = require("path");

      const localPath = this.getLocalLogoPath(logo);

      // Ensure directory exists
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Download file
      const response = await axios({
        method: "GET",
        url: logo.url,
        responseType: "stream",
        timeout: 30000,
      });

      // Save to local file
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log(
            `LogoManifestService: Logo downloaded successfully: ${localPath}`
          );
          resolve(localPath);
        });
        writer.on("error", (error) => {
          console.error("LogoManifestService: Download error:", error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(
        `LogoManifestService: Error downloading logo ${logo.id}:`,
        error
      );
      return null;
    }
  }

  getLocalLogoPath(logo) {
    const path = require("path");
    return path.join(this.downloadPath, "logos", logo.filename);
  }

  async ensureDownloadDirectory() {
    const fs = require("fs");
    const path = require("path");

    const logoDir = path.join(this.downloadPath, "logos");
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
      console.log("LogoManifestService: Created download directory:", logoDir);
    }
  }

  async updateLocalConfigWithManifest(manifest) {
    try {
      console.log(
        "LogoManifestService: Updating local config with manifest data"
      );

      // Load current config
      const config = await loadConfig();

      // Convert manifest logos to config format
      const logoImages = manifest.logos
        .filter((logo) => logo.active)
        .sort((a, b) => a.priority - b.priority)
        .map((logo) => ({
          name: logo.name,
          path: this.getLocalLogoPath(logo),
          size: logo.size,
          type: logo.type,
          id: logo.id,
          source: "github_cdn",
          checksum: logo.checksum,
        }))
        .filter((logo) => {
          // Only include logos that were successfully downloaded
          const fs = require("fs");
          return fs.existsSync(logo.path);
        });

      // Update config with new logo settings
      const updatedConfig = {
        ...config,
        logoImages,
        logoMode: manifest.settings?.logoMode || config.logoMode || "loop",
        logoLoopDuration:
          manifest.settings?.logoLoopDuration || config.logoLoopDuration || 5,
        // Add manifest metadata
        _manifestVersion: manifest.version,
        _manifestLastUpdated: manifest.lastUpdated,
      };

      // Save updated config
      await saveConfig(updatedConfig);

      console.log(
        "LogoManifestService: Local config updated with manifest data",
        {
          logoCount: logoImages.length,
          logoMode: updatedConfig.logoMode,
          logoLoopDuration: updatedConfig.logoLoopDuration,
          manifestVersion: manifest.version,
        }
      );

      // Broadcast config update to trigger hot-reload
      broadcastConfigUpdate(updatedConfig);
    } catch (error) {
      console.error("LogoManifestService: Error updating local config:", error);
    }
  }

  notifyRendererManifestUpdate(manifest) {
    // Send manifest update to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("logo-manifest-updated", {
        manifest: manifest,
        timestamp: Date.now(),
        source: "github_cdn",
      });

      console.log(
        "LogoManifestService: Manifest update notification sent to renderer"
      );
    }
  }

  async forceSync() {
    console.log("LogoManifestService: Force sync requested...");

    try {
      const success = await this.fetchManifest();
      if (success && currentManifest) {
        await this.processManifestUpdate(currentManifest);
        return { success: true, manifest: currentManifest };
      }
      return { success: false, error: "Failed to fetch manifest" };
    } catch (error) {
      console.error("LogoManifestService: Force sync failed:", error);
      return { success: false, error: error.message };
    }
  }

  stopService() {
    if (manifestPollTimer) {
      clearInterval(manifestPollTimer);
      manifestPollTimer = null;
    }

    this.isPolling = false;
    console.log("LogoManifestService: Service stopped");
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      polling: manifestPollTimer !== null,
      lastUpdate: currentManifest?.lastUpdated || null,
      logoCount: currentManifest?.logos?.length || 0,
      manifestVersion: currentManifest?.version || null,
      manifestUrl: this.manifestUrl,
    };
  }

  /**
   * Download a single banner by URL and filename (for renderer process requests)
   */
  async downloadSingleBanner(url, filename) {
    try {
      const axios = require("axios");
      const fs = require("fs");
      const path = require("path");

      console.log(
        `LogoManifestService: Downloading banner from ${url} as ${filename}`
      );

      // Ensure download directory exists
      const logoDir = path.join(this.downloadPath, "logos");
      if (!fs.existsSync(logoDir)) {
        fs.mkdirSync(logoDir, { recursive: true });
      }

      const localPath = path.join(logoDir, filename);

      // Download file
      const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",
        timeout: 30000,
      });

      // Save to local file
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log(
            `LogoManifestService: Banner downloaded successfully: ${localPath}`
          );
          resolve(localPath);
        });
        writer.on("error", (error) => {
          console.error("LogoManifestService: Banner download error:", error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(
        `LogoManifestService: Error downloading banner from ${url}:`,
        error
      );
      throw error;
    }
  }
}

/**
 * Create main billboard display window
 * Fixed size: 384x384 pixels (corresponding to LED screen)
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 384,
    height: 384,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    show: false, // Don't show initially
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
      devTools: process.argv.includes("--dev"),
    },
    icon: path.join(__dirname, "assets/icon.png"),
  });

  mainWindow.loadFile("renderer/index.html");

  // Forward console logs to main process in dev mode
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.on(
      "console-message",
      (event, level, message, line, sourceId) => {
        console.log(`[Renderer] ${message}`);
      }
    );
  }

  mainWindow.once("ready-to-show", () => {
    if (!isConfigMode) {
      mainWindow.show();
    }

    // Add a delay to ensure the window is fully loaded before accepting config updates
    setTimeout(() => {
      console.log("Main window is fully ready for config updates");
      mainWindow.isConfigReady = true;
    }, 1000);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Create configuration window
 * Full screen config interface
 */
function createConfigWindow() {
  if (configWindow) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    resizable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets/icon.png"),
  });

  configWindow.loadFile("renderer/config.html");

  configWindow.once("ready-to-show", () => {
    configWindow.show();
    if (mainWindow) {
      mainWindow.hide();
    }
  });

  configWindow.on("closed", () => {
    configWindow = null;
    isConfigMode = false;
    if (mainWindow) {
      mainWindow.show();
    }
  });
}

/**
 * Toggle between main display and config mode
 */
function toggleConfigMode() {
  console.log("F1 pressed - Toggling config mode");

  if (!isConfigMode) {
    // Enter config mode
    isConfigMode = true;
    createConfigWindow();
  } else {
    // Exit config mode
    if (configWindow) {
      configWindow.close();
    }
  }
}

/**
 * Initialize Logo Manifest Service for GitHub CDN sync
 */
async function initializeLogoManifestService() {
  try {
    console.log("Initializing Logo Manifest Service...");

    // Load config
    const config = await loadConfig();

    if (!config.logoManifest?.enabled) {
      console.log("Logo Manifest Service disabled in config");
      return;
    }

    // Create service instance
    logoManifestService = new LogoManifestService(config.logoManifest);

    // Start the service
    const success = await logoManifestService.startService();

    if (success) {
      console.log("Logo Manifest Service started successfully");
    } else {
      console.error("Failed to start Logo Manifest Service");
    }
  } catch (error) {
    console.error("Error initializing Logo Manifest Service:", error);
  }
}

/**
 * Load configuration from config.json
 */
async function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, "utf8");
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error("Error loading config:", error);
  }

  // Return default configuration
  return {
    logoMode: "fixed",
    logoImages: [],
    logoLoopDuration: 5,
    layoutPositions: {
      weather: { x: 0, y: 0, width: 192, height: 288 },
      iot: { x: 192, y: 0, width: 192, height: 288 },
      logo: { x: 0, y: 288, width: 384, height: 96 },
    },
    schedules: [],
    logoManifest: {
      enabled: false,
      manifestUrl: "",
      pollInterval: 10,
      downloadPath: "./downloads",
      maxCacheSize: 50,
      retryAttempts: 3,
      retryDelay: 2000,
    },
  };
}

/**
 * Save configuration to config.json
 */
async function saveConfig(config) {
  try {
    const configData = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, configData, "utf8");
    console.log("Configuration saved successfully");
  } catch (error) {
    console.error("Error saving config:", error);
    throw error;
  }
}

// MainProcessMqttService class - handles MQTT communication for E-Ra IoT and manifest sync
// Now uses dual-broker: mqtt1.eoh.io for sensor data, HiveMQ for commands
class MainProcessMqttService {
  constructor() {
    this.client = null; // E-Ra IoT broker
    this.commandClient = null; // Command broker (HiveMQ)
    this.config = null;
    this.isConnected = false;
    this.isCommandConnected = false;
    this.connectionTimer = null;
    this.commandConnectionTimer = null;
    this.updateTimer = null;
  }

  async initialize(eraIotConfig) {
    if (!eraIotConfig || !eraIotConfig.enabled || !eraIotConfig.authToken) {
      console.log(
        "MainProcessMqttService: E-Ra IoT not configured or disabled"
      );
      return false;
    }

    this.config = eraIotConfig;

    // Use gatewayToken directly from config
    const gatewayToken = eraIotConfig.gatewayToken;
    if (!gatewayToken) {
      console.error(
        "MainProcessMqttService: Gateway token not found in config"
      );
      return false;
    }

    this.gatewayToken = gatewayToken;
    console.log(
      "MainProcessMqttService: Initializing with gateway token:",
      gatewayToken.substring(0, 10) + "..."
    );

    // Connect to both brokers
    await this.connectMQTT();
    await this.connectCommandBroker();
    return true;
  }

  extractGatewayToken(authToken) {
    const tokenMatch = authToken.match(/Token\s+(.+)/);
    return tokenMatch ? tokenMatch[1] : null;
  }

  async connectMQTT() {
    if (this.client) {
      console.warn("MainProcessMqttService: Already connected or connecting");
      return;
    }

    try {
      const brokerUrl = "mqtt://mqtt1.eoh.io:1883";

      console.log("MainProcessMqttService: E-Ra MQTT Configuration");
      console.log("MainProcessMqttService: ============================");
      console.log("MainProcessMqttService: Broker: mqtt1.eoh.io:1883");
      console.log(
        "MainProcessMqttService: Username:",
        this.gatewayToken.substring(0, 10) + "..."
      );
      console.log(
        "MainProcessMqttService: Password:",
        this.gatewayToken.substring(0, 10) + "..."
      );
      console.log(
        "MainProcessMqttService: Topic:",
        `eoh/chip/${this.gatewayToken}/config/+/value`
      );
      console.log(
        "MainProcessMqttService: Sensor configs:",
        this.config.sensorConfigs
      );

      console.log("MainProcessMqttService: Connecting to E-Ra MQTT broker...");

      this.client = mqtt.connect(brokerUrl, {
        username: this.gatewayToken,
        password: this.gatewayToken,
        clientId: `billboard_${this.gatewayToken}_${Date.now()}`,
        keepalive: 60,
        connectTimeout: 15000,
        clean: true,
      });

      // Set connection timeout
      this.connectionTimer = setTimeout(() => {
        console.log("MainProcessMqttService: ❌ Connection timeout");
        if (this.client) {
          this.client.end();
        }
        this.updateConnectionStatus("timeout");
      }, 20000);

      this.client.on("connect", () => {
        clearTimeout(this.connectionTimer);
        console.log(
          "MainProcessMqttService: ✅ Successfully connected to E-Ra MQTT broker!"
        );
        this.isConnected = true;
        this.subscribeToTopics();
        this.startPeriodicUpdates();
        this.updateConnectionStatus("connected");
      });

      this.client.on("message", (topic, message) => {
        this.handleMqttMessage(topic, message);
      });

      this.client.on("error", (error) => {
        clearTimeout(this.connectionTimer);
        console.log(
          "MainProcessMqttService: ❌ Connection error:",
          error.message
        );
        if (this.client) {
          this.client.end();
        }
        this.updateConnectionStatus("error", error.message);
      });

      this.client.on("close", () => {
        console.log("MainProcessMqttService: Connection closed");
        this.isConnected = false;
        this.updateConnectionStatus("offline");
      });
    } catch (error) {
      console.error("MainProcessMqttService: Failed to connect:", error);
      this.updateConnectionStatus("error", error.message);
    }
  }

  async connectCommandBroker() {
    if (this.commandClient) {
      console.warn("MainProcessMqttService: Command broker already connecting");
      return;
    }

    try {
      console.log(
        "MainProcessMqttService: Connecting to Command Broker (HiveMQ)..."
      );

      this.commandClient = mqtt.connect("wss://broker.hivemq.com:8884/mqtt", {
        clean: true,
        connectTimeout: 15000,
        clientId: `billboard_cmd_${Date.now()}`,
        keepalive: 60,
      });

      this.commandConnectionTimer = setTimeout(() => {
        console.log(
          "MainProcessMqttService: ❌ Command broker connection timeout"
        );
        if (this.commandClient) {
          this.commandClient.end();
        }
      }, 20000);

      this.commandClient.on("connect", () => {
        clearTimeout(this.commandConnectionTimer);
        console.log(
          "MainProcessMqttService: ✅ Successfully connected to Command Broker!"
        );
        this.isCommandConnected = true;
        this.subscribeToCommandTopics();
      });

      this.commandClient.on("message", (topic, message) => {
        this.handleCommandMessage(message.toString());
      });

      this.commandClient.on("error", (error) => {
        clearTimeout(this.commandConnectionTimer);
        console.log(
          "MainProcessMqttService: ❌ Command broker error:",
          error.message
        );
      });

      this.commandClient.on("close", () => {
        console.log("MainProcessMqttService: Command broker connection closed");
        this.isCommandConnected = false;
      });
    } catch (error) {
      console.error(
        "MainProcessMqttService: Failed to connect command broker:",
        error
      );
    }
  }

  subscribeToTopics() {
    if (!this.client || !this.client.connected) {
      console.warn(
        "MainProcessMqttService: Cannot subscribe - client not connected"
      );
      return;
    }

    // Subscribe to E-Ra IoT sensor data
    const eraIotTopic = `eoh/chip/${this.gatewayToken}/config/+/value`;
    this.client.subscribe(eraIotTopic, { qos: 1 }, (err) => {
      if (err) {
        console.log(
          "MainProcessMqttService: ❌ Failed to subscribe to E-Ra IoT topic:",
          err.message
        );
      } else {
        console.log(
          "MainProcessMqttService: ✅ Successfully subscribed to E-Ra IoT:",
          eraIotTopic
        );
        console.log("MainProcessMqttService: Waiting for E-Ra IoT messages...");
      }
    });
  }

  subscribeToCommandTopics() {
    if (!this.commandClient || !this.commandClient.connected) {
      console.warn(
        "MainProcessMqttService: Cannot subscribe to command topics - client not connected"
      );
      return;
    }

    // Subscribe to remote commands from admin-web
    const commandsTopic = "its/billboard/commands";
    this.commandClient.subscribe(commandsTopic, { qos: 1 }, (err) => {
      if (err) {
        console.log(
          "MainProcessMqttService: ❌ Failed to subscribe to commands topic:",
          err.message
        );
        // Retry after 5 seconds
        setTimeout(() => this.subscribeToCommandTopics(), 5000);
      } else {
        console.log(
          "MainProcessMqttService: ✅ Successfully subscribed to commands:",
          commandsTopic
        );
      }
    });

    // Subscribe to manifest refresh signals
    const manifestTopic = "its/billboard/manifest/refresh";
    this.commandClient.subscribe(manifestTopic, { qos: 1 }, (err) => {
      if (err) {
        console.log(
          "MainProcessMqttService: ❌ Failed to subscribe to manifest topic:",
          err.message
        );
      } else {
        console.log(
          "MainProcessMqttService: ✅ Successfully subscribed to manifest refresh:",
          manifestTopic
        );
      }
    });
  }

  handleMqttMessage(topic, message) {
    try {
      const messageStr = message.toString();
      console.log(
        `MainProcessMqttService: [${new Date().toLocaleTimeString()}] ${topic}: ${messageStr}`
      );

      // Handle manifest refresh messages
      if (topic === "its/billboard/manifest/refresh") {
        this.handleManifestRefreshMessage(messageStr);
        return;
      }

      // Handle OTA update commands
      if (topic === "its/billboard/commands") {
        this.handleCommandMessage(messageStr);
        return;
      }

      // Parse E-RA message
      let value = null;
      try {
        const data = JSON.parse(messageStr);
        console.log("MainProcessMqttService: Parsed JSON:", data);

        // Extract value from various possible formats
        if (typeof data === "object" && data !== null) {
          const keys = Object.keys(data);
          if (keys.length === 1) {
            const key = keys[0];
            const potentialValue = data[key];
            if (typeof potentialValue === "string") {
              value = this.parseEraValue(potentialValue);
            } else if (
              typeof potentialValue === "number" &&
              !isNaN(potentialValue)
            ) {
              value = potentialValue;
            }
          }
        }
      } catch (error) {
        // Try parsing as number
        const numValue = parseFloat(messageStr);
        if (!isNaN(numValue)) {
          value = numValue;
          console.log(`MainProcessMqttService: Parsed as number: ${numValue}`);
        }
      }

      if (value !== null && !isNaN(value)) {
        // Extract config ID from topic
        const configIdMatch = topic.match(/\/config\/(\d+)\/value$/);
        if (configIdMatch) {
          const configId = parseInt(configIdMatch[1]);
          this.updateSensorData(configId, value);
        }
      }
    } catch (error) {
      console.error("MainProcessMqttService: Error processing message:", error);
    }
  }

  parseEraValue(valueStr) {
    try {
      // Handle "+" prefix in E-RA values
      if (valueStr.includes("+")) {
        const withoutPlus = valueStr.replace("+", "");
        const parsed = parseFloat(withoutPlus);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }

      const directParse = parseFloat(valueStr);
      if (!isNaN(directParse)) {
        return directParse;
      }

      return null;
    } catch (error) {
      console.error(
        `MainProcessMqttService: Error parsing value "${valueStr}":`,
        error
      );
      return null;
    }
  }

  updateSensorData(configId, value) {
    const sensorType = this.mapConfigIdToSensorType(configId);
    if (sensorType) {
      console.log(
        `MainProcessMqttService: Updating ${sensorType} (ID: ${configId}) = ${value}`
      );

      currentSensorData[sensorType] = value;
      currentSensorData.lastUpdated = new Date();
      currentSensorData.status = "connected";

      // Send data to renderer process
      this.broadcastSensorData();
    } else {
      console.warn(`MainProcessMqttService: Unknown config ID: ${configId}`);
    }
  }

  mapConfigIdToSensorType(configId) {
    if (this.config.sensorConfigs.temperature === configId)
      return "temperature";
    if (this.config.sensorConfigs.humidity === configId) return "humidity";
    if (this.config.sensorConfigs.pm25 === configId) return "pm25";
    if (this.config.sensorConfigs.pm10 === configId) return "pm10";
    return null;
  }

  startPeriodicUpdates() {
    // Send current data every second to keep UI updated
    this.updateTimer = setInterval(() => {
      if (this.isConnected) {
        this.broadcastSensorData();
      }
    }, 1000);
    console.log(
      "MainProcessMqttService: Started periodic data updates every 1 second"
    );
  }

  broadcastSensorData() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("era-iot-data-update", currentSensorData);
    }
  }

  updateConnectionStatus(status, message = null) {
    currentSensorData.status = status;
    if (message) {
      currentSensorData.errorMessage = message;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("era-iot-status-update", {
        status,
        message,
        lastUpdated: currentSensorData.lastUpdated,
      });
    }
  }

  disconnect() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    if (this.commandConnectionTimer) {
      clearTimeout(this.commandConnectionTimer);
      this.commandConnectionTimer = null;
    }

    if (this.client) {
      this.client.end();
      this.client = null;
    }

    if (this.commandClient) {
      this.commandClient.end();
      this.commandClient = null;
    }

    this.isConnected = false;
    this.isCommandConnected = false;
    console.log("MainProcessMqttService: Disconnected from all brokers");
  }

  async handleCommandMessage(messageStr) {
    try {
      console.log(
        "MainProcessMqttService: Received command message:",
        messageStr
      );

      const command = JSON.parse(messageStr);

      switch (command.action) {
        case "check_update":
          console.log(
            "MainProcessMqttService: Processing check_update command"
          );
          await this.handleCheckUpdateCommand();
          break;
        case "force_update":
          console.log(
            "MainProcessMqttService: Processing force_update command"
          );
          await this.handleForceUpdateCommand();
          break;
        case "reset_app":
          console.log("MainProcessMqttService: Processing reset_app command");
          await this.handleResetAppCommand(command);
          break;
        default:
          console.warn(
            "MainProcessMqttService: Unknown command action:",
            command.action
          );
      }
    } catch (error) {
      console.error(
        "MainProcessMqttService: Error handling command message:",
        error
      );
    }
  }

  async handleCheckUpdateCommand() {
    try {
      console.log("MainProcessMqttService: Checking for updates...");

      // ✅ Ensure app-update.yml exists before check
      ensureAppUpdateFile();

      const result = await autoUpdater.checkForUpdates();

      if (result && result.updateInfo) {
        console.log(
          "MainProcessMqttService: Update available:",
          result.updateInfo.version
        );
        // Send status back via MQTT
        this.sendUpdateStatus({
          status: "update_available",
          version: result.updateInfo.version,
          timestamp: Date.now(),
        });
      } else {
        console.log("MainProcessMqttService: No updates available");
        this.sendUpdateStatus({
          status: "no_updates",
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(
        "MainProcessMqttService: Error checking for updates:",
        error
      );
      this.sendUpdateStatus({
        status: "error",
        error: error.message,
        timestamp: Date.now(),
      });
    }
  }

  async handleForceUpdateCommand() {
    try {
      console.log("MainProcessMqttService: Force update initiated...");

      // ✅ Ensure app-update.yml exists before force update
      ensureAppUpdateFile();

      // Send status - update in progress
      this.sendUpdateStatus({
        status: "update_in_progress",
        timestamp: Date.now(),
      });

      // Check for updates
      const result = await autoUpdater.checkForUpdates();

      if (result && result.updateInfo) {
        console.log(
          "MainProcessMqttService: Update available, downloading:",
          result.updateInfo.version
        );

        this.sendUpdateStatus({
          status: "downloading",
          version: result.updateInfo.version,
          timestamp: Date.now(),
        });

        // Download update
        await autoUpdater.downloadUpdate();
      } else {
        console.log(
          "MainProcessMqttService: No updates available for force update"
        );
        this.sendUpdateStatus({
          status: "no_updates",
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error("MainProcessMqttService: Error in force update:", error);
      this.sendUpdateStatus({
        status: "error",
        error: error.message,
        timestamp: Date.now(),
      });
    }
  }

  async handleResetAppCommand(command) {
    try {
      console.log("MainProcessMqttService: Resetting app...", command);

      // Send acknowledgment back to admin-web
      this.sendResetStatus({
        status: "reset_started",
        timestamp: Date.now(),
        reason: command.reason || "Manual reset",
      });

      // Wait a moment for acknowledgment to be sent
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Perform app reset
      console.log("MainProcessMqttService: Performing app reset...");

      // Disconnect MQTT temporarily
      if (mqttService) {
        mqttService.disconnect();
      }

      // Stop manifest polling
      if (logoManifestService) {
        logoManifestService.stopService();
      }

      // Clear any timers/intervals
      if (manifestPollTimer) {
        clearInterval(manifestPollTimer);
        manifestPollTimer = null;
      }

      // Send final status before restart
      this.sendResetStatus({
        status: "restarting",
        timestamp: Date.now(),
      });

      // Wait a bit then restart the app
      setTimeout(() => {
        console.log("MainProcessMqttService: Restarting Electron app...");
        app.relaunch();
        app.exit(0);
      }, 1000);
    } catch (error) {
      console.error("MainProcessMqttService: Error resetting app:", error);
      this.sendResetStatus({
        status: "error",
        error: error.message,
        timestamp: Date.now(),
      });
    }
  }

  sendResetStatus(status) {
    try {
      if (this.commandClient && this.commandClient.connected) {
        this.commandClient.publish(
          "its/billboard/reset/status",
          JSON.stringify(status),
          { qos: 1 }
        );
        console.log(
          "MainProcessMqttService: Sent reset status via command broker:",
          status
        );
      } else if (this.client && this.client.connected) {
        // Fallback to E-Ra broker if command broker not available
        this.client.publish(
          "its/billboard/reset/status",
          JSON.stringify(status),
          { qos: 1 }
        );
        console.log(
          "MainProcessMqttService: Sent reset status via E-Ra broker:",
          status
        );
      } else {
        console.warn(
          "MainProcessMqttService: Cannot send reset status - no MQTT broker connected"
        );
      }
    } catch (error) {
      console.error(
        "MainProcessMqttService: Error sending reset status:",
        error
      );
    }
  }

  sendUpdateStatus(status) {
    try {
      if (this.commandClient && this.commandClient.connected) {
        this.commandClient.publish(
          "its/billboard/update/status",
          JSON.stringify(status),
          { qos: 1 }
        );
        console.log(
          "MainProcessMqttService: Sent update status via command broker:",
          status
        );
      } else if (this.client && this.client.connected) {
        // Fallback to E-Ra broker if command broker not available
        this.client.publish(
          "its/billboard/update/status",
          JSON.stringify(status),
          { qos: 1 }
        );
        console.log(
          "MainProcessMqttService: Sent update status via E-Ra broker:",
          status
        );
      } else {
        console.warn(
          "MainProcessMqttService: Cannot send update status - no MQTT broker connected"
        );
      }
    } catch (error) {
      console.error(
        "MainProcessMqttService: Error sending update status:",
        error
      );
    }
  }
}

app.whenReady().then(async () => {
  createMainWindow();

  // Setup config file watcher for hot-reload
  setupConfigWatcher();

  // ✅ Ensure app-update.yml exists early
  ensureAppUpdateFile();

  // Initialize MQTT service
  await initializeMqttService();

  // Initialize Logo Manifest Service
  await initializeLogoManifestService();

  // Initialize Auto-Updater
  initializeAutoUpdater();

  // Register global F1 shortcut for config mode
  globalShortcut.register("F1", () => {
    toggleConfigMode();
  });

  console.log("Billboard app started - Press F1 for config mode");
  console.log("Config hot-reload watcher active");
  console.log("MQTT service initialized");
  console.log("Logo Manifest Service initialized");
  console.log("Auto-Updater initialized");
});

// Quit application when all windows are closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Recreate window when clicking dock icon (macOS)
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Cleanup shortcuts and watchers on quit
app.on("will-quit", () => {
  globalShortcut.unregisterAll();

  if (configWatcher) {
    fs.unwatchFile(configPath);
    configWatcher = null;
    console.log("Config watcher cleaned up");
  }

  if (mqttService) {
    mqttService.disconnect();
    mqttService = null;
    console.log("MQTT service cleaned up");
  }

  if (logoManifestService) {
    logoManifestService.stopService();
    logoManifestService = null;
    console.log("Logo Manifest Service cleaned up");
  }
});

// IPC handlers for config communication
const fs = require("fs");
const { dialog } = require("electron");

// Configuration file path
const configPath = path.join(__dirname, "config.json");

// File system watcher for config.json hot-reload
let configWatcher = null;

function setupConfigWatcher() {
  if (configWatcher) {
    configWatcher.close();
  }

  try {
    configWatcher = fs.watchFile(configPath, (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        console.log("Config file changed externally, triggering hot-reload...");

        try {
          const configData = fs.readFileSync(configPath, "utf8");
          const config = JSON.parse(configData);

          console.log("External config change detected:", {
            logoMode: config.logoMode,
            logoLoopDuration: config.logoLoopDuration,
            logoImages: config.logoImages?.length,
          });

          // Broadcast the updated config
          broadcastConfigUpdate(config);
        } catch (error) {
          console.error("Error parsing externally changed config:", error);
        }
      }
    });

    console.log("Config file watcher established for hot-reload");
  } catch (error) {
    console.error("Failed to setup config watcher:", error);
  }
}

/**
 * Broadcast configuration updates to all active windows
 */
function broadcastConfigUpdate(config) {
  console.log("Broadcasting config update to all windows", {
    logoMode: config.logoMode,
    logoLoopDuration: config.logoLoopDuration,
    logoImages: config.logoImages?.length,
    hasEraIot: !!config.eraIot,
    timestamp: new Date().toLocaleTimeString(),
  });

  // Send to main window with immediate effect
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.webContents.isLoading() === false
  ) {
    console.log("Sending IMMEDIATE config-updated to main window");

    // Send main config update
    mainWindow.webContents.send("config-updated", config);

    // Send force refresh
    mainWindow.webContents.send("force-refresh-services", config);

    // Force reload for logo changes specifically - send multiple times to ensure delivery
    if (config.logoMode && config.logoLoopDuration) {
      console.log(
        `Forcing logo loop interval update: ${config.logoLoopDuration}s`
      );

      // Send immediately
      mainWindow.webContents.send("logo-config-updated", {
        logoMode: config.logoMode,
        logoLoopDuration: config.logoLoopDuration,
        logoImages: config.logoImages,
      });

      // Send with delay to ensure delivery
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("logo-config-updated", {
            logoMode: config.logoMode,
            logoLoopDuration: config.logoLoopDuration,
            logoImages: config.logoImages,
          });
          console.log("DELAYED logo-config-updated event sent");
        }
      }, 100);

      // Send another one with longer delay
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("config-updated", config);
          console.log("FINAL config-updated event sent");
        }
      }, 200);
    }
  } else {
    console.log(
      "Main window not available for config broadcast - Window loading:",
      mainWindow?.webContents.isLoading()
    );
  }

  // Send to config window if open
  if (configWindow && !configWindow.isDestroyed()) {
    console.log("Sending config-updated to config window");
    configWindow.webContents.send("config-updated", config);
  }

  // Send specific E-Ra IoT updates if applicable
  if (config.eraIot) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("era-iot-config-updated", config.eraIot);
    }

    // Restart MQTT service with new config
    console.log("Restarting MQTT service due to config change...");
    setTimeout(async () => {
      await initializeMqttService();
    }, 500);
  }
}

ipcMain.handle("get-config", async () => {
  return await loadConfig();
});

ipcMain.handle("save-config", async (event, config) => {
  try {
    await saveConfig(config);

    // Broadcast config update for hot-reload
    broadcastConfigUpdate(config);

    return { success: true };
  } catch (error) {
    console.error("Error saving config via IPC:", error);
    return { success: false, error: error.message };
  }
});

// Logo Manifest Service IPC Handlers
ipcMain.handle("get-logo-manifest", async () => {
  return currentManifest;
});

ipcMain.handle("force-sync-manifest", async () => {
  if (logoManifestService) {
    console.log("IPC: Force sync manifest requested");
    return await logoManifestService.forceSync();
  }
  return { success: false, error: "Logo Manifest Service not available" };
});

ipcMain.handle("get-manifest-status", async () => {
  if (logoManifestService) {
    return logoManifestService.getStatus();
  }
  return { enabled: false, error: "Service not available" };
});

ipcMain.handle("restart-manifest-service", async () => {
  try {
    console.log("IPC: Restart manifest service requested");

    // Stop existing service
    if (logoManifestService) {
      logoManifestService.stopService();
    }

    // Reinitialize
    await initializeLogoManifestService();

    return { success: true };
  } catch (error) {
    console.error("Error restarting manifest service:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("exit-config", async () => {
  if (configWindow) {
    configWindow.close();
  }
});

ipcMain.handle("select-logo-files", async () => {
  try {
    const result = await dialog.showOpenDialog(configWindow, {
      title: "Select Logo Images",
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "svg", "gif"] },
      ],
      properties: ["openFile", "multiSelections"],
    });

    if (!result.canceled) {
      return result.filePaths;
    }
    return [];
  } catch (error) {
    console.error("Error selecting files:", error);
    return [];
  }
});

ipcMain.handle("minimize-app", async () => {
  if (configWindow) {
    configWindow.minimize();
  }
});

ipcMain.handle("close-app", async () => {
  app.quit();
});

// E-Ra IoT specific configuration handler
ipcMain.handle("update-era-iot-config", async (event, eraIotConfig) => {
  try {
    let currentConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, "utf8");
        currentConfig = JSON.parse(configData);
      } catch (error) {
        console.warn("Could not load existing config, using defaults");
      }
    }

    // Update E-Ra IoT configuration
    currentConfig.eraIot = {
      ...currentConfig.eraIot,
      ...eraIotConfig,
    };

    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    console.log("E-Ra IoT configuration updated successfully");

    // Broadcast config update to all windows
    broadcastConfigUpdate(currentConfig);

    return { success: true };
  } catch (error) {
    console.error("Error updating E-Ra IoT config:", error);
    return { success: false, error: error.message };
  }
});

// Handle authentication token updates from login
ipcMain.handle("update-auth-token", async (event, authToken) => {
  try {
    let currentConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, "utf8");
        currentConfig = JSON.parse(configData);
      } catch (error) {
        console.warn("Could not load existing config, using defaults");
      }
    }

    // Ensure E-Ra IoT config exists
    if (!currentConfig.eraIot) {
      currentConfig.eraIot = {
        enabled: true,
        baseUrl: "https://backend.eoh.io",
        sensorConfigs: {
          temperature: null,
          humidity: null,
          pm25: null,
          pm10: null,
        },
        updateInterval: 5,
        timeout: 15000,
        retryAttempts: 3,
        retryDelay: 2000,
      };
    }

    // Update auth token
    currentConfig.eraIot.authToken = authToken;

    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    console.log("Authentication token updated successfully");

    // Broadcast config update to all windows
    broadcastConfigUpdate(currentConfig);

    return { success: true };
  } catch (error) {
    console.error("Error updating auth token:", error);
    return { success: false, error: error.message };
  }
});

// Provide parsed gateway token to renderer on demand
ipcMain.handle("get-gateway-token", async () => {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, "utf8");
      const cfg = JSON.parse(configData);
      const auth = cfg?.eraIot?.authToken || "";
      const match = auth.match(/Token\s+(.+)/);
      return match ? match[1] : null;
    }
  } catch (error) {
    console.error("get-gateway-token: failed to read config:", error);
  }
  return null;
});

/**
 * MQTT Service for E-Ra IoT Integration (Main Process)
 * Handles MQTT connection and data processing in Node.js environment
 */
/**
 * Ensure app-update.yml exists for electron-updater
 * This file is required by electron-updater to track update status
 */
function ensureAppUpdateFile() {
  const fs = require("fs");
  const path = require("path");

  // Get proper app resources path
  const resourcePath = path.join(
    process.env.APPDATA || app.getPath("appData"),
    "ITS-Outdoor-Billboard",
    "resources"
  );

  const appUpdatePath = path.join(resourcePath, "app-update.yml");

  try {
    // Create resources directory if doesn't exist
    if (!fs.existsSync(resourcePath)) {
      fs.mkdirSync(resourcePath, { recursive: true });
      console.log(
        "EnsureAppUpdateFile: Created resources directory:",
        resourcePath
      );
    }

    // Create app-update.yml if doesn't exist
    if (!fs.existsSync(appUpdatePath)) {
      const updateYaml = `version: ${app.getVersion()}
files:
  - url: https://github.com/MinhQuan7/ITS_OurdoorBillboard-/releases/download/v${app.getVersion()}/ITS-Billboard-${app.getVersion()}-setup.exe
    sha512: ''
    size: 0
path: ITS-Billboard-${app.getVersion()}-setup.exe
sha512: ''
releaseDate: ${new Date().toISOString()}
`;
      fs.writeFileSync(appUpdatePath, updateYaml);
      console.log(
        "EnsureAppUpdateFile: Created app-update.yml at:",
        appUpdatePath
      );
    } else {
      console.log(
        "EnsureAppUpdateFile: app-update.yml already exists at:",
        appUpdatePath
      );
    }

    return appUpdatePath;
  } catch (error) {
    console.error(
      "EnsureAppUpdateFile: Failed to ensure app-update.yml:",
      error
    );
    return null;
  }
}

// Initialize Auto-Updater
async function initializeAutoUpdater() {
  try {
    console.log("AutoUpdater: Initializing OTA updates...");

    // ✅ Ensure app-update.yml exists FIRST
    ensureAppUpdateFile();

    // Configure electron-updater for GitHub releases
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;

    // Configure GitHub as update provider
    const updateCheckResult = autoUpdater.checkForUpdatesAndNotify();

    // Configure auto-updater with safe logger setup
    autoUpdater.logger = console;
    // Safe logger setup - check if transports exists before accessing
    if (
      autoUpdater.logger &&
      autoUpdater.logger.transports &&
      autoUpdater.logger.transports.file
    ) {
      autoUpdater.logger.transports.file.level = "info";
    }

    // Auto-updater event handlers with fallback safety
    autoUpdater.on("checking-for-update", () => {
      console.log("AutoUpdater: Checking for update...");
    });

    autoUpdater.on("update-available", (info) => {
      console.log("AutoUpdater: Update available:", info.version);
      // Send notification to renderer (optional)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("update-available", info);
      }
    });

    autoUpdater.on("update-not-available", (info) => {
      console.log("AutoUpdater: Update not available");
    });

    autoUpdater.on("error", (err) => {
      console.error("AutoUpdater: Error in auto-updater:", err);
      // Send error status via MQTT
      if (mqttService && mqttService.isCommandConnected) {
        mqttService.sendUpdateStatus({
          status: "error",
          error: err.message || err.toString(),
          timestamp: Date.now(),
        });
      }
    });

    autoUpdater.on("download-progress", (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message = log_message + " - Downloaded " + progressObj.percent + "%";
      log_message =
        log_message +
        " (" +
        progressObj.transferred +
        "/" +
        progressObj.total +
        ")";
      console.log("AutoUpdater: Download progress:", log_message);
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("AutoUpdater: Update downloaded:", info.version);
      // Send notification to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("update-downloaded", info);
      }

      // Auto-install after 5 seconds (gives time for user notification)
      setTimeout(() => {
        console.log("AutoUpdater: Installing update and restarting...");
        autoUpdater.quitAndInstall(false, true); // isSilent=true, forceRunAfter=true
      }, 5000);
    });

    // Check for updates (but don't download automatically)
    console.log("AutoUpdater: Checking for updates...");
    await autoUpdater.checkForUpdates();

    console.log("AutoUpdater: Initialized successfully");
  } catch (error) {
    console.error("AutoUpdater: Failed to initialize:", error);
    // Don't crash app if auto-updater fails
  }
}

// Initialize MQTT service when config is loaded
async function initializeMqttService() {
  try {
    // Read config directly from file (not via IPC in main process)
    let config = null;
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, "utf8");
        config = JSON.parse(configData);
      }
    } catch (error) {
      console.error("Error reading config for MQTT initialization:", error);
      return;
    }

    if (config && config.eraIot && config.eraIot.enabled) {
      console.log("Initializing MQTT service with E-Ra IoT config");

      if (mqttService) {
        mqttService.disconnect();
      }

      mqttService = new MainProcessMqttService();
      await mqttService.initialize(config.eraIot);
    } else {
      console.log("E-Ra IoT not configured or disabled");
    }
  } catch (error) {
    console.error("Failed to initialize MQTT service:", error);
  }
}

// IPC handlers for MQTT data
ipcMain.handle("get-era-iot-data", async () => {
  return currentSensorData;
});

ipcMain.handle("refresh-era-iot-connection", async () => {
  if (mqttService) {
    console.log("Refreshing E-Ra IoT MQTT connection...");
    mqttService.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    await initializeMqttService();
    return { success: true };
  }
  return { success: false, message: "MQTT service not initialized" };
});

// Banner download handler for renderer process
ipcMain.handle("download-banner", async (event, bannerData) => {
  if (logoManifestService) {
    try {
      const result = await logoManifestService.downloadSingleBanner(
        bannerData.url,
        bannerData.filename
      );
      return { success: true, filePath: result };
    } catch (error) {
      console.error("Main: Failed to download banner:", error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Logo manifest service not available" };
});
