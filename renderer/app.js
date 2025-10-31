// app-built.js - Generated bundle from TypeScript components
// This replaces the old app.js with real API integration

// Import React from CDN (already loaded in HTML)
const { useState, useEffect, useRef } = React;

// ====================================
// ELECTRON API PATCHES
// ====================================

/**
 * Apply patches for missing electronAPI functions
 */
function applyElectronAPIPatches() {
  if (typeof window === "undefined" || !window.electronAPI) {
    return false;
  }

  // Patch downloadBanner if missing
  if (!window.electronAPI.downloadBanner) {
    console.log("🔧 Patching electronAPI with downloadBanner stub...");

    window.electronAPI.downloadBanner = async function (bannerData) {
      console.log(
        "📥 downloadBanner called (stub) - delegating to main process:",
        bannerData
      );

      if (window.electronAPI.forceSyncManifest) {
        try {
          await window.electronAPI.forceSyncManifest();
          console.log(
            "✅ Main process sync triggered instead of direct download"
          );
          return { success: true, message: "Delegated to main process" };
        } catch (error) {
          console.error("❌ Failed to trigger main process sync:", error);
          throw error;
        }
      } else {
        console.warn("⚠️ forceSyncManifest not available, returning success");
        return { success: true, message: "No-op download" };
      }
    };
  }

  // Add missing functions
  const missingFunctions = ["deleteBannerFile", "updateDisplaySettings"];
  missingFunctions.forEach((funcName) => {
    if (!window.electronAPI[funcName]) {
      window.electronAPI[funcName] = async function (...args) {
        console.log(`📞 ${funcName} called (stub):`, args);
        return {
          success: true,
          message: `Stub implementation for ${funcName}`,
        };
      };
    }
  });

  return true;
}

// Apply patches immediately and with retries
if (!applyElectronAPIPatches()) {
  [100, 250, 500, 1000].forEach((delay, index, arr) => {
    setTimeout(() => {
      if (applyElectronAPIPatches()) {
        console.log(`✅ ElectronAPI patches applied after ${delay}ms delay`);
      } else if (index === arr.length - 1) {
        console.warn(
          "⚠️ Could not apply electronAPI patches after all retries"
        );
      }
    }, delay);
  });
}

// Logo Manifest Service for GitHub CDN Integration (Renderer Side)
class RendererLogoManifestService {
  constructor() {
    this.currentManifest = null;
    this.isInitialized = false;
    this.updateCallbacks = [];
    this.mqttConnected = false;
    this.downloadQueue = [];
    this.isDownloading = false;

    console.log(
      "RendererLogoManifestService: Initialized with remote sync support"
    );
  }

  async initialize() {
    try {
      console.log("RendererLogoManifestService: Starting initialization...");

      // Setup IPC listeners for manifest updates from main process
      this.setupIpcListeners();

      // Setup MQTT listeners for admin-web commands
      this.setupMqttListeners();

      // Get initial manifest from main process
      await this.fetchInitialManifest();

      // Start auto-sync service
      this.startAutoSync();

      this.isInitialized = true;
      console.log(
        "RendererLogoManifestService: Initialized successfully with remote sync"
      );

      return true;
    } catch (error) {
      console.error(
        "RendererLogoManifestService: Initialization failed:",
        error
      );
      return false;
    }
  }

  setupIpcListeners() {
    if (!window.electronAPI) {
      console.error("RendererLogoManifestService: electronAPI not available");
      return;
    }

    // Listen for manifest updates from main process
    window.electronAPI.onLogoManifestUpdated((event, data) => {
      console.log(
        "RendererLogoManifestService: Received manifest update from main process:",
        data
      );
      this.currentManifest = data.manifest;
      this.notifyUpdateCallbacks();

      // Trigger download of new banners
      this.downloadNewBanners();
    });

    // Listen for MQTT status updates
    window.electronAPI.onMqttStatusUpdate((event, status) => {
      console.log("RendererLogoManifestService: MQTT status update:", status);
      this.mqttConnected = status.connected;
    });

    // Listen for banner download progress
    window.electronAPI.onBannerDownloadProgress((event, progress) => {
      console.log("RendererLogoManifestService: Download progress:", progress);
    });

    console.log("RendererLogoManifestService: IPC listeners established");
  }

  setupMqttListeners() {
    if (!window.electronAPI) {
      console.error(
        "RendererLogoManifestService: electronAPI not available for MQTT"
      );
      return;
    }

    // Listen for remote admin commands via MQTT
    window.electronAPI.onRemoteAdminCommand((event, command) => {
      console.log(
        "RendererLogoManifestService: Received remote admin command:",
        command
      );

      switch (command.action) {
        case "force-refresh-manifest":
          this.handleForceRefresh(command);
          break;
        case "banner-update":
          this.handleBannerUpdate(command);
          break;
        case "banner-delete":
          this.handleBannerDelete(command);
          break;
        case "settings-sync":
          this.handleSettingsSync(command);
          break;
        default:
          console.warn("Unknown remote command:", command.action);
      }
    });

    console.log(
      "RendererLogoManifestService: MQTT command listeners established"
    );
  }

  async handleForceRefresh(command) {
    console.log(
      "RendererLogoManifestService: Handling force refresh from admin-web"
    );

    try {
      // Send acknowledgment back to admin-web
      await window.electronAPI.sendMqttMessage({
        topic: "its/billboard/status",
        message: {
          action: "refresh-started",
          timestamp: Date.now(),
          source: "desktop-app",
        },
      });

      // Force sync manifest
      const result = await this.forceSync();

      if (result.success) {
        await window.electronAPI.sendMqttMessage({
          topic: "its/billboard/status",
          message: {
            action: "refresh-completed",
            timestamp: Date.now(),
            manifest: this.currentManifest,
            source: "desktop-app",
          },
        });
        console.log(
          "RendererLogoManifestService: Force refresh completed successfully"
        );
      } else {
        await window.electronAPI.sendMqttMessage({
          topic: "its/billboard/status",
          message: {
            action: "refresh-failed",
            timestamp: Date.now(),
            error: result.error,
            source: "desktop-app",
          },
        });
      }
    } catch (error) {
      console.error(
        "RendererLogoManifestService: Force refresh failed:",
        error
      );
    }
  }

  async handleBannerUpdate(command) {
    console.log(
      "RendererLogoManifestService: Handling banner update from admin-web:",
      command
    );

    // Force sync to get latest manifest with new banner
    await this.forceSync();

    // Send confirmation back to admin-web
    try {
      await window.electronAPI.sendMqttMessage({
        topic: "its/billboard/banner/sync",
        message: {
          action: "banner-received",
          bannerId: command.id,
          timestamp: Date.now(),
          source: "desktop-app",
        },
      });
    } catch (error) {
      console.error("Failed to send banner update confirmation:", error);
    }
  }

  async handleBannerDelete(command) {
    console.log(
      "RendererLogoManifestService: Handling banner delete from admin-web:",
      command
    );

    // Remove banner from local storage if needed
    if (command.bannerId) {
      await window.electronAPI.deleteBannerFile(command.bannerId);
    }

    // Force sync to get updated manifest
    await this.forceSync();
  }

  async handleSettingsSync(command) {
    console.log(
      "RendererLogoManifestService: Handling settings sync from admin-web:",
      command
    );

    // Apply new settings
    if (command.settings) {
      await window.electronAPI.updateDisplaySettings({
        displayMode: command.settings.displayMode,
        loopDuration: command.settings.loopDuration,
      });

      console.log(
        "RendererLogoManifestService: Display settings updated:",
        command.settings
      );
    }
  }

  startAutoSync() {
    // Sync manifest every 30 seconds
    setInterval(async () => {
      if (this.isInitialized) {
        console.log("RendererLogoManifestService: Auto-sync check...");
        await this.forceSync();
      }
    }, 30000);

    console.log(
      "RendererLogoManifestService: Auto-sync started (30s interval)"
    );
  }

  async downloadNewBanners() {
    if (!this.currentManifest?.logos || this.isDownloading) {
      return;
    }

    this.isDownloading = true;

    try {
      const logosToDownload = this.currentManifest.logos.filter(
        (logo) => logo.active && logo.url && !logo.isDownloaded
      );

      if (logosToDownload.length > 0) {
        console.log(
          `RendererLogoManifestService: Downloading ${logosToDownload.length} new banners...`
        );

        for (const logo of logosToDownload) {
          try {
            await window.electronAPI.downloadBanner({
              url: logo.url,
              filename: logo.filename,
              id: logo.id,
            });
            console.log(`Downloaded banner: ${logo.filename}`);
          } catch (error) {
            console.error(`Failed to download banner ${logo.filename}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(
        "RendererLogoManifestService: Banner download failed:",
        error
      );
    } finally {
      this.isDownloading = false;
    }
  }

  async fetchInitialManifest() {
    if (!window.electronAPI) {
      throw new Error("electronAPI not available");
    }

    try {
      const manifest = await window.electronAPI.getLogoManifest();
      if (manifest) {
        console.log(
          "RendererLogoManifestService: Retrieved initial manifest from main process:",
          {
            version: manifest.version,
            logoCount: manifest.logos?.length || 0,
          }
        );
        this.currentManifest = manifest;
        this.notifyUpdateCallbacks();
      } else {
        console.log(
          "RendererLogoManifestService: No initial manifest available from main process"
        );
      }
    } catch (error) {
      console.error(
        "RendererLogoManifestService: Failed to fetch initial manifest:",
        error
      );
      throw error;
    }
  }

  getCurrentManifest() {
    return this.currentManifest;
  }

  async forceSync() {
    console.log("RendererLogoManifestService: Force sync requested...");

    if (!window.electronAPI) {
      console.error(
        "RendererLogoManifestService: electronAPI not available for force sync"
      );
      return { success: false, error: "electronAPI not available" };
    }

    try {
      const result = await window.electronAPI.forceSyncManifest();
      if (result.success) {
        console.log("RendererLogoManifestService: Force sync successful");
        this.currentManifest = result.manifest;
        this.notifyUpdateCallbacks();

        // Download any new banners after sync
        await this.downloadNewBanners();
      } else {
        console.error(
          "RendererLogoManifestService: Force sync failed:",
          result.error
        );
      }
      return result;
    } catch (error) {
      console.error(
        "RendererLogoManifestService: Failed to trigger force sync:",
        error
      );
      return { success: false, error: error.message };
    }
  }

  async sendStatusToAdminWeb(status) {
    try {
      if (this.mqttConnected && window.electronAPI) {
        await window.electronAPI.sendMqttMessage({
          topic: "its/billboard/status",
          message: {
            ...status,
            timestamp: Date.now(),
            source: "desktop-app",
            manifest: this.currentManifest,
          },
        });
      }
    } catch (error) {
      console.error(
        "RendererLogoManifestService: Failed to send status to admin-web:",
        error
      );
    }
  }

  async getStatus() {
    if (!window.electronAPI) {
      return { enabled: false, error: "electronAPI not available" };
    }

    try {
      return await window.electronAPI.getManifestStatus();
    } catch (error) {
      console.error(
        "RendererLogoManifestService: Failed to get status:",
        error
      );
      return { enabled: false, error: error.message };
    }
  }

  onManifestUpdate(callback) {
    this.updateCallbacks.push(callback);

    // Immediately call with current manifest if available
    if (this.currentManifest) {
      try {
        callback(this.currentManifest);
      } catch (error) {
        console.error(
          "RendererLogoManifestService: Error in initial manifest callback:",
          error
        );
      }
    }

    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  notifyUpdateCallbacks() {
    if (!this.currentManifest) return;

    this.updateCallbacks.forEach((callback) => {
      try {
        callback(this.currentManifest);
      } catch (error) {
        console.error(
          "RendererLogoManifestService: Error in manifest update callback:",
          error
        );
      }
    });
  }

  destroy() {
    this.currentManifest = null;
    this.updateCallbacks = [];
    this.isInitialized = false;
    console.log("RendererLogoManifestService: Destroyed");
  }
}

// Global Logo Manifest Service Manager
class GlobalLogoManifestServiceManager {
  static instance = null;

  static getInstance() {
    if (!GlobalLogoManifestServiceManager.instance) {
      console.log("Creating global logo manifest service");
      GlobalLogoManifestServiceManager.instance =
        new RendererLogoManifestService();

      // Initialize the service
      GlobalLogoManifestServiceManager.instance.initialize().then((success) => {
        if (success) {
          console.log("Global logo manifest service initialized successfully");
        } else {
          console.error("Failed to initialize global logo manifest service");
        }
      });
    }

    return GlobalLogoManifestServiceManager.instance;
  }

  static subscribe(callback) {
    const instance = GlobalLogoManifestServiceManager.getInstance();
    return instance.onManifestUpdate(callback);
  }

  static async forceSync() {
    const instance = GlobalLogoManifestServiceManager.getInstance();
    return await instance.forceSync();
  }

  static getCurrentManifest() {
    const instance = GlobalLogoManifestServiceManager.getInstance();
    return instance.getCurrentManifest();
  }

  static async getStatus() {
    const instance = GlobalLogoManifestServiceManager.getInstance();
    return await instance.getStatus();
  }
}

// Weather Icons System - Using Custom Image Files
const WeatherIcons = {
  CLEAR_DAY: "../assets/imgs/sun.png",
  PARTLY_CLOUDY: "../assets/imgs/weather.png",
  CLOUDY: "../assets/imgs/weather.png",
  RAINY: "../assets/imgs/storm.png",
  HEAVY_RAIN: "../assets/imgs/storm.png",
  THUNDERSTORM: "../assets/imgs/storm.png",
  SNOW: "../assets/imgs/weather.png",
  FOG: "../assets/imgs/weather.png",
  WIND: "../assets/imgs/wind.png",
  DEFAULT: "../assets/imgs/weather.png",
};

function getWeatherIcon(weatherCode, condition) {
  // Clear sky conditions
  if (
    weatherCode === 0 ||
    weatherCode === 1 ||
    condition.includes("quang") ||
    condition.includes("nắng")
  ) {
    return WeatherIcons.CLEAR_DAY;
  }

  // Partly cloudy conditions
  if (
    weatherCode === 2 ||
    weatherCode === 3 ||
    condition.includes("mây") ||
    condition.includes("u ám")
  ) {
    return WeatherIcons.PARTLY_CLOUDY;
  }

  // Overcast/cloudy conditions
  if (condition.includes("âm u") || condition.includes("nhiều mây")) {
    return WeatherIcons.CLOUDY;
  }

  // Rain conditions - expanded to include all rain codes (51-65: drizzle/rain, 80-82: rain showers)
  if (
    (weatherCode >= 51 && weatherCode <= 65) || // Drizzle and rain
    (weatherCode >= 80 && weatherCode <= 82) || // Rain showers
    condition.includes("mưa") ||
    condition.includes("phùn")
  ) {
    return WeatherIcons.RAINY;
  }

  // Thunderstorm conditions - use RAINY icon as fallback
  if ((weatherCode >= 95 && weatherCode <= 99) || condition.includes("dông")) {
    return WeatherIcons.RAINY;
  }

  // Snow conditions - use CLOUDY icon as fallback
  if ((weatherCode >= 71 && weatherCode <= 75) || condition.includes("tuyết")) {
    return WeatherIcons.CLOUDY;
  }

  // Fog conditions - use CLOUDY icon as fallback
  if (weatherCode === 45 || weatherCode === 48 || condition.includes("sương")) {
    return WeatherIcons.CLOUDY;
  }

  return WeatherIcons.DEFAULT;
}

// Enhanced WeatherService with proper logging and error handling
class WeatherService {
  constructor(config) {
    this.config = config;
    this.currentData = null;
    this.isUpdating = false;
    this.retryCount = 0;
    this.initializeService();
  }

  async initializeService() {
    console.log("WeatherService: Initializing for", this.config.location.city);

    try {
      console.log("WeatherService: Starting initial fetch...");
      await this.fetchWeatherData();
      console.log("WeatherService: Initial fetch completed successfully");
    } catch (error) {
      console.error("WeatherService: Initial fetch failed:", error);
    }

    this.startPeriodicUpdates();
  }

  startPeriodicUpdates() {
    setInterval(() => {
      this.fetchWeatherData();
    }, this.config.updateInterval * 60 * 1000);
    console.log(
      `WeatherService: Updates every ${this.config.updateInterval} minutes`
    );
  }

  async fetchWeatherData() {
    if (this.isUpdating) {
      console.log("WeatherService: Update in progress, skipping");
      return;
    }

    this.isUpdating = true;

    try {
      console.log("WeatherService: Fetching from OpenMeteo API");
      const { lat, lon, city } = this.config.location;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,uv_index,apparent_temperature,precipitation_probability,visibility&timezone=Asia/Ho_Chi_Minh&forecast_days=1`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "ITS-Billboard/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const current = data.current_weather;
      const hourly = data.hourly;

      if (!current) {
        throw new Error("No current weather data");
      }

      const currentHour = new Date().getHours();

      this.currentData = {
        cityName: city,
        temperature: Math.round(current.temperature),
        feelsLike: Math.round(
          hourly.apparent_temperature?.[currentHour] || current.temperature
        ),
        humidity: Math.round(hourly.relativehumidity_2m?.[currentHour] || 70),
        windSpeed: Math.round(current.windspeed),
        uvIndex: Math.round(hourly.uv_index[currentHour] || 3),
        rainProbability: Math.round(
          hourly.precipitation_probability[currentHour] || 20
        ),
        weatherCondition: this.getWeatherCondition(current.weathercode),
        weatherCode: current.weathercode,
        airQuality: "Tốt",
        aqi: 1,
        visibility: 10,
        lastUpdated: new Date(),
      };

      this.retryCount = 0;
      console.log("WeatherService: Data updated successfully", {
        temp: this.currentData.temperature,
        condition: this.currentData.weatherCondition,
        humidity: this.currentData.humidity,
      });

      // Notify subscribers immediately after successful update
      GlobalWeatherServiceManager.notifySubscribers(this.currentData);
    } catch (error) {
      console.error("WeatherService: API failed", error);
      this.handleFetchFailure();
    } finally {
      this.isUpdating = false;
    }
  }

  handleFetchFailure() {
    this.retryCount++;
    console.error(
      `WeatherService: Failed (${this.retryCount}/${this.config.maxRetries})`
    );

    if (this.retryCount >= this.config.maxRetries) {
      console.error("WeatherService: Max retries reached, using fallback data");
      this.useFallbackData();
      this.retryCount = 0;
    }
  }

  useFallbackData() {
    if (!this.currentData) {
      this.currentData = {
        cityName: this.config.location.city,
        temperature: 25,
        feelsLike: 27,
        humidity: 70,
        windSpeed: 5,
        uvIndex: 3,
        rainProbability: 30,
        weatherCondition: "Không có dữ liệu",
        weatherCode: 0,
        airQuality: "Tốt",
        aqi: 1,
        visibility: 10,
        lastUpdated: new Date(),
      };
      console.log("WeatherService: Using fallback data");
    }
  }

  getWeatherCondition(code) {
    const conditions = {
      0: "Trời quang đãng",
      1: "Chủ yếu quang đãng",
      2: "Một phần có mây",
      3: "U ám",
      45: "Sương mù",
      48: "Sương mù đóng băng",
      51: "Mưa phùn nhẹ",
      53: "Mưa phùn vừa",
      55: "Mưa phùn dày đặc",
      56: "Mưa phùn đóng băng nhẹ",
      57: "Mưa phùn đóng băng dày đặc",
      61: "Mưa nhẹ",
      63: "Mưa vừa",
      65: "Mưa to",
      66: "Mưa đóng băng nhẹ",
      67: "Mưa đóng băng to",
      71: "Tuyết rơi nhẹ",
      73: "Tuyết rơi vừa",
      75: "Tuyết rơi to",
      77: "Hạt tuyết",
      80: "Mưa rào nhẹ",
      81: "Mưa rào vừa",
      82: "Mưa rào to",
      85: "Tuyết rào nhẹ",
      86: "Tuyết rào to",
      95: "Dông",
      96: "Dông có mưa đá nhẹ",
      99: "Dông có mưa đá to",
    };
    return conditions[code] || "Không xác định";
  }

  getCurrentWeather() {
    return this.currentData;
  }

  async refreshWeatherData() {
    if (this.currentData) {
      const dataAge = Date.now() - this.currentData.lastUpdated.getTime();
      if (dataAge < 5 * 60 * 1000) {
        console.log("WeatherService: Data is fresh, no refresh needed");
        return;
      }
    }
    console.log("WeatherService: Manual refresh requested");
    await this.fetchWeatherData();
  }
}

// Global Weather Service Manager
class GlobalWeatherServiceManager {
  static instance = null;
  static subscribers = new Set();

  static getInstance() {
    if (!GlobalWeatherServiceManager.instance) {
      const weatherConfig = {
        location: {
          lat: 16.4637,
          lon: 107.5909,
          city: "TP. THỪA THIÊN HUẾ",
        },
        updateInterval: 2,
        retryInterval: 5,
        maxRetries: 3,
      };

      console.log("Creating global weather service");
      GlobalWeatherServiceManager.instance = new WeatherService(weatherConfig);
      console.log("Global weather service created successfully");

      // Notify subscribers every 30 seconds
      setInterval(() => {
        const data =
          GlobalWeatherServiceManager.instance?.getCurrentWeather() || null;
        GlobalWeatherServiceManager.notifySubscribers(data);
      }, 30000);
    }

    return GlobalWeatherServiceManager.instance;
  }

  static subscribe(callback) {
    GlobalWeatherServiceManager.subscribers.add(callback);

    // Ensure instance is created first by calling getInstance
    console.log(
      "GlobalWeatherServiceManager: Subscribe called, ensuring instance..."
    );
    const instance = GlobalWeatherServiceManager.getInstance();

    // Immediately provide current data
    const currentData = instance.getCurrentWeather() || null;
    console.log(
      "GlobalWeatherServiceManager: Providing initial data:",
      !!currentData
    );
    callback(currentData);

    // Return unsubscribe function
    return () => {
      GlobalWeatherServiceManager.subscribers.delete(callback);
    };
  }

  static notifySubscribers(data) {
    GlobalWeatherServiceManager.subscribers.forEach((callback) =>
      callback(data)
    );
  }
}

// WeatherPanel Component with Real API Integration
function WeatherPanel({ className = "", eraIotService = null }) {
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("offline");
  const [lastClickTime, setLastClickTime] = useState(0);

  // E-Ra IoT data state
  const [eraIotData, setEraIotData] = useState(null);

  useEffect(() => {
    // Subscribe to global weather service
    const unsubscribe = GlobalWeatherServiceManager.subscribe((data) => {
      if (data) {
        setWeatherData(data);
        setConnectionStatus("connected");
        setIsLoading(false);
        console.log("WeatherPanel: Received weather data update:", {
          temp: data.temperature,
          humidity: data.humidity,
          lastUpdated: data.lastUpdated.toLocaleTimeString(),
          source: "GlobalService",
        });
      } else {
        setConnectionStatus("error");
        console.log(
          "WeatherPanel: No weather data available from global service"
        );
      }
    });

    return unsubscribe;
  }, []);

  // Subscribe to E-Ra IoT data updates
  useEffect(() => {
    if (eraIotService) {
      console.log("WeatherPanel: Setting up E-Ra IoT data subscription");

      const handleEraDataUpdate = (data) => {
        console.log("WeatherPanel: Received E-Ra IoT data:", data);
        setEraIotData(data);
      };

      // Subscribe to data updates
      eraIotService.onDataUpdate(handleEraDataUpdate);

      return () => {
        console.log("WeatherPanel: Cleaning up E-Ra IoT subscription");
        // Cleanup subscription if needed
      };
    }
  }, [eraIotService]);

  // Handle manual refresh with intelligent caching and click throttling
  const handleRefresh = async () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;

    // Prevent rapid clicking (throttle to 2 seconds)
    if (timeSinceLastClick < 2000) {
      console.log("WeatherPanel: Click throttled, ignoring rapid click");
      return;
    }

    setLastClickTime(now);

    if (weatherData) {
      const dataAge = now - weatherData.lastUpdated.getTime();
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

      // Only refresh if data is older than 10 minutes (conservative approach)
      if (dataAge > tenMinutes) {
        console.log(
          "WeatherPanel: Data is stale (>10min), requesting refresh..."
        );
        setIsLoading(true);

        const weatherService = GlobalWeatherServiceManager.getInstance();
        await weatherService.refreshWeatherData();

        // Data will be updated through subscription, no need to manually set
        setIsLoading(false);
      } else {
        console.log(
          `WeatherPanel: Data is fresh (${Math.round(
            dataAge / 60000
          )}min old), no refresh needed`
        );

        // Visual feedback for user click even when no refresh happens
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 300);
      }
    } else {
      // No data at all, force refresh
      console.log("WeatherPanel: No data available, forcing refresh...");
      setIsLoading(true);
      const weatherService = GlobalWeatherServiceManager.getInstance();
      await weatherService.refreshWeatherData();
      setIsLoading(false);
    }
  };

  // Format UV Index level
  const getUVLevel = (uvIndex) => {
    if (uvIndex <= 2) return "Thấp";
    if (uvIndex <= 5) return "Trung bình";
    if (uvIndex <= 7) return "Cao";
    if (uvIndex <= 10) return "Rất cao";
    return "Cực cao";
  };

  // Get air quality CSS class based on AQI value
  const getAirQualityClass = (aqi) => {
    switch (aqi) {
      case 1:
        return "good";
      case 2:
        return "fair";
      case 3:
        return "moderate";
      case 4:
        return "poor";
      case 5:
        return "very-poor";
      default:
        return "";
    }
  };

  // Get air quality badge color and text based on AQI
  const getAirQualityBadge = (aqi, airQuality) => {
    switch (aqi) {
      case 1:
        return { color: "#4ade80", text: "TỐT" }; // Green - Good
      case 2:
        return { color: "#fbbf24", text: "KHẤP" }; // Yellow - Fair
      case 3:
        return { color: "#f97316", text: "TB" }; // Orange - Moderate
      case 4:
        return { color: "#ef4444", text: "KÉM" }; // Red - Poor
      case 5:
        return { color: "#7c2d12", text: "XẤU" }; // Dark red - Very poor
      default:
        return { color: "#4ade80", text: "TỐT" };
    }
  };

  // Get weather type for styling
  const getWeatherType = (condition) => {
    if (
      condition?.includes("quang") ||
      condition?.includes("nắng") ||
      condition?.includes("Trời quang")
    ) {
      return "sunny";
    }
    if (condition?.includes("mưa") || condition?.includes("phùn")) {
      return "rainy";
    }
    if (
      condition?.includes("mây") ||
      condition?.includes("u ám") ||
      condition?.includes("U ám")
    ) {
      return "cloudy";
    }
    if (condition?.includes("dông") || condition?.includes("sấm")) {
      return "stormy";
    }
    return "default";
  };

  // Render loading state
  if (isLoading && !weatherData) {
    return React.createElement(
      "div",
      {
        className: `weather-panel unified loading ${className}`,
        style: {
          flex: "1",
          width: "100%",
          background:
            "linear-gradient(135deg, #142A3F 0%, #1e3a5f 50%, #1e3a5f 100%)",
          padding: "16px",
          border: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          position: "relative",
        },
      },
      [
        React.createElement("div", {
          key: "overlay",
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "transparent",
            zIndex: 1,
          },
        }),
        React.createElement(
          "div",
          {
            key: "title",
            style: {
              fontSize: "16px",
              fontWeight: "bold",
              marginBottom: "8px",
              zIndex: 2,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
            },
          },
          "TP. THỪA THIÊN HUẾ"
        ),
        React.createElement(
          "div",
          {
            key: "loading",
            style: {
              fontSize: "12px",
              zIndex: 2,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
            },
          },
          "Đang tải..."
        ),
      ]
    );
  }

  // Render error state
  if (!weatherData && connectionStatus === "error") {
    return React.createElement(
      "div",
      {
        className: `weather-panel unified error ${className}`,
        style: {
          flex: "1",
          width: "100%",
          background:
            "linear-gradient(135deg, #142A3F 0%, #1e3a5f 50%, #1e3a5f 100%)",
          padding: "16px",
          border: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          position: "relative",
        },
      },
      [
        React.createElement("div", {
          key: "overlay",
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "transparent",
            zIndex: 1,
          },
        }),
        React.createElement(
          "div",
          {
            key: "title",
            style: {
              fontSize: "16px",
              fontWeight: "bold",
              marginBottom: "8px",
              zIndex: 2,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
            },
          },
          "TP. THỪA THIÊN HUẾ"
        ),
        React.createElement(
          "div",
          {
            key: "error",
            style: {
              fontSize: "12px",
              color: "#ff6b6b",
              marginBottom: "8px",
              zIndex: 2,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
            },
          },
          "Lỗi kết nối"
        ),
        React.createElement(
          "button",
          {
            key: "retry",
            onClick: handleRefresh,
            style: {
              marginTop: "5px",
              padding: "4px 8px",
              fontSize: "10px",
              background: "#ff6b6b",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              zIndex: 2,
            },
          },
          "Thử lại"
        ),
      ]
    );
  }

  if (!weatherData) {
    return null;
  }

  const weatherType = getWeatherType(weatherData.weatherCondition);

  return React.createElement(
    "div",
    {
      className: `weather-panel unified ${weatherType} ${className}`,
      onClick: handleRefresh,
      style: {
        flex: "1",
        background:
          "linear-gradient(135deg, #142A3F 0%, #1e3a5f 50%, #1e3a5f 100%)",
        padding: "16px",
        border: "none",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        color: "white",
        position: "relative",
        overflow: "hidden",
      },
    },
    [
      // Background overlay for better readability
      React.createElement("div", {
        key: "overlay",
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "transparent",
          zIndex: 1,
        },
      }),
      // Header with city name
      React.createElement(
        "div",
        {
          key: "title",
          style: {
            fontSize: "16px",
            fontWeight: "bold",
            textAlign: "left", // Changed from center to left to align with IoT panel
            marginBottom: "0px", // Removed margin to move higher
            padding: "2px 6px", // Reduced right padding to align with IoT panel
            position: "relative",
            zIndex: 2,
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
            marginRight: "50px",
          },
        },
        [React.createElement("span", { key: "city" }, weatherData.cityName)]
      ),

      // Unified content container
      React.createElement(
        "div",
        {
          key: "unified-content",
          style: {
            flex: 1,
            padding: "0",
            display: "flex",
            flexDirection: "column",
            gap: "4px", // Further reduced gap to move content up more
            position: "relative",
            zIndex: 2,
          },
        },
        [
          // Main content - two column layout like in the image
          React.createElement(
            "div",
            {
              key: "main-content",
              style: {
                display: "flex",
                flex: 1,
                width: "100%",
              },
            },
            [
              // Left column - Weather info (like in image)
              React.createElement(
                "div",
                {
                  key: "weather-left",
                  style: {
                    flex: 1,
                    padding: "4px 0", // Removed right padding
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-between",
                  },
                },
                [
                  // Weather icon and main temperature
                  React.createElement(
                    "div",
                    {
                      key: "temp-main-container",
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        marginBottom: "0px", // Reduced from 4px to move content up
                      },
                    },
                    [
                      React.createElement("img", {
                        key: "weather-icon",
                        src: getWeatherIcon(
                          weatherData.weatherCode,
                          weatherData.weatherCondition
                        ),
                        alt: "Weather Icon",
                        style: {
                          width: "60px",
                          height: "60px",
                          objectFit: "contain",
                          filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5))",
                          flexShrink: 0,
                        },
                        onError: (e) => {
                          console.error(
                            "Failed to load weather icon:",
                            e.target.src
                          );
                          e.target.style.display = "none";
                        },
                      }),
                      React.createElement(
                        "div",
                        {
                          key: "temp-main",
                          style: {
                            fontSize: "48px",
                            fontWeight: "bold",
                            color: "#ffffff",
                            textShadow: "0 3px 6px rgba(0, 0, 0, 0.8)",
                            lineHeight: 1,
                          },
                        },
                        `${weatherData.temperature}°`
                      ),
                    ]
                  ),

                  // Weather details 2x2 grid - Hàng 1: Độ ẩm và UV, Hàng 2: Mưa và Gió
                  React.createElement(
                    "div",
                    {
                      key: "weather-details-grid",
                      style: {
                        width: "100%",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr", // 2 columns
                        gridTemplateRows: "1fr 1fr", // 2 rows
                        gap: "4px", // Consistent gap between all items
                        marginBottom: "2px", // Minimal margin
                        marginTop: "-8px", // Negative margin to bring elements directly close to main temperature
                        paddingLeft: "0px", // Remove left padding to shift more left
                        paddingRight: "8px",
                      },
                    },
                    [
                      // First row, first column: Độ ẩm
                      React.createElement(
                        "div",
                        {
                          key: "humidity",
                          style: {
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            padding: "6px 4px",
                            borderRadius: "3px",
                            minHeight: "35px",
                          },
                        },
                        [
                          React.createElement(
                            "div",
                            {
                              key: "label",
                              style: {
                                fontSize: "12px",
                                color: "#ffffffff",
                                opacity: 1,
                                textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                                marginBottom: "0px",
                                marginRight: "8px",
                                fontWeight: "600",
                                letterSpacing: "0.2px",
                                textTransform: "capitalize",
                                whiteSpace: "nowrap",
                              },
                            },
                            "Độ ẩm"
                          ),
                          React.createElement(
                            "div",
                            {
                              key: "value",
                              style: {
                                fontSize: "14px",
                                fontWeight: "bold",
                                color: "#ffffff",
                                textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                              },
                            },
                            weatherData.humidity + "%"
                          ),
                        ]
                      ),
                      // First row, second column: UV
                      React.createElement(
                        "div",
                        {
                          key: "uv",
                          style: {
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            padding: "6px 4px",
                            borderRadius: "3px",
                            minHeight: "35px",
                          },
                        },
                        [
                          React.createElement(
                            "div",
                            {
                              key: "label",
                              style: {
                                fontSize: "12px",
                                color: "#ffffffff",
                                opacity: 1,
                                textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                                marginBottom: "0px",
                                marginRight: "8px",
                                fontWeight: "600",
                                letterSpacing: "0.2px",
                                textTransform: "capitalize",
                                whiteSpace: "nowrap",
                              },
                            },
                            "UV"
                          ),
                          React.createElement(
                            "div",
                            {
                              key: "value",
                              style: {
                                fontSize: "14px",
                                fontWeight: "bold",
                                color: "#ffffff",
                                textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                              },
                            },
                            getUVLevel(weatherData.uvIndex)
                          ),
                        ]
                      ),
                      // Second row, first column: Mưa
                      React.createElement(
                        "div",
                        {
                          key: "rain",
                          style: {
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            padding: "6px 4px",
                            borderRadius: "3px",
                            minHeight: "35px",
                          },
                        },
                        [
                          React.createElement(
                            "div",
                            {
                              key: "label",
                              style: {
                                fontSize: "12px",
                                color: "#ffffffff",
                                opacity: 1,
                                textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                                marginBottom: "0px",
                                marginRight: "8px",
                                fontWeight: "600",
                                letterSpacing: "0.2px",
                                textTransform: "capitalize",
                                whiteSpace: "nowrap",
                              },
                            },
                            "Mưa"
                          ),
                          React.createElement(
                            "div",
                            {
                              key: "value",
                              style: {
                                fontSize: "14px",
                                fontWeight: "bold",
                                color: "#ffffff",
                                textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                              },
                            },
                            weatherData.rainProbability + "%"
                          ),
                        ]
                      ),
                      // Second row, second column: Gió
                      React.createElement(
                        "div",
                        {
                          key: "wind",
                          style: {
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            padding: "6px 4px",
                            borderRadius: "3px",
                            minHeight: "35px",
                          },
                        },
                        [
                          React.createElement(
                            "div",
                            {
                              key: "label",
                              style: {
                                fontSize: "12px",
                                color: "#ffffffff",
                                opacity: 1,
                                textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                                marginBottom: "0px",
                                marginRight: "8px",
                                fontWeight: "600",
                                letterSpacing: "0.2px",
                                textTransform: "capitalize",
                                whiteSpace: "nowrap",
                              },
                            },
                            "Gió"
                          ),
                          React.createElement(
                            "div",
                            {
                              key: "value",
                              style: {
                                fontSize: "14px",
                                fontWeight: "bold",
                                color: "#ffffff",
                                textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                              },
                            },
                            weatherData.windSpeed + " km/h"
                          ),
                        ]
                      ),
                    ]
                  ),

                  // New Air Quality Element - positioned higher to avoid alert banner
                  React.createElement(
                    "div",
                    {
                      key: "weather-air-quality",
                      style: {
                        width: "100%",
                        padding: "6px 8px",
                        margin: "-16px 0 4px 0", // Increased negative top margin to push even higher
                      },
                    },
                    [
                      React.createElement(
                        "div",
                        {
                          key: "air-quality-item",
                          style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "4px 6px",
                          },
                        },
                        [
                          React.createElement(
                            "span",
                            {
                              key: "air-quality-label",
                              style: {
                                fontSize: "13px",
                                color: "#ffffffff",
                                opacity: 1,
                                textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                                fontWeight: "600",
                                letterSpacing: "0.3px",
                                whiteSpace: "nowrap",
                              },
                            },
                            "Chất lượng không khí"
                          ),
                          React.createElement(
                            "span",
                            {
                              key: "air-quality-status-value",
                              style: {
                                fontSize: "15px",
                                fontWeight: "bold",
                                color: "#48bb78",
                                textShadow:
                                  "0 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(72, 187, 120, 0.3)",
                                padding: "2px 8px",
                                whiteSpace: "nowrap",
                              },
                            },
                            "TỐT"
                          ),
                        ]
                      ),
                    ]
                  ),

                  // Air quality status (bottom of left column)
                  React.createElement(
                    "div",
                    {
                      key: "air-quality-status",
                      style: {
                        fontSize: "14px",
                        color: "#ffffffff",
                        opacity: 1,
                        textAlign: "center",
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                        whiteSpace: "nowrap",
                      },
                    },
                    `Chất lượng không khí: ${weatherData.airQuality}`
                  ),
                ]
              ),

              // Right column - Device measurements (like in image)
              React.createElement(
                "div",
                {
                  key: "weather-right",
                  style: {
                    flex: "0 0 140px",
                    background: "transparent",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                  },
                },
                [
                  React.createElement(
                    "div",
                    {
                      key: "device-title",
                      className: "device-title-aligned", // Using CSS class instead of inline styles
                    },
                    "THIẾT BỊ ĐO"
                  ),

                  React.createElement(
                    "div",
                    {
                      key: "device-temp",
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        paddingBottom: "8px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                      },
                    },
                    [
                      React.createElement(
                        "span",
                        {
                          key: "label",
                          style: {
                            fontSize: "14px",
                            color: "#ffffff",
                            opacity: 0.9,
                          },
                        },
                        "Nhiệt độ"
                      ),
                      React.createElement(
                        "span",
                        {
                          key: "value",
                          style: {
                            fontSize: "13px",
                            fontWeight: "bold",
                            color: "#ffffff",
                            textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
                          },
                        },
                        `${
                          eraIotData
                            ? eraIotData.temperature || "N/A"
                            : weatherData
                            ? weatherData.temperature
                            : "N/A"
                        }°`
                      ),
                    ]
                  ),

                  React.createElement(
                    "div",
                    {
                      key: "device-humidity",
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        paddingBottom: "8px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                      },
                    },
                    [
                      React.createElement(
                        "span",
                        {
                          key: "label",
                          style: {
                            fontSize: "14px",
                            color: "#ffffff",
                            opacity: 0.9,
                          },
                        },
                        "Độ ẩm"
                      ),
                      React.createElement(
                        "span",
                        {
                          key: "value",
                          style: {
                            fontSize: "13px",
                            fontWeight: "bold",
                            color: "#ffffff",
                            textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
                          },
                        },
                        `${
                          eraIotData
                            ? eraIotData.humidity || "N/A"
                            : weatherData
                            ? weatherData.humidity
                            : "N/A"
                        }%`
                      ),
                    ]
                  ),

                  React.createElement(
                    "div",
                    {
                      key: "device-pm25",
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        paddingBottom: "8px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                      },
                    },
                    [
                      React.createElement(
                        "span",
                        {
                          key: "label",
                          style: {
                            fontSize: "14px",
                            color: "#ffffff",
                            opacity: 0.9,
                          },
                        },
                        "PM2.5"
                      ),
                      React.createElement(
                        "span",
                        {
                          key: "value",
                          style: {
                            fontSize: "13px",
                            fontWeight: "bold",
                            color: "#ffffff",
                            textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
                          },
                        },
                        [
                          eraIotData ? eraIotData.pm25 || "N/A" : "N/A",
                          React.createElement(
                            "span",
                            {
                              key: "unit",
                              style: {
                                fontSize: "9px",
                                fontWeight: "normal",
                                opacity: 0.8,
                                marginLeft: "2px",
                              },
                            },
                            "μg/m³"
                          ),
                        ]
                      ),
                    ]
                  ),

                  React.createElement(
                    "div",
                    {
                      key: "device-pm10",
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        paddingBottom: "8px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                      },
                    },
                    [
                      React.createElement(
                        "span",
                        {
                          key: "label",
                          style: {
                            fontSize: "14px",
                            color: "#ffffff",
                            opacity: 0.9,
                          },
                        },
                        "PM10"
                      ),
                      React.createElement(
                        "span",
                        {
                          key: "value",
                          style: {
                            fontSize: "13px",
                            fontWeight: "bold",
                            color: "#ffffff",
                            textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
                          },
                        },
                        [
                          eraIotData ? eraIotData.pm10 || "N/A" : "N/A",
                          React.createElement(
                            "span",
                            {
                              key: "unit",
                              style: {
                                fontSize: "9px",
                                fontWeight: "normal",
                                opacity: 0.8,
                                marginLeft: "2px",
                              },
                            },
                            "μg/m³"
                          ),
                        ]
                      ),
                    ]
                  ),

                  React.createElement(
                    "div",
                    {
                      key: "air-quality-badge",
                      style: {
                        background: "#4ade80",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: "bold",
                        textAlign: "center",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        marginTop: "-4px", // Further reduced to negative margin to move even higher
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                        boxShadow: "0 2px 4px rgba(74, 222, 128, 0.3)",
                      },
                    },
                    "TỐT"
                  ),
                ]
              ),
            ]
          ),
        ]
      ),

      // Loading overlay for refresh
      React.createElement(
        "div",
        {
          key: "loading-overlay",
          style: {
            display: isLoading ? "flex" : "none",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          },
        },
        React.createElement("div", {
          key: "refresh-spinner",
          style: {
            width: "16px",
            height: "16px",
            border: "2px solid #333",
            borderTop: "2px solid #ffffff",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          },
        })
      ),
    ]
  );
}

// IoTPanel removed - integrated into unified WeatherPanel

// CompanyLogo Component (Enhanced with GitHub CDN Manifest Support)
function CompanyLogo() {
  const [config, setConfig] = useState(null);
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);
  const [manifestLogos, setManifestLogos] = useState([]);
  const [useManifestLogos, setUseManifestLogos] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadConfig();

    // Setup config hot-reload listeners
    if (window.electronAPI && window.electronAPI.onConfigUpdated) {
      window.electronAPI.onConfigUpdated((event, newConfig) => {
        console.log("CompanyLogo: Config hot-reload received:", {
          logoMode: newConfig.logoMode,
          logoLoopDuration: newConfig.logoLoopDuration,
          logoImages: newConfig.logoImages?.length,
        });
        setConfig(newConfig);
      });
    }

    if (window.electronAPI && window.electronAPI.onLogoConfigUpdated) {
      window.electronAPI.onLogoConfigUpdated((event, logoConfig) => {
        console.log(
          "CompanyLogo: Logo-specific config update received:",
          logoConfig
        );
        setConfig((prevConfig) => ({
          ...prevConfig,
          logoMode: logoConfig.logoMode,
          logoLoopDuration: logoConfig.logoLoopDuration,
          logoImages: logoConfig.logoImages,
        }));
      });
    }

    // Setup manifest service subscription
    const unsubscribeManifest = GlobalLogoManifestServiceManager.subscribe(
      (manifest) => {
        console.log("CompanyLogo: Received manifest update:", {
          version: manifest.version,
          logoCount: manifest.logos?.length || 0,
        });

        // Convert manifest logos to local format
        const logos = manifest.logos
          .filter((logo) => logo.active)
          .sort((a, b) => a.priority - b.priority)
          .map((logo) => ({
            name: logo.name,
            path: `./downloads/logos/${logo.filename}`, // Use downloaded path
            size: logo.size,
            type: logo.type,
            id: logo.id,
            source: "github_cdn",
            checksum: logo.checksum,
          }));

        setManifestLogos(logos);

        // Use manifest logos if available and no local logos
        if (
          logos.length > 0 &&
          (!config?.logoImages || config.logoImages.length === 0)
        ) {
          console.log("CompanyLogo: Using manifest logos as primary source");
          setUseManifestLogos(true);
        }
      }
    );

    return () => {
      if (window.electronAPI && window.electronAPI.removeConfigListener) {
        window.electronAPI.removeConfigListener();
      }
      clearLogoInterval();
      unsubscribeManifest();

      // Enhanced cleanup for real-time sync event listeners
      if (typeof window !== "undefined") {
        window.removeEventListener("manifestUpdated", handleManifestRefresh);
        window.removeEventListener("bannerSyncComplete", handleManifestRefresh);
        window.removeEventListener(
          "admin-banner-updated",
          handleAdminBannerUpdate
        );
      }
    };

    // Enhanced real-time event handlers for admin-web sync
    function handleManifestRefresh() {
      console.log(
        "CompanyLogo: Admin triggered manifest refresh, reloading..."
      );
      if (GlobalLogoManifestServiceManager) {
        GlobalLogoManifestServiceManager.forceRefresh();
      }
    }

    function handleAdminBannerUpdate(event) {
      console.log(
        "CompanyLogo: Admin banner update event received:",
        event.detail
      );
      // Force immediate re-render with new banners
      setCurrentLogoIndex(0);
      handleManifestRefresh();
    }

    // Listen for admin-web remote sync events
    if (typeof window !== "undefined") {
      window.addEventListener("manifestUpdated", handleManifestRefresh);
      window.addEventListener("bannerSyncComplete", handleManifestRefresh);
      window.addEventListener("admin-banner-updated", handleAdminBannerUpdate);
    }
  }, []);

  useEffect(() => {
    clearLogoInterval();
    startLogoRotation();
  }, [config, manifestLogos, useManifestLogos]);

  const clearLogoInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log("CompanyLogo: Previous logo rotation interval cleared");
    }
  };

  const loadConfig = async () => {
    try {
      if (window.electronAPI) {
        const loadedConfig = await window.electronAPI.getConfig();
        setConfig(loadedConfig);
      } else {
        setConfig({
          logoMode: "fixed",
          logoImages: [],
          logoLoopDuration: 5,
        });
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }
  };

  const startLogoRotation = () => {
    const activeLogos = getActiveLogos();
    const mode = config?.logoMode || "fixed";

    if (mode === "loop" && activeLogos && activeLogos.length > 1) {
      const duration = (config?.logoLoopDuration || 5) * 1000;

      console.log(
        `CompanyLogo: Starting logo rotation with ${duration}ms interval (${
          config?.logoLoopDuration || 5
        }s)`
      );
      console.log(
        `CompanyLogo: Using ${useManifestLogos ? "manifest" : "local"} logos (${
          activeLogos.length
        } total)`
      );

      intervalRef.current = setInterval(() => {
        setCurrentLogoIndex((prev) => {
          const newIndex = (prev + 1) % activeLogos.length;
          console.log(
            `CompanyLogo: Switching to logo ${newIndex + 1}/${
              activeLogos.length
            } (${useManifestLogos ? "manifest" : "local"})`
          );
          return newIndex;
        });
      }, duration);
    } else {
      console.log(
        "CompanyLogo: Logo rotation not applicable - mode:",
        mode,
        "logos:",
        activeLogos?.length
      );
    }
  };

  const getActiveLogos = () => {
    if (useManifestLogos && manifestLogos.length > 0) {
      return manifestLogos;
    }
    return config?.logoImages || [];
  };

  const getCurrentLogo = () => {
    const activeLogos = getActiveLogos();

    if (!activeLogos || activeLogos.length === 0) {
      return null;
    }

    switch (config?.logoMode || "fixed") {
      case "fixed":
        return activeLogos[0];
      case "loop":
        return activeLogos[currentLogoIndex % activeLogos.length];
      case "scheduled":
        return getScheduledLogo(activeLogos);
      default:
        return activeLogos[0];
    }
  };

  const getScheduledLogo = (activeLogos) => {
    const now = new Date();
    const currentTime =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    const matchingSchedule = config?.schedules?.find(
      (schedule) => schedule.time === currentTime
    );

    if (matchingSchedule && activeLogos[parseInt(matchingSchedule.logoIndex)]) {
      return activeLogos[parseInt(matchingSchedule.logoIndex)];
    }

    return activeLogos[0];
  };

  const renderCustomLogo = (logo) => {
    // Enhanced path resolution with multiple fallbacks for remote sync
    let logoSrc;

    if (logo.source === "github_cdn") {
      // Use path from config with proper Windows path conversion
      const configPath = logo.path || `downloads/logos/${logo.filename}`;
      const absolutePath = configPath.replace(/\\/g, "/");
      logoSrc = `file:///F:/EoH Company/ITS_OurdoorScreen/${absolutePath}`;
    } else {
      // Local logo files
      logoSrc = `file://${logo.path}`;
    }

    return React.createElement("img", {
      src: logoSrc,
      alt: logo.name,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        borderRadius: "0",
        transition: "opacity 0.3s ease-in-out", // Smooth transitions for remote updates
      },
      onError: (e) => {
        console.error(
          "Failed to load logo:",
          logo.path,
          "Source:",
          logo.source
        );

        // Enhanced fallback strategy for GitHub CDN logos
        if (logo.source === "github_cdn") {
          if (logo.url && !e.target.src.includes("http")) {
            // First fallback: try direct HTTP URL from GitHub CDN
            console.log(
              "CompanyLogo: Trying direct CDN URL fallback:",
              logo.url
            );
            e.target.src = logo.url;
            return;
          } else {
            // Second fallback: try to find URL from current manifest
            const manifest =
              GlobalLogoManifestServiceManager.getCurrentManifest();
            const manifestLogo = manifest?.logos.find((l) => l.id === logo.id);
            if (
              manifestLogo &&
              manifestLogo.url &&
              !e.target.src.includes(manifestLogo.url)
            ) {
              console.log(
                "CompanyLogo: Trying manifest URL fallback:",
                manifestLogo.url
              );
              e.target.src = manifestLogo.url;
              return;
            }
          }
        }

        // Final fallback: hide image and show default logo
        console.warn("CompanyLogo: All fallbacks failed, hiding banner");
        e.target.style.display = "none";
      },
      onLoad: () => {
        // Log successful banner load from remote admin-web
        if (logo.source === "github_cdn") {
          console.log(
            `CompanyLogo: Successfully loaded remote banner: ${logo.name}`
          );
        }
      },
    });
  };

  const renderDefaultLogo = () => {
    return [
      React.createElement(
        "div",
        {
          key: "logo-circle",
          style: {
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "12px",
            fontSize: "36px",
            fontWeight: "bold",
            color: "#ff6b35",
            cursor: "pointer",
          },
        },
        "C"
      ),
      React.createElement(
        "div",
        {
          key: "text-container",
          style: {
            display: "flex",
            flexDirection: "column",
            color: "white",
          },
        },
        [
          React.createElement(
            "div",
            {
              key: "title",
              style: {
                fontSize: "18px",
                fontWeight: "bold",
                lineHeight: "1.2",
                margin: 0,
              },
            },
            "CÔNG TY"
          ),
          React.createElement(
            "div",
            {
              key: "subtitle",
              style: {
                fontSize: "12px",
                lineHeight: "1.2",
                margin: 0,
                opacity: 0.9,
              },
            },
            "VÌ CUỘC SỐNG TỐT ĐẸP HƠN"
          ),
        ]
      ),
    ];
  };

  const currentLogo = getCurrentLogo();
  const activeLogos = getActiveLogos();

  return React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      },
    },
    [currentLogo ? renderCustomLogo(currentLogo) : renderDefaultLogo()]
  );
}

// E-Ra IoT Service Integration (IPC-based)
class EraIotService {
  constructor(config) {
    this.config = config;
    this.currentData = null;
    this.isInitialized = false;
    this.dataUpdateCallbacks = [];
    this.statusUpdateCallbacks = [];

    console.log("EraIotService: Initializing with IPC-based communication");
    console.log("EraIotService: Config:", {
      enabled: config.enabled,
      authToken: config.authToken
        ? config.authToken.substring(0, 20) + "..."
        : "none",
      sensorConfigs: config.sensorConfigs,
    });
  }

  async startPeriodicUpdates() {
    console.log("EraIotService: Starting IPC-based connection...");

    try {
      // Set up IPC listeners for data from main process
      this.setupIpcListeners();

      // Get initial data from main process
      await this.fetchInitialData();

      console.log("EraIotService: Started IPC-based sensor data service");
      console.log(
        "EraIotService: Started IPC callback updates every 1 second for real-time UI responsiveness"
      );
      this.isInitialized = true;
    } catch (error) {
      console.error("EraIotService: Failed to start IPC connection:", error);
      this.useFallbackData(error);
    }
  }

  setupIpcListeners() {
    if (!window.electronAPI) {
      console.error("EraIotService: electronAPI not available");
      return;
    }

    // Listen for data updates from main process
    window.electronAPI.onEraIotDataUpdate((event, data) => {
      console.log(
        "EraIotService: Received data update from main process:",
        data
      );
      this.currentData = data;
      this.notifyDataUpdateCallbacks();
    });

    // Listen for status updates from main process
    window.electronAPI.onEraIotStatusUpdate((event, status) => {
      console.log(
        "EraIotService: Received status update from main process:",
        status
      );
      this.notifyStatusUpdateCallbacks(status);
    });

    console.log("EraIotService: IPC listeners established");
  }

  async fetchInitialData() {
    if (!window.electronAPI) {
      throw new Error("electronAPI not available");
    }

    try {
      const data = await window.electronAPI.getEraIotData();
      if (data) {
        console.log(
          "EraIotService: Retrieved initial data from main process:",
          data
        );
        this.currentData = data;
        this.notifyDataUpdateCallbacks();
      } else {
        console.log(
          "EraIotService: No initial data available from main process"
        );
      }
    } catch (error) {
      console.error("EraIotService: Failed to fetch initial data:", error);
      throw error;
    }
  }

  stopPeriodicUpdates() {
    // Remove IPC listeners
    if (window.electronAPI) {
      window.electronAPI.removeEraIotDataListener();
      window.electronAPI.removeEraIotStatusListener();
    }

    this.isInitialized = false;
    console.log("EraIotService: Stopped IPC-based updates");
  }

  useFallbackData(error) {
    this.currentData = {
      temperature: null,
      humidity: null,
      pm25: 15.0,
      pm10: 25.0,
      lastUpdated: new Date(),
      status: "error",
      errorMessage: `IPC Connection failed: ${
        error.message || "Unknown error"
      }`,
    };

    // Notify callbacks about fallback data
    this.notifyDataUpdateCallbacks();

    console.log("EraIotService: Using fallback sensor data");
  }

  getCurrentData() {
    return this.currentData;
  }

  async refreshData() {
    console.log(
      "EraIotService: Manual refresh requested - triggering main process refresh"
    );

    if (!window.electronAPI) {
      console.error("EraIotService: electronAPI not available for refresh");
      return;
    }

    try {
      const result = await window.electronAPI.refreshEraIotConnection();
      if (result.success) {
        console.log("EraIotService: Main process refresh successful");
        // Data will come through IPC listeners
      } else {
        console.error(
          "EraIotService: Main process refresh failed:",
          result.message
        );
      }
    } catch (error) {
      console.error(
        "EraIotService: Failed to trigger main process refresh:",
        error
      );
    }
  }

  destroy() {
    this.stopPeriodicUpdates();
    this.currentData = null;
    this.dataUpdateCallbacks = [];
    this.statusUpdateCallbacks = [];
    console.log("EraIotService: Destroyed");
  }

  // Notify all data update callbacks with current data
  notifyDataUpdateCallbacks() {
    if (!this.currentData) return;

    this.dataUpdateCallbacks.forEach((callback) => {
      try {
        callback(this.currentData);
      } catch (error) {
        console.error("EraIotService: Error in data update callback:", error);
      }
    });
  }

  // Notify all status update callbacks
  notifyStatusUpdateCallbacks(status) {
    this.statusUpdateCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error("EraIotService: Error in status update callback:", error);
      }
    });
  }

  // Subscribe to real-time data updates
  onDataUpdate(callback) {
    this.dataUpdateCallbacks.push(callback);

    // Immediately call with current data if available
    if (this.currentData) {
      try {
        callback(this.currentData);
      } catch (error) {
        console.error("EraIotService: Error in initial data callback:", error);
      }
    }

    return () => {
      const index = this.dataUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.dataUpdateCallbacks.splice(index, 1);
      }
    };
  }

  // Subscribe to service status updates
  onStatusUpdate(callback) {
    this.statusUpdateCallbacks.push(callback);

    // Immediately call with current status
    try {
      const status = {
        isRunning: this.isInitialized,
        lastUpdate: this.currentData?.lastUpdated || null,
        retryCount: 0,
        currentStatus: this.currentData?.status || "inactive",
      };
      callback(status);
    } catch (error) {
      console.error("EraIotService: Error in initial status callback:", error);
    }

    return () => {
      const index = this.statusUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusUpdateCallbacks.splice(index, 1);
      }
    };
  }
}

// IoT Panel Component
function IoTPanel({ eraIotService, className = "" }) {
  const [sensorData, setSensorData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [connectionStatus, setConnectionStatus] = React.useState("offline");

  React.useEffect(() => {
    if (!eraIotService) {
      console.log("IoTPanel: No E-Ra IoT service provided");
      setIsLoading(false);
      setConnectionStatus("offline");
      return;
    }

    console.log(
      "IoTPanel: Initializing with real-time E-Ra IoT service (1-second updates)"
    );

    const pollInterval = setInterval(() => {
      const data = eraIotService.getCurrentData();
      if (data) {
        console.log("IoTPanel: Real-time sensor data update:", data);
        setSensorData(data);
        setIsLoading(false);
        setConnectionStatus(data.status === "error" ? "error" : "connected");
      }
    }, 1000); // Now polls every 1 second to match service update frequency

    const initialData = eraIotService.getCurrentData();
    if (initialData) {
      setSensorData(initialData);
      setIsLoading(false);
      setConnectionStatus(
        initialData.status === "error" ? "error" : "connected"
      );
    }

    return () => {
      clearInterval(pollInterval);
    };
  }, [eraIotService]);

  const getSensorStatus = (value, type) => {
    if (value === null) return "offline";

    switch (type) {
      case "temperature":
        if (value >= 15 && value <= 35) return "good";
        if (value >= 10 && value <= 40) return "warning";
        return "error";
      case "humidity":
        if (value >= 30 && value <= 70) return "good";
        if (value >= 20 && value <= 80) return "warning";
        return "error";
      case "pm25":
        if (value <= 12) return "good";
        if (value <= 35) return "warning";
        return "error";
      case "pm10":
        if (value <= 20) return "good";
        if (value <= 50) return "warning";
        return "error";
      default:
        return "good";
    }
  };

  const formatSensorData = (data) => {
    return [
      {
        label: "Nhiệt độ",
        value:
          data.temperature !== null ? `${data.temperature.toFixed(1)}` : "--",
        unit: "°C",
        status: getSensorStatus(data.temperature, "temperature"),
      },
      {
        label: "Độ ẩm",
        value: data.humidity !== null ? `${data.humidity.toFixed(1)}` : "--",
        unit: "%",
        status: getSensorStatus(data.humidity, "humidity"),
      },
      {
        label: "PM2.5",
        value: data.pm25 !== null ? `${data.pm25.toFixed(1)}` : "--",
        unit: "μg/m³",
        status: getSensorStatus(data.pm25, "pm25"),
      },
      {
        label: "PM10",
        value: data.pm10 !== null ? `${data.pm10.toFixed(1)}` : "--",
        unit: "μg/m³",
        status: getSensorStatus(data.pm10, "pm10"),
      },
    ];
  };

  if (isLoading && !sensorData) {
    return React.createElement(
      "div",
      {
        style: {
          width: "153.6px",
          height: "288px",
          color: "#fff",
          background: "transparent",
          backgroundColor: "transparent",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "14px",
          padding: "8px",
          boxSizing: "border-box",
        },
      },
      [
        React.createElement(
          "div",
          {
            key: "title",
            style: {
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "6px",
            },
          },
          "THIẾT BỊ ĐO"
        ),
        React.createElement(
          "div",
          { key: "loading", style: { fontSize: "8px", color: "#888" } },
          "Đang kết nối..."
        ),
      ]
    );
  }

  if (!eraIotService || (!sensorData && connectionStatus === "error")) {
    return React.createElement(
      "div",
      {
        style: {
          width: "153.6px",
          height: "288px",
          color: "#fff",
          background: "transparent",
          backgroundColor: "transparent",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "14px",
          padding: "8px",
          boxSizing: "border-box",
        },
      },
      [
        React.createElement(
          "div",
          {
            key: "title",
            style: {
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "6px",
            },
          },
          "THIẾT BỊ ĐO"
        ),
        React.createElement(
          "div",
          { key: "error", style: { fontSize: "8px", color: "#ff4444" } },
          !eraIotService ? "Chưa cấu hình" : "Lỗi kết nối"
        ),
      ]
    );
  }

  if (!sensorData) {
    return React.createElement(
      "div",
      {
        style: {
          width: "153.6px",
          height: "288px",
          color: "#fff",
          background: "transparent",
          backgroundColor: "transparent",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "14px",
          padding: "8px",
          boxSizing: "border-box",
        },
      },
      [
        React.createElement(
          "div",
          {
            key: "title",
            style: {
              fontSize: "11px",
              fontWeight: "bold",
              marginBottom: "6px",
            },
          },
          "THIẾT BỊ ĐO"
        ),
        React.createElement(
          "div",
          { key: "offline", style: { fontSize: "8px", color: "#888" } },
          "Không có dữ liệu"
        ),
      ]
    );
  }

  // Calculate Air Quality Index based on PM2.5 and PM10
  const calculateAirQuality = (data) => {
    if (data.pm25 === null && data.pm10 === null) {
      return {
        status: "KHÔNG XÁC ĐỊNH",
        color: "#757575",
        label: "Không có dữ liệu",
      };
    }

    let pm25Level = 0;
    let pm10Level = 0;

    // WHO Air Quality Guidelines 2021 & EPA standards
    if (data.pm25 !== null) {
      if (data.pm25 <= 15) pm25Level = 1; // Good
      else if (data.pm25 <= 25) pm25Level = 2; // Moderate
      else if (data.pm25 <= 37.5) pm25Level = 3; // Unhealthy for sensitive
      else if (data.pm25 <= 75) pm25Level = 4; // Unhealthy
      else pm25Level = 5; // Very unhealthy
    }

    if (data.pm10 !== null) {
      if (data.pm10 <= 25) pm10Level = 1; // Good
      else if (data.pm10 <= 50) pm10Level = 2; // Moderate
      else if (data.pm10 <= 90) pm10Level = 3; // Unhealthy for sensitive
      else if (data.pm10 <= 180) pm10Level = 4; // Unhealthy
      else pm10Level = 5; // Very unhealthy
    }

    // Take the worst level between PM2.5 and PM10
    const maxLevel = Math.max(pm25Level, pm10Level);

    switch (maxLevel) {
      case 1:
        return {
          status: "TỐT",
          color: "#4CAF50",
          label: "Chất lượng không khí tốt",
        };
      case 2:
        return {
          status: "TRUNG BÌNH",
          color: "#FFC107",
          label: "Chất lượng không khí ở mức chấp nhận được",
        };
      case 3:
        return {
          status: "KÉM",
          color: "#FF9800",
          label: "Có thể gây hại cho nhóm nhạy cảm",
        };
      case 4:
        return {
          status: "XẤU",
          color: "#F44336",
          label: "Có thể gây hại cho sức khỏe",
        };
      case 5:
        return {
          status: "RẤT XẤU",
          color: "#9C27B0",
          label: "Nguy hiểm cho sức khỏe",
        };
      default:
        return {
          status: "TỐT",
          color: "#4CAF50",
          label: "Chất lượng không khí tốt",
        };
    }
  };

  const sensors = formatSensorData(sensorData);
  const airQuality = calculateAirQuality(sensorData);

  return React.createElement(
    "div",
    {
      className: "iot-panel " + className,
      style: {
        width: "153.6px",
        height: "288px",
        color: "#fff",
        // background: "transparent",
        // backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        padding: "8px",
        boxSizing: "border-box",
        fontSize: "14px",
        position: "relative",
      },
    },
    [
      // Background overlay for better text readability
      React.createElement("div", {
        key: "overlay",
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          // background: "transparent",
          zIndex: 1,
        },
      }),
      // Header
      React.createElement(
        "div",
        {
          key: "header",
          style: {
            textAlign: "center",
            marginBottom: "8px",
            position: "relative",
            zIndex: 2,
            paddingLeft: "6px",
          },
        },
        [
          React.createElement(
            "div",
            {
              key: "title",
              style: {
                fontSize: "16px", // Changed from 14px to 16px to match city name
                fontWeight: "bold",
                letterSpacing: "0.8px",
                color: "#ffffff",
                textShadow:
                  "0 2px 4px rgba(0, 0, 0, 0.8), 0 1px 0 rgba(255, 255, 255, 0.1)",
                textTransform: "uppercase",
                textAlign: "left", // Changed from center to left to align with city name
                marginBottom: "2px",
              },
            },
            "THIẾT BỊ ĐO"
          ),
          React.createElement("div", {
            key: "status",
            style: {
              position: "absolute",
              top: "0",
              right: "0",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor:
                connectionStatus === "connected"
                  ? "#4CAF50"
                  : connectionStatus === "error"
                  ? "#f44336"
                  : "#888",
            },
          }),
        ]
      ),

      // Status banner for partial/error states
      sensorData.status !== "success" &&
        React.createElement(
          "div",
          {
            key: "status-banner",
            style: {
              width: "100%",
              padding: "4px 6px",
              textAlign: "center",
              fontSize: "8px",
              fontWeight: "bold",
              marginBottom: "6px",
              borderRadius: "3px",
              backgroundColor:
                sensorData.status === "partial"
                  ? "rgba(255, 193, 7, 0.8)"
                  : "rgba(244, 67, 54, 0.8)",
              color: sensorData.status === "partial" ? "#333" : "white",
              position: "relative",
              zIndex: 2,
            },
          },
          sensorData.status === "partial"
            ? "Một số cảm biến offline"
            : "Lỗi kết nối"
        ),

      // Sensors grid - Single column layout, 4 rows
      React.createElement(
        "div",
        {
          key: "sensors-grid",
          style: {
            display: "grid",
            gridTemplateColumns: "1fr", // Single column
            gridTemplateRows: "repeat(4, 1fr)", // 4 equal rows
            gap: "6px",
            marginBottom: "8px",
            position: "relative",
            zIndex: 2,
            width: "95%", // Fill almost full width
            margin: "0 auto 8px auto", // Center the grid
          },
        },
        sensors.map((sensor, index) =>
          React.createElement(
            "div",
            {
              key: index,
              style: {
                display: "flex",
                flexDirection: "row", // Horizontal layout
                alignItems: "center",
                justifyContent: "space-between", // Space between label and value
                textAlign: "left",
                padding: "8px 12px", // More padding for better appearance
                background: "transparent", // No background
                width: "100%", // Fill full width
                boxSizing: "border-box",
              },
            },
            [
              React.createElement(
                "div",
                {
                  key: "label",
                  style: {
                    fontSize: "14px", // Increased font size for better readability
                    fontWeight: "bold",
                    color: "white",
                    opacity: 0.9,
                    whiteSpace: "nowrap", // Prevent text wrapping
                    flex: 1, // Take available space on left
                    textAlign: "left",
                  },
                },
                sensor.label
              ),
              React.createElement(
                "div",
                {
                  key: "value-container",
                  style: {
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "flex-end", // Right align values
                    flexShrink: 0, // Don't shrink
                  },
                },
                [
                  React.createElement(
                    "span",
                    {
                      key: "value",
                      style: {
                        fontSize: "16px", // Larger value font for better visibility
                        fontWeight: "bold",
                        marginRight: "4px", // Space before unit
                        color: "white",
                        whiteSpace: "nowrap", // Prevent wrapping
                      },
                    },
                    sensor.value
                  ),
                  React.createElement(
                    "span",
                    {
                      key: "unit",
                      style: {
                        fontSize: "10px", // Slightly larger unit font
                        opacity: 0.8,
                        fontWeight: "normal",
                        whiteSpace: "nowrap", // Prevent wrapping
                        color: "#b3d9ff", // Light blue color for units
                      },
                    },
                    sensor.unit
                  ),
                ]
              ),
            ]
          )
        )
      ),

      // Air Quality Indicator
      React.createElement(
        "div",
        {
          key: "air-quality-container",
          style: {
            display: "flex",
            justifyContent: "center",
            margin: "-4px auto 8px auto", // Negative top margin to move up, keep bottom margin for spacing from bottom
            width: "95%",
            position: "relative",
            zIndex: 2,
          },
        },
        React.createElement(
          "div",
          {
            key: "air-quality-indicator",
            style: {
              backgroundColor: airQuality.color,
              color: "white",
              fontSize: "12px",
              fontWeight: "bold",
              padding: "6px 16px",
              borderRadius: "6px",
              textAlign: "center",
              letterSpacing: "0.5px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
              minWidth: "60px",
            },
          },
          airQuality.status
        )
      ),

      // Simple footer
      React.createElement(
        "div",
        {
          key: "footer",
          style: {
            marginTop: "1px", // Fixed margin instead of auto
            paddingTop: "4px",
            fontSize: "7px",
            color: "#888",
            textAlign: "center",
            position: "relative",
            zIndex: 2,
            opacity: 0.7,
            fontWeight: "normal",
          },
        },
        sensorData ? sensorData.lastUpdated.toLocaleTimeString("vi-VN") : ""
      ),
    ]
  );
}

// Updated BillboardLayout with E-Ra IoT integration and full-width Weather Alert Banner
function BillboardLayout() {
  const [eraIotService, setEraIotService] = React.useState(null);
  const [weatherData, setWeatherData] = React.useState(null);
  const [showWeatherAlert, setShowWeatherAlert] = React.useState(false);
  const [configReloadTrigger, setConfigReloadTrigger] = React.useState(0);

  console.log("BillboardLayout: Component initialized");

  React.useEffect(() => {
    console.log(
      "BillboardLayout: useEffect triggered - configReloadTrigger:",
      configReloadTrigger
    );

    const initializeEraIot = async () => {
      try {
        console.log("BillboardLayout: Loading E-Ra IoT configuration...");

        // Cleanup existing service first
        if (eraIotService) {
          console.log("BillboardLayout: Cleaning up existing E-Ra IoT service");
          eraIotService.destroy();
          setEraIotService(null);
        }

        if (typeof window !== "undefined" && window.electronAPI) {
          console.log(
            "BillboardLayout: electronAPI available, fetching config..."
          );

          const config = await window.electronAPI.getConfig();
          console.log("BillboardLayout: Raw config received:", {
            hasEraIot: !!config?.eraIot,
            enabled: config?.eraIot?.enabled,
            hasAuthToken: !!config?.eraIot?.authToken,
          });

          if (
            config?.eraIot?.authToken &&
            config.eraIot.authToken.trim() !== ""
          ) {
            console.log("BillboardLayout: Initializing E-Ra IoT service");

            const eraConfig = {
              authToken: config.eraIot.authToken,
              baseUrl: config.eraIot.baseUrl || "https://backend.eoh.io",
              gatewayToken: config.eraIot.gatewayToken,
              sensorConfigs: config.eraIot.sensorConfigs || {
                temperature: 138997,
                humidity: 138998,
                pm25: 138999,
                pm10: 139000,
              },
              updateInterval: config.eraIot.updateInterval || 5,
              timeout: config.eraIot.timeout || 15000,
              retryAttempts: config.eraIot.retryAttempts || 3,
              retryDelay: config.eraIot.retryDelay || 2000,
            };

            const service = new EraIotService(eraConfig);
            await service.startPeriodicUpdates();
            setEraIotService(service);
            console.log(
              "BillboardLayout: E-Ra IoT service initialized successfully"
            );
          } else {
            console.log(
              "BillboardLayout: No valid E-Ra IoT AUTHTOKEN found or empty token"
            );
            setEraIotService(null);
          }
        } else {
          console.log("BillboardLayout: electronAPI not available");
        }
      } catch (error) {
        console.error(
          "BillboardLayout: Failed to initialize E-Ra IoT service:",
          error
        );
      }
    };

    initializeEraIot();

    return () => {
      if (eraIotService) {
        eraIotService.destroy();
      }
    };
  }, [configReloadTrigger]); // Re-run when config changes

  // Set up hot-reload listeners for configuration changes
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      console.log("BillboardLayout: Setting up config hot-reload listeners");

      const handleConfigUpdate = (event, newConfig) => {
        console.log(
          "BillboardLayout: Configuration hot-reload triggered",
          newConfig
        );
        setConfigReloadTrigger((prev) => prev + 1);
      };

      const handleForceRefresh = (event, newConfig) => {
        console.log(
          "BillboardLayout: Force refresh services triggered",
          newConfig
        );
        setConfigReloadTrigger((prev) => prev + 1);
      };

      // Set up listeners
      window.electronAPI.onConfigUpdated(handleConfigUpdate);
      window.electronAPI.onForceRefreshServices(handleForceRefresh);

      return () => {
        console.log("BillboardLayout: Cleaning up config listeners");
        window.electronAPI.removeConfigListener();
        window.electronAPI.removeForceRefreshListener();
      };
    }
  }, []);

  // Subscribe to weather data updates for alert banner
  React.useEffect(() => {
    const unsubscribe = GlobalWeatherServiceManager.subscribe((data) => {
      setWeatherData(data);

      // Always show weather banner, just change the content and status
      if (data) {
        const isHighRainRisk =
          data.rainProbability > 60 ||
          data.weatherCondition?.includes("mưa to") ||
          data.weatherCondition?.includes("dông");
        setShowWeatherAlert(isHighRainRisk);
        console.log(
          "BillboardLayout: Weather banner - High rain risk:",
          isHighRainRisk,
          "Rain probability:",
          data.rainProbability
        );
      } else {
        setShowWeatherAlert(false); // Default to stable when no data
      }
    });

    return unsubscribe;
  }, []);

  return React.createElement(
    "div",
    {
      style: {
        width: "384px",
        height: "384px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        margin: 0,
        padding: 0,
        position: "relative",
      },
    },
    [
      React.createElement(
        "div",
        {
          key: "top-row",
          style: {
            height: "288px", // Fixed height - LED specification requirement
            display: "flex",
            width: "100%",
          },
        },
        [
          React.createElement(WeatherPanel, {
            key: "weather",
            className: "unified-weather",
            eraIotService: eraIotService,
          }),
        ]
      ),

      // Weather Banner - Always visible with dynamic content
      React.createElement(
        "div",
        {
          key: "global-weather-banner",
          style: {
            position: "absolute",
            bottom: "110px", // Position above logo with 14px spacing from logo section
            left: "16px", // 16px margin from left edge
            right: "16px", // 16px margin from right edge
            height: "48px", // Fixed banner height
            width: "calc(100% - 32px)", // Full width minus left and right margins
            background: showWeatherAlert
              ? "linear-gradient(135deg, #dc2626, #b91c1c)" // Red for high rain risk
              : "linear-gradient(135deg, #059669, #047857)", // Green for stable weather
            color: "#ffe600ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0px",
            padding: "0 16px",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "1px",
            boxShadow: showWeatherAlert
              ? "0 4px 12px rgba(220, 38, 38, 0.4)" // Red shadow for alert
              : "0 4px 12px rgba(5, 150, 105, 0.4)", // Green shadow for stable
            zIndex: 10000000,
            boxSizing: "border-box",
            borderRadius: "4px", // Subtle rounding for modern look
          },
        },
        [
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
              },
            },
            [
              React.createElement(
                "div",
                {
                  key: "banner-icon",
                  style: {
                    position: "relative",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: "bold",
                    flexShrink: 0,
                    color: showWeatherAlert ? "#dc2626" : "#ffffff",
                    textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                  },
                },
                [
                  showWeatherAlert
                    ? React.createElement("div", {
                        style: {
                          position: "absolute",
                          top: "2px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 0,
                          height: 0,
                          borderLeft: "16px solid transparent",
                          borderRight: "16px solid transparent",
                          borderBottom: "26px solid #fbbf24",
                          zIndex: -1,
                        },
                      })
                    : null,
                  showWeatherAlert ? "!" : "✓",
                ]
              ),
              React.createElement(
                "div",
                {
                  key: "banner-text",
                  style: {
                    fontSize: "16px",
                    textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                    margin: 0,
                    whiteSpace: "nowrap",
                  },
                },
                showWeatherAlert ? "CẢNH BÁO MƯA LỚN" : "THỜI TIẾT ỔN ĐỊNH"
              ),
            ]
          ),
        ]
      ),

      React.createElement(
        "div",
        {
          key: "logo-section",
          style: {
            height: "96px", // Fixed height - LED specification requirement
            width: "100%",
            backgroundColor: "#ff6b35",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0",
            position: "relative",
            overflow: "hidden",
          },
        },
        React.createElement(CompanyLogo, { key: "logo" })
      ),
    ]
  );
}

// Main App Component
function App() {
  return React.createElement(
    "div",
    {
      style: {
        width: "384px",
        height: "384px",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        fontFamily: "Arial, sans-serif",
      },
    },
    React.createElement(BillboardLayout)
  );
}

// Initialize React App
document.addEventListener("DOMContentLoaded", () => {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App));

  console.log(
    "Billboard React App initialized with REAL WEATHER API integration"
  );
  console.log(
    "WeatherPanel now uses consistent data from GlobalWeatherServiceManager"
  );
});
