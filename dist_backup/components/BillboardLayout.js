"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// BillboardLayout.tsx - Main layout for 384x384 LED screen
const react_1 = __importStar(require("react"));
const WeatherPanel_1 = __importDefault(require("./WeatherPanel"));
const IoTPanel_1 = __importDefault(require("./IoTPanel"));
// Note: CompanyLogo is handled in app.js, not imported here
const eraIotService_1 = __importDefault(require("../services/eraIotService"));
const bannerSyncService_1 = __importDefault(require("../services/bannerSyncService"));
const logoManifestService_1 = __importDefault(require("../services/logoManifestService"));
require("./BillboardLayout.css");
const BillboardLayout = ({ configUpdateTrigger = 0, logoManifestService: externalLogoManifestService = null, }) => {
    const [eraIotService, setEraIotService] = (0, react_1.useState)(null);
    const [bannerSyncService, setBannerSyncService] = (0, react_1.useState)(null);
    const [internalLogoManifestService, setInternalLogoManifestService] = (0, react_1.useState)(null);
    const [showWeatherAlert, setShowWeatherAlert] = (0, react_1.useState)(false);
    const [weatherData, setWeatherData] = (0, react_1.useState)(null);
    const [logoUpdateTrigger, setLogoUpdateTrigger] = (0, react_1.useState)(0);
    // Use external service if provided, otherwise use internal
    const logoManifestService = externalLogoManifestService || internalLogoManifestService;
    console.log("BillboardLayout: Component initialized");
    // Handle weather data updates from WeatherPanel
    const handleWeatherUpdate = (data) => {
        setWeatherData(data);
        // Determine if we should show weather alert
        if (data) {
            const shouldShowAlert = data.rainProbability > 70 ||
                data.weatherCondition?.includes("mưa to") ||
                data.weatherCondition?.includes("dông");
            setShowWeatherAlert(shouldShowAlert);
        }
        else {
            setShowWeatherAlert(false);
        }
    };
    (0, react_1.useEffect)(() => {
        console.log("BillboardLayout: useEffect triggered, configUpdateTrigger:", configUpdateTrigger);
        // Load E-Ra IoT configuration and initialize service
        const initializeEraIot = async () => {
            try {
                const config = await loadEraIotConfig();
                console.log("BillboardLayout: Loaded E-Ra IoT config:", {
                    hasConfig: !!config,
                    enabled: config?.enabled,
                    hasAuthToken: !!config?.authToken,
                    authTokenPreview: config?.authToken?.substring(0, 20) + "...",
                    isPlaceholder: config?.authToken?.includes("1234272955"),
                });
                if (config && config.authToken && config.authToken.trim() !== "") {
                    if (config.authToken.includes("1234272955")) {
                        console.log("BillboardLayout: E-Ra IoT using placeholder AUTHTOKEN - will show error state");
                    }
                    else {
                        console.log("BillboardLayout: Initializing E-Ra IoT service with valid config");
                    }
                    // Cleanup existing service
                    if (eraIotService) {
                        eraIotService.destroy();
                    }
                    const service = new eraIotService_1.default(config);
                    console.log("EraIotService: Starting MQTT-based sensor data service");
                    console.log("EraIotService: Started MQTT callback updates every 1 second for real-time UI responsiveness");
                    await service.startPeriodicUpdates();
                    setEraIotService(service);
                    console.log("BillboardLayout: E-Ra IoT service initialized successfully");
                }
                else {
                    console.log("BillboardLayout: No valid E-Ra IoT configuration found - missing or invalid AUTHTOKEN");
                    if (eraIotService) {
                        eraIotService.destroy();
                        setEraIotService(null);
                    }
                }
            }
            catch (error) {
                console.error("BillboardLayout: Failed to initialize E-Ra IoT service:", error);
            }
        };
        // Initialize Banner Sync Service
        const initializeBannerSync = async () => {
            try {
                console.log("BillboardLayout: Initializing Banner Sync Service...");
                // Get banner sync config
                const config = await loadBannerSyncConfig();
                if (config && config.enabled) {
                    // Cleanup existing service
                    if (bannerSyncService) {
                        bannerSyncService.destroy();
                    }
                    const service = new bannerSyncService_1.default(config);
                    const initialized = await service.initialize();
                    if (initialized) {
                        setBannerSyncService(service);
                        console.log("BillboardLayout: Banner Sync Service initialized successfully");
                    }
                    else {
                        console.warn("BillboardLayout: Banner Sync Service failed to initialize");
                    }
                }
                else {
                    console.log("BillboardLayout: Banner Sync Service disabled or not configured");
                }
            }
            catch (error) {
                console.error("BillboardLayout: Failed to initialize Banner Sync Service:", error);
            }
        };
        // Initialize Logo Manifest Service (GitHub CDN Sync)
        const initializeLogoManifest = async () => {
            try {
                console.log("BillboardLayout: Initializing Logo Manifest Service...");
                // Get logo manifest config
                const config = await loadLogoManifestConfig();
                if (config && config.enabled) {
                    // Cleanup existing service
                    if (logoManifestService) {
                        logoManifestService.destroy();
                    }
                    const service = new logoManifestService_1.default(config);
                    const initialized = await service.initialize();
                    if (initialized) {
                        setInternalLogoManifestService(service);
                        // Setup logo update callback
                        service.onLogoUpdate((logos) => {
                            console.log("BillboardLayout: Logo manifest updated", {
                                logoCount: logos.length,
                            });
                            setLogoUpdateTrigger((prev) => prev + 1);
                        });
                        console.log("BillboardLayout: Logo Manifest Service initialized successfully");
                    }
                    else {
                        console.warn("BillboardLayout: Logo Manifest Service failed to initialize");
                    }
                }
                else {
                    console.log("BillboardLayout: Logo Manifest Service disabled or not configured");
                }
            }
            catch (error) {
                console.error("BillboardLayout: Failed to initialize Logo Manifest Service:", error);
            }
        };
        // Initial setup
        initializeEraIot();
        initializeBannerSync();
        initializeLogoManifest();
        // Listen for configuration updates
        const handleConfigUpdate = (_event, updatedConfig) => {
            console.log("BillboardLayout: Configuration updated, reinitializing services", {
                hasLogoConfig: !!updatedConfig?.logoMode,
                logoMode: updatedConfig?.logoMode,
                logoLoopDuration: updatedConfig?.logoLoopDuration,
                hasEraIot: !!updatedConfig?.eraIot,
            });
            // Trigger logo update
            if (updatedConfig?.logoMode || updatedConfig?.logoLoopDuration) {
                console.log("BillboardLayout: Triggering logo update");
                setLogoUpdateTrigger((prev) => prev + 1);
            }
            // Reinitialize E-Ra IoT service
            setTimeout(async () => {
                await initializeEraIot();
            }, 1000); // Small delay to ensure config is saved
        };
        // Setup event listeners for config updates
        if (typeof window !== "undefined" &&
            window.electronAPI?.onEraIotConfigUpdated) {
            window.electronAPI.onEraIotConfigUpdated(handleConfigUpdate);
        }
        if (typeof window !== "undefined" &&
            window.electronAPI?.onConfigUpdated) {
            window.electronAPI.onConfigUpdated(handleConfigUpdate);
        }
        // Also listen for general config updates
        if (typeof window !== "undefined" &&
            window.electronAPI?.onConfigUpdated) {
            window.electronAPI.onConfigUpdated(handleConfigUpdate);
        }
        // Listen for force refresh events
        if (typeof window !== "undefined" &&
            window.electronAPI?.onForceRefreshServices) {
            window.electronAPI.onForceRefreshServices(handleConfigUpdate);
        }
        if (typeof window !== "undefined" &&
            window.electronAPI?.onConfigUpdated) {
            window.electronAPI.onConfigUpdated(handleConfigUpdate);
        }
        return () => {
            if (eraIotService) {
                eraIotService.destroy();
            }
            if (bannerSyncService) {
                bannerSyncService.destroy();
            }
            if (logoManifestService) {
                logoManifestService.destroy();
            }
        };
    }, [configUpdateTrigger]);
    // Load E-Ra IoT configuration
    const loadEraIotConfig = async () => {
        try {
            console.log("BillboardLayout: Loading E-Ra IoT configuration...");
            // Try to access config from electron main process
            if (typeof window !== "undefined" && window.electronAPI) {
                console.log("BillboardLayout: electronAPI available, fetching config...");
                const config = await window.electronAPI.getConfig?.();
                console.log("BillboardLayout: Raw config received:", {
                    hasEraIot: !!config?.eraIot,
                    enabled: config?.eraIot?.enabled,
                    hasAuthToken: !!config?.eraIot?.authToken,
                    authTokenPrefix: config?.eraIot?.authToken?.substring(0, 10),
                });
                if (config?.eraIot && config.eraIot.authToken) {
                    return {
                        enabled: config.eraIot.enabled,
                        authToken: config.eraIot.authToken,
                        baseUrl: config.eraIot.baseUrl || "https://backend.eoh.io",
                        sensorConfigs: config.eraIot.sensorConfigs || {
                            temperature: null,
                            humidity: null,
                            pm25: null,
                            pm10: null,
                        },
                        updateInterval: config.eraIot.updateInterval || 5,
                        timeout: config.eraIot.timeout || 15000,
                        retryAttempts: config.eraIot.retryAttempts || 3,
                        retryDelay: config.eraIot.retryDelay || 2000,
                    };
                }
            }
            else {
                console.log("BillboardLayout: electronAPI not available");
            }
            // Fallback: Try localStorage
            console.log("BillboardLayout: Trying localStorage fallback...");
            const storedConfig = localStorage.getItem("eraIotConfig");
            if (storedConfig) {
                const parsedConfig = JSON.parse(storedConfig);
                console.log("BillboardLayout: Found localStorage config:", {
                    hasAuthToken: !!parsedConfig.authToken,
                });
                if (parsedConfig.authToken) {
                    return parsedConfig;
                }
            }
            console.log("BillboardLayout: No E-Ra IoT config found");
            return null;
        }
        catch (error) {
            console.error("BillboardLayout: Failed to load E-Ra IoT config:", error);
            return null;
        }
    };
    // Load Banner Sync configuration
    const loadBannerSyncConfig = async () => {
        try {
            console.log("BillboardLayout: Loading Banner Sync configuration...");
            // Try to access config from electron main process
            if (typeof window !== "undefined" && window.electronAPI) {
                const config = await window.electronAPI.getConfig?.();
                // Check if banner sync is configured
                if (config?.bannerSync) {
                    return {
                        enabled: config.bannerSync.enabled || false,
                        mqttBroker: config.bannerSync.mqttBroker ||
                            "wss://broker.hivemq.com:8884/mqtt",
                        topics: {
                            bannerUpdate: config.bannerSync.topics?.bannerUpdate ||
                                "its/billboard/banner/update",
                            bannerDelete: config.bannerSync.topics?.bannerDelete ||
                                "its/billboard/banner/delete",
                            bannerSync: config.bannerSync.topics?.bannerSync ||
                                "its/billboard/banner/sync",
                        },
                        downloadPath: config.bannerSync.downloadPath || "./downloads",
                        maxCacheSize: config.bannerSync.maxCacheSize || 100,
                    };
                }
                else {
                    // Return default config for banner sync
                    return {
                        enabled: true, // Enable by default
                        mqttBroker: "wss://broker.hivemq.com:8884/mqtt",
                        topics: {
                            bannerUpdate: "its/billboard/banner/update",
                            bannerDelete: "its/billboard/banner/delete",
                            bannerSync: "its/billboard/banner/sync",
                        },
                        downloadPath: "./downloads",
                        maxCacheSize: 100,
                    };
                }
            }
            console.log("BillboardLayout: electronAPI not available for banner sync");
            return null;
        }
        catch (error) {
            console.error("BillboardLayout: Failed to load Banner Sync config:", error);
            return null;
        }
    };
    // Load Logo Manifest configuration (GitHub CDN Sync)
    const loadLogoManifestConfig = async () => {
        try {
            console.log("BillboardLayout: Loading Logo Manifest configuration...");
            // Try to access config from electron main process
            if (typeof window !== "undefined" && window.electronAPI) {
                const config = await window.electronAPI.getConfig?.();
                // Check if logo manifest is configured
                if (config?.logoManifest) {
                    return {
                        enabled: config.logoManifest.enabled || false,
                        manifestUrl: config.logoManifest.manifestUrl ||
                            "https://minhquan7.github.io/ITS_OurdoorBillboard-/logo-manifest.json",
                        pollInterval: config.logoManifest.pollInterval || 30,
                        downloadPath: config.logoManifest.downloadPath || "./downloads",
                        maxCacheSize: config.logoManifest.maxCacheSize || 50,
                        retryAttempts: config.logoManifest.retryAttempts || 3,
                        retryDelay: config.logoManifest.retryDelay || 2000,
                    };
                }
                else {
                    // Return default config for logo manifest
                    return {
                        enabled: true, // Enable by default
                        manifestUrl: "https://minhquan7.github.io/ITS_OurdoorBillboard-/logo-manifest.json",
                        pollInterval: 30,
                        downloadPath: "./downloads",
                        maxCacheSize: 50,
                        retryAttempts: 3,
                        retryDelay: 2000,
                    };
                }
            }
            console.log("BillboardLayout: electronAPI not available for logo manifest");
            return null;
        }
        catch (error) {
            console.error("BillboardLayout: Failed to load Logo Manifest config:", error);
            return null;
        }
    };
    return (react_1.default.createElement("div", { className: "billboard-container" },
        react_1.default.createElement("div", { className: "top-row" },
            react_1.default.createElement("div", { className: "weather-column" },
                react_1.default.createElement(WeatherPanel_1.default, { className: "weather-panel-column", onWeatherUpdate: handleWeatherUpdate })),
            react_1.default.createElement("div", { className: "iot-column" },
                react_1.default.createElement(IoTPanel_1.default, { className: "iot-panel-column", eraIotService: eraIotService || undefined }))),
        showWeatherAlert && (react_1.default.createElement("div", { className: "weather-alert-banner" },
            react_1.default.createElement("div", { className: "alert-icon-warning" }, "!"),
            react_1.default.createElement("div", { className: "alert-text-large" }, "C\u1EA2NH B\u00C1O M\u01AFA L\u1EDAN"))),
        react_1.default.createElement("div", { className: "bottom-row" },
            react_1.default.createElement("div", { id: "company-logo-placeholder" }, "Logo will be rendered by app.js"))));
};
exports.default = BillboardLayout;
