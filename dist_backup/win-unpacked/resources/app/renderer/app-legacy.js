// app.js - JavaScript version of React App
// Clean architecture using React components with proper logo management

// ====================================
// LOGO MANIFEST SERVICE (GitHub CDN Sync) - Phương án A Implementation
// ====================================

/**
 * Logo Manifest Service - JavaScript Implementation
 * Implements GitHub-based CDN sync for remote logo updates
 * Features: Auto-polling, download caching, hot-reload integration
 */
class LogoManifestService {
  constructor() {
    this.config = null;
    this.pollInterval = null;
    this.isInitialized = false;
    this.manifestCache = null;
    this.lastFetchTime = 0;
    this.retryCount = 0;

    console.log("LogoManifestService: Constructor called");
  }

  async initialize(config) {
    console.log("LogoManifestService: Initialize called with config:", config);

    if (!config || !config.enabled) {
      console.log("LogoManifestService: Service disabled or no config");
      return false;
    }

    this.config = config;

    try {
      console.log("LogoManifestService: Starting service...");
      console.log(`LogoManifestService: Manifest URL: ${config.manifestUrl}`);
      console.log(
        `LogoManifestService: Poll interval: ${config.pollInterval}s`
      );

      // Create download directory if needed
      await this.ensureDownloadDirectory();

      // Start polling
      this.startPolling();

      // Immediate first fetch
      await this.fetchAndProcessManifest();

      this.isInitialized = true;
      console.log("LogoManifestService: ✅ Initialized successfully");
      return true;
    } catch (error) {
      console.error("LogoManifestService: ❌ Initialization failed:", error);
      return false;
    }
  }

  async ensureDownloadDirectory() {
    try {
      if (window.electronAPI && window.electronAPI.ensureDirectory) {
        await window.electronAPI.ensureDirectory(
          this.config.downloadPath + "/logos"
        );
        console.log("LogoManifestService: Download directory ensured");
      }
    } catch (error) {
      console.warn(
        "LogoManifestService: Could not ensure download directory:",
        error
      );
    }
  }

  startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    const intervalMs = (this.config.pollInterval || 30) * 1000;
    console.log(`LogoManifestService: Starting polling every ${intervalMs}ms`);

    this.pollInterval = setInterval(() => {
      this.fetchAndProcessManifest();
    }, intervalMs);
  }

  async fetchAndProcessManifest() {
    console.log("LogoManifestService: Fetching manifest from CDN...");

    try {
      const manifest = await this.fetchManifest();

      if (manifest) {
        console.log("LogoManifestService: ✅ Manifest fetched successfully");
        console.log(`LogoManifestService: Version: ${manifest.version}`);
        console.log(
          `LogoManifestService: Active logos: ${
            manifest.logos.filter((l) => l.active).length
          }`
        );

        // Check if manifest has changed
        if (this.hasManifestChanged(manifest)) {
          console.log(
            "LogoManifestService: 🔄 Manifest has changed, processing updates..."
          );

          // Process logo downloads
          await this.processLogoDownloads(manifest);

          // Update local config
          await this.updateLocalConfig(manifest);

          // Cache new manifest
          this.manifestCache = manifest;

          // Trigger hot reload
          this.triggerHotReload(manifest);

          this.retryCount = 0;
        } else {
          console.log("LogoManifestService: No changes detected");
        }

        this.lastFetchTime = Date.now();
      } else {
        throw new Error("Manifest fetch returned null");
      }
    } catch (error) {
      console.error("LogoManifestService: ❌ Fetch failed:", error);
      this.retryCount++;

      if (this.retryCount < (this.config.retryAttempts || 3)) {
        console.log(
          `LogoManifestService: Retrying in ${
            this.config.retryDelay || 2000
          }ms... (${this.retryCount}/${this.config.retryAttempts})`
        );
        setTimeout(() => {
          this.fetchAndProcessManifest();
        }, this.config.retryDelay || 2000);
      }
    }
  }

  async fetchManifest() {
    const url = this.config.manifestUrl;
    console.log(`LogoManifestService: Fetching from ${url}`);

    try {
      // Handle file:// URLs (local testing)
      if (url.startsWith("file://")) {
        if (window.electronAPI && window.electronAPI.readFile) {
          const localPath = url.replace("file:///", "").replace(/%20/g, " ");
          console.log(`LogoManifestService: Reading local file: ${localPath}`);
          const content = await window.electronAPI.readFile(localPath);
          return JSON.parse(content);
        } else {
          throw new Error("electronAPI.readFile not available for local file");
        }
      }

      // Handle HTTP/HTTPS URLs
      const response = await fetch(url, {
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`LogoManifestService: Failed to fetch manifest:`, error);
      return null;
    }
  }

  hasManifestChanged(newManifest) {
    if (!this.manifestCache) {
      return true; // First time
    }

    return (
      this.manifestCache.version !== newManifest.version ||
      this.manifestCache.lastUpdated !== newManifest.lastUpdated
    );
  }

  async processLogoDownloads(manifest) {
    console.log("LogoManifestService: Processing logo downloads...");

    const activeLogos = manifest.logos.filter((logo) => logo.active);

    for (const logo of activeLogos) {
      try {
        await this.downloadLogoIfNeeded(logo);
      } catch (error) {
        console.error(
          `LogoManifestService: Failed to download logo ${logo.name}:`,
          error
        );
      }
    }
  }

  async downloadLogoIfNeeded(logo) {
    const localPath = `${this.config.downloadPath}/logos/${logo.filename}`;

    try {
      if (window.electronAPI && window.electronAPI.fileExists) {
        const exists = await window.electronAPI.fileExists(localPath);

        if (!exists) {
          console.log(`LogoManifestService: Downloading ${logo.name}...`);
          await this.downloadLogo(logo, localPath);
        } else {
          console.log(`LogoManifestService: Logo ${logo.name} already cached`);
        }
      }
    } catch (error) {
      console.error(
        `LogoManifestService: Download check failed for ${logo.name}:`,
        error
      );
    }
  }

  async downloadLogo(logo, localPath) {
    try {
      const response = await fetch(logo.url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      if (window.electronAPI && window.electronAPI.writeFile) {
        await window.electronAPI.writeFile(localPath, Buffer.from(arrayBuffer));
        console.log(
          `LogoManifestService: ✅ Downloaded ${logo.name} to ${localPath}`
        );
      } else {
        throw new Error("electronAPI.writeFile not available");
      }
    } catch (error) {
      console.error(
        `LogoManifestService: Download failed for ${logo.name}:`,
        error
      );
      throw error;
    }
  }

  async updateLocalConfig(manifest) {
    try {
      if (
        window.electronAPI &&
        window.electronAPI.getConfig &&
        window.electronAPI.updateConfig
      ) {
        const currentConfig = await window.electronAPI.getConfig();

        // Convert manifest logos to config format with absolute paths
        const path = require("path");
        const logoImages = manifest.logos
          .filter((logo) => logo.active)
          .sort((a, b) => a.priority - b.priority)
          .map((logo) => {
            // Create absolute path for downloaded logos
            const relativePath = `${this.config.downloadPath}/logos/${logo.filename}`;
            const absolutePath = path.resolve(relativePath);

            console.log(
              `Logo path mapping: ${logo.filename} -> ${absolutePath}`
            );

            return {
              name: logo.filename,
              path: absolutePath, // Use absolute path
              size: logo.size,
              type: logo.type,
              id: logo.id,
            };
          });

        const updatedConfig = {
          ...currentConfig,
          logoImages: logoImages,
          logoMode: manifest.settings?.logoMode || "loop",
          logoLoopDuration: manifest.settings?.logoLoopDuration || 30,
        };

        await window.electronAPI.updateConfig(updatedConfig);
        console.log(
          "LogoManifestService: ✅ Local config updated with manifest data"
        );
      }
    } catch (error) {
      console.error(
        "LogoManifestService: Failed to update local config:",
        error
      );
    }
  }

  triggerHotReload(manifest) {
    console.log("LogoManifestService: 🔄 Triggering hot reload event");

    const event = new CustomEvent("logo-manifest-updated", {
      detail: {
        manifest: manifest,
        source: "logoManifestService",
        timestamp: Date.now(),
      },
    });

    window.dispatchEvent(event);
    console.log("LogoManifestService: ✅ Hot reload event dispatched");
  }

  destroy() {
    console.log("LogoManifestService: Destroying service...");

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isInitialized = false;
    this.manifestCache = null;
    console.log("LogoManifestService: ✅ Service destroyed");
  }
}

// Global instance
let globalLogoManifestService = null;

// Initialize Logo Manifest Service when DOM is ready
async function initializeLogoManifestService() {
  console.log("Initializing Logo Manifest Service...");

  try {
    if (window.electronAPI && window.electronAPI.getConfig) {
      const config = await window.electronAPI.getConfig();

      if (config.logoManifest && config.logoManifest.enabled) {
        console.log("Logo Manifest config found, starting service...");

        // Cleanup existing service
        if (globalLogoManifestService) {
          globalLogoManifestService.destroy();
        }

        // Create and initialize new service
        globalLogoManifestService = new LogoManifestService();
        const initialized = await globalLogoManifestService.initialize(
          config.logoManifest
        );

        if (initialized) {
          console.log("✅ Logo Manifest Service started successfully");
        } else {
          console.warn("⚠️ Logo Manifest Service failed to initialize");
        }
      } else {
        console.log("Logo Manifest Service disabled or not configured");
      }
    } else {
      console.log("electronAPI not available for Logo Manifest Service");
    }
  } catch (error) {
    console.error("Failed to initialize Logo Manifest Service:", error);
  }
}

// Auto-initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing Logo Manifest Service...");
  initializeLogoManifestService();
});

// Also initialize on window load as backup
window.addEventListener("load", () => {
  if (!globalLogoManifestService || !globalLogoManifestService.isInitialized) {
    console.log(
      "Window loaded, initializing Logo Manifest Service as backup..."
    );
    initializeLogoManifestService();
  }
});

// ====================================
// REACT COMPONENTS
// ====================================

class WeatherPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      weatherData: {
        city: "TP. THỪA THIÊN HUẾ",
        temperature: "24,2",
        lowTemp: "-29,7",
        humidity: "95",
        uvIndex: "Thấp",
        rainChance: "97",
        windSpeed: "1,6",
        airQuality: "Tốt",
      },
    };
  }

  componentDidMount() {
    this.weatherInterval = setInterval(() => {
      this.updateWeatherData();
    }, 300000);
  }

  componentWillUnmount() {
    if (this.weatherInterval) {
      clearInterval(this.weatherInterval);
    }
  }

  updateWeatherData() {
    const newData = {
      ...this.state.weatherData,
      temperature: (20 + Math.random() * 15).toFixed(1),
      humidity: (70 + Math.random() * 30).toFixed(0),
      rainChance: Math.floor(Math.random() * 100),
      windSpeed: (Math.random() * 5).toFixed(1),
    };

    this.setState({
      weatherData: newData,
    });
  }

  render() {
    const { weatherData } = this.state;

    const panelStyle = {
      flex: 1,
      backgroundColor: "#1a1a2e",
      padding: "10px",
      border: "2px solid #ff0000",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      cursor: "pointer",
      color: "white",
    };

    return React.createElement(
      "div",
      {
        style: panelStyle,
        onClick: () => this.updateWeatherData(),
      },
      React.createElement(
        "h3",
        {
          style: {
            fontSize: "14px",
            marginBottom: "8px",
            marginTop: 0,
          },
        },
        weatherData.city
      ),
      React.createElement(
        "div",
        { style: { fontSize: "32px", fontWeight: "bold" } },
        `${weatherData.temperature}°`
      ),
      React.createElement(
        "div",
        { style: { fontSize: "12px" } },
        `${weatherData.lowTemp}°`
      ),
      React.createElement(
        "div",
        { style: { fontSize: "12px" } },
        `Độ ẩm ${weatherData.humidity}% | UV ${weatherData.uvIndex}`
      ),
      React.createElement(
        "div",
        { style: { fontSize: "12px" } },
        `Mưa ${weatherData.rainChance}% | Gió ${weatherData.windSpeed} km/h`
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "10px",
            marginTop: "5px",
          },
        },
        `Chất lượng không khí: ${weatherData.airQuality}`
      )
    );
  }
}

class IoTPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sensorData: {
        temperature: "24,0",
        humidity: "96",
        pm25: "2,06",
        pm10: "2,4",
        status: "TỐT",
      },
    };
  }

  componentDidMount() {
    this.iotInterval = setInterval(() => {
      this.updateIoTData();
    }, 30000);
  }

  componentWillUnmount() {
    if (this.iotInterval) {
      clearInterval(this.iotInterval);
    }
  }

  updateIoTData() {
    const newData = {
      temperature: (20 + Math.random() * 10).toFixed(1),
      humidity: (80 + Math.random() * 20).toFixed(0),
      pm25: (1 + Math.random() * 3).toFixed(2),
      pm10: (2 + Math.random() * 4).toFixed(1),
      status: "TỐT",
    };

    this.setState({
      sensorData: newData,
    });
  }

  render() {
    const { sensorData } = this.state;

    const panelStyle = {
      flex: 1,
      backgroundColor: "#16213e",
      padding: "10px",
      border: "2px solid #ff0000",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      cursor: "pointer",
      color: "white",
    };

    return React.createElement(
      "div",
      {
        style: panelStyle,
        onClick: () => this.updateIoTData(),
      },
      React.createElement(
        "h3",
        {
          style: {
            fontSize: "14px",
            marginBottom: "8px",
            marginTop: 0,
          },
        },
        "THIẾT BỊ ĐO"
      ),
      React.createElement(
        "div",
        { style: { fontSize: "14px", marginBottom: "4px" } },
        `Nhiệt độ: ${sensorData.temperature}°`
      ),
      React.createElement(
        "div",
        { style: { fontSize: "14px", marginBottom: "4px" } },
        `Độ ẩm: ${sensorData.humidity}%`
      ),
      React.createElement(
        "div",
        { style: { fontSize: "14px", marginBottom: "4px" } },
        `PM2.5: ${sensorData.pm25} μg`
      ),
      React.createElement(
        "div",
        { style: { fontSize: "14px", marginBottom: "4px" } },
        `PM10: ${sensorData.pm10} μg`
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "10px",
            backgroundColor: "green",
            padding: "2px 6px",
            borderRadius: "3px",
            marginTop: "5px",
          },
        },
        sensorData.status
      )
    );
  }
}

class CompanyLogo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      config: null,
      currentLogoIndex: 0,
    };
    this.logoRotationInterval = null;
  }

  async componentDidMount() {
    await this.loadConfig();
    this.startLogoRotation();

    if (window.electronAPI && window.electronAPI.onConfigUpdated) {
      window.electronAPI.onConfigUpdated((event, newConfig) => {
        console.log("Config updated:", newConfig);
        this.setState({ config: newConfig }, () => {
          this.startLogoRotation();
        });
      });
    }

    // Listen for logo manifest updates (GitHub CDN Sync)
    const logoManifestHandler = (event) => {
      console.log("LOGO MANIFEST UPDATED EVENT RECEIVED:", {
        detail: event.detail,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Reload configuration to get updated logos from manifest
      setTimeout(() => {
        this.loadConfig();
      }, 500); // Small delay to ensure config is saved
    };

    // Add custom event listener for logo manifest updates
    window.addEventListener("logo-manifest-updated", logoManifestHandler);

    // Store handler for cleanup
    this.logoManifestHandler = logoManifestHandler;
  }

  componentWillUnmount() {
    this.stopLogoRotation();

    if (window.electronAPI && window.electronAPI.removeConfigListener) {
      window.electronAPI.removeConfigListener();
    }

    // Remove logo manifest event listener
    if (this.logoManifestHandler) {
      window.removeEventListener(
        "logo-manifest-updated",
        this.logoManifestHandler
      );
    }
  }

  async loadConfig() {
    try {
      if (window.electronAPI) {
        const config = await window.electronAPI.getConfig();
        this.setState({ config });
      } else {
        this.setState({
          config: {
            logoMode: "fixed",
            logoImages: [],
            logoLoopDuration: 5,
          },
        });
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }
  }

  startLogoRotation() {
    this.stopLogoRotation();

    const { config } = this.state;
    if (
      config &&
      config.logoMode === "loop" &&
      config.logoImages &&
      config.logoImages.length > 1
    ) {
      const duration = (config.logoLoopDuration || 5) * 1000;

      this.logoRotationInterval = setInterval(() => {
        this.setState((prevState) => ({
          currentLogoIndex:
            (prevState.currentLogoIndex + 1) % config.logoImages.length,
        }));
      }, duration);
    }
  }

  stopLogoRotation() {
    if (this.logoRotationInterval) {
      clearInterval(this.logoRotationInterval);
      this.logoRotationInterval = null;
    }
  }

  getCurrentLogo() {
    const { config, currentLogoIndex } = this.state;

    if (!config || !config.logoImages || config.logoImages.length === 0) {
      return null;
    }

    switch (config.logoMode) {
      case "fixed":
        return config.logoImages[0];

      case "loop":
        return config.logoImages[currentLogoIndex % config.logoImages.length];

      case "scheduled":
        return this.getScheduledLogo();

      default:
        return config.logoImages[0];
    }
  }

  getScheduledLogo() {
    const { config } = this.state;
    const now = new Date();
    const currentTime =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    const matchingSchedule = config.schedules?.find((schedule) => {
      return schedule.time === currentTime;
    });

    if (matchingSchedule && config.logoImages[matchingSchedule.logoIndex]) {
      return config.logoImages[matchingSchedule.logoIndex];
    }

    return config.logoImages[0];
  }

  renderCustomLogo(logo) {
    // Convert relative path to absolute path for file:// protocol
    let logoPath = logo.path;

    // Handle both relative and absolute paths
    if (!logoPath.startsWith("/") && !logoPath.match(/^[A-Za-z]:/)) {
      // Relative path - resolve from current working directory
      logoPath = require("path").resolve(logoPath);
    }

    // Convert Windows path separators for file:// protocol
    logoPath = logoPath.replace(/\\/g, "/");

    console.log("CompanyLogo: Loading logo from path:", logoPath);

    return React.createElement("img", {
      src: `file://${logoPath}`,
      alt: logo.name,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        borderRadius: "0",
      },
      onError: (e) => {
        console.error("Failed to load logo:", logoPath);
        console.error("Original path:", logo.path);

        // Try fallback paths
        const fallbackPaths = [
          `assets/imgs/${logo.name}.png`,
          `assets/imgs/${logo.name}.jpg`,
          `assets/imgs/EoH_ERa_Web-Banner_1920x800-1.png`,
        ];

        for (const fallbackPath of fallbackPaths) {
          const absoluteFallback = require("path").resolve(fallbackPath);
          console.log("Trying fallback path:", absoluteFallback);

          // Check if fallback exists (this is just for logging)
          const fs = require("fs");
          if (fs.existsSync(absoluteFallback)) {
            console.log("Fallback found:", absoluteFallback);
            e.target.src = `file://${absoluteFallback.replace(/\\/g, "/")}`;
            return;
          }
        }

        console.error("No fallback found, hiding image");
        e.target.style.display = "none";
      },
    });
  }

  renderDefaultLogo() {
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
        React.createElement(
          "div",
          {
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
            style: {
              fontSize: "12px",
              lineHeight: "1.2",
              margin: 0,
              opacity: 0.9,
            },
          },
          "VÌ CUỘC SỐNG TỐT ĐẸP HƠN"
        )
      ),
    ];
  }

  render() {
    const currentLogo = this.getCurrentLogo();

    const containerStyle = {
      flex: 1,
      backgroundColor: "#ff6b35",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0",
      position: "relative",
      overflow: "hidden",
    };

    return React.createElement(
      "div",
      { style: containerStyle },
      currentLogo
        ? this.renderCustomLogo(currentLogo)
        : this.renderDefaultLogo()
    );
  }
}

class BillboardLayout extends React.Component {
  render() {
    const containerStyle = {
      width: "384px",
      height: "384px",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#000",
      fontFamily: "Arial, sans-serif",
      margin: 0,
      padding: 0,
    };

    const topRowStyle = {
      flex: 3,
      display: "flex",
      flexDirection: "row",
    };

    return React.createElement(
      "div",
      { style: containerStyle },
      React.createElement(
        "div",
        { style: topRowStyle },
        React.createElement(WeatherPanel),
        React.createElement(IoTPanel)
      ),
      React.createElement(CompanyLogo)
    );
  }
}

class App extends React.Component {
  render() {
    const appStyle = {
      width: "384px",
      height: "384px",
      margin: 0,
      padding: 0,
      overflow: "hidden",
      fontFamily: "Arial, sans-serif",
    };

    return React.createElement(
      "div",
      { style: appStyle },
      React.createElement(BillboardLayout)
    );
  }
}

// Initialize React App
document.addEventListener("DOMContentLoaded", () => {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App));

  console.log("Billboard React App initialized with logo management");
});
