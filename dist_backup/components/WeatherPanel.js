"use strict";
// WeatherPanel.tsx - Professional weather display component
// Designed for 24/7 outdoor billboard operation
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
const react_1 = __importStar(require("react"));
const weatherService_1 = __importDefault(require("../services/weatherService"));
const weatherIcons_1 = require("../assets/weather-icons/weatherIcons");
require("./WeatherPanel.css");
// Global weather service instance
class GlobalWeatherServiceManager {
    static getInstance() {
        if (!GlobalWeatherServiceManager.instance) {
            const weatherConfig = {
                location: {
                    lat: 16.4637, // Huế coordinates
                    lon: 107.5909,
                    city: "TP. THỪA THIÊN HUẾ",
                },
                updateInterval: 10, // Update every 10 minutes
                retryInterval: 3, // Retry every 3 minutes on failure
                maxRetries: 5, // More retries for reliability
            };
            // Load E-Ra IoT configuration
            const eraIotConfig = GlobalWeatherServiceManager.loadEraIotConfig();
            try {
                console.log("WeatherServiceManager: Creating weather service for", weatherConfig.location.city);
                console.log("WeatherServiceManager: E-Ra IoT config available:", !!eraIotConfig);
                GlobalWeatherServiceManager.instance = new weatherService_1.default(weatherConfig, eraIotConfig);
                console.log("WeatherServiceManager: Weather service created successfully");
            }
            catch (error) {
                console.error("WeatherServiceManager: Failed to create weather service:", error);
                throw error;
            }
            // Set up data change notifications - check more frequently
            setInterval(() => {
                const data = GlobalWeatherServiceManager.instance?.getCurrentWeather() || null;
                GlobalWeatherServiceManager.notifySubscribers(data);
            }, 10000); // Check for updates every 10 seconds
        }
        return GlobalWeatherServiceManager.instance;
    }
    static subscribe(callback) {
        console.log("WeatherServiceManager: Subscribe called");
        GlobalWeatherServiceManager.subscribers.add(callback);
        // Get or create instance first
        console.log("WeatherServiceManager: Getting instance...");
        const instance = GlobalWeatherServiceManager.getInstance();
        // Immediately provide current data
        const currentData = instance?.getCurrentWeather() || null;
        console.log("WeatherServiceManager: Current data available:", !!currentData);
        callback(currentData);
        // Return unsubscribe function
        return () => {
            GlobalWeatherServiceManager.subscribers.delete(callback);
        };
    }
    static notifySubscribers(data) {
        GlobalWeatherServiceManager.subscribers.forEach((callback) => callback(data));
    }
    /**
     * Load E-Ra IoT configuration from config.json
     */
    static loadEraIotConfig() {
        try {
            // Access config from electron main process if available
            if (typeof window !== "undefined" && window.electronAPI) {
                const config = window.electronAPI.getConfig?.();
                if (config?.eraIot &&
                    config.eraIot.enabled &&
                    config.eraIot.authToken) {
                    console.log("WeatherServiceManager: Loading E-Ra IoT config from Electron");
                    return {
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
            // Fallback: Try to read from localStorage or use demo config
            const storedConfig = localStorage.getItem("eraIotConfig");
            if (storedConfig) {
                const parsedConfig = JSON.parse(storedConfig);
                if (parsedConfig.authToken) {
                    console.log("WeatherServiceManager: Loading E-Ra IoT config from localStorage");
                    return parsedConfig;
                }
            }
            console.log("WeatherServiceManager: No valid E-Ra IoT config found");
            return undefined;
        }
        catch (error) {
            console.error("WeatherServiceManager: Failed to load E-Ra IoT config:", error);
            return undefined;
        }
    }
}
GlobalWeatherServiceManager.instance = null;
GlobalWeatherServiceManager.subscribers = new Set();
const WeatherPanel = ({ className = "", onWeatherUpdate, }) => {
    const [weatherData, setWeatherData] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [connectionStatus, setConnectionStatus] = (0, react_1.useState)("offline");
    const [lastClickTime, setLastClickTime] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        console.log("WeatherPanel: Initializing weather panel");
        // Subscribe to global weather service
        const unsubscribe = GlobalWeatherServiceManager.subscribe((data) => {
            console.log("WeatherPanel: Subscription callback called with data:", !!data);
            if (data) {
                setWeatherData(data);
                setConnectionStatus("connected");
                setIsLoading(false);
                // Notify parent component about weather update
                if (onWeatherUpdate) {
                    onWeatherUpdate(data);
                }
                console.log("WeatherPanel: Weather data updated:", {
                    city: data.cityName,
                    temp: data.temperature,
                    humidity: data.humidity,
                    condition: data.weatherCondition,
                    lastUpdated: data.lastUpdated.toLocaleTimeString(),
                });
            }
            else {
                console.log("WeatherPanel: No weather data, keeping loading state or showing error");
                if (!isLoading) {
                    setConnectionStatus("error");
                }
                // Notify parent component
                if (onWeatherUpdate) {
                    onWeatherUpdate(null);
                }
            }
        });
        // Cleanup subscription on unmount
        return unsubscribe;
    }, [isLoading, onWeatherUpdate]);
    // Format UV Index level
    const getUVLevel = (uvIndex) => {
        if (uvIndex <= 2)
            return "Thấp";
        if (uvIndex <= 5)
            return "Trung bình";
        if (uvIndex <= 7)
            return "Cao";
        if (uvIndex <= 10)
            return "Rất cao";
        return "Cực cao";
    };
    // Get rain probability text
    const getRainText = (rainProb) => {
        if (rainProb >= 80)
            return "Chắc chắn mưa";
        if (rainProb >= 60)
            return "Có thể mưa";
        if (rainProb >= 30)
            return "Ít khả năng mưa";
        return "Không mưa";
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
    // Handle manual refresh with click throttling
    const handleRefresh = async () => {
        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime;
        // Prevent rapid clicking (throttle to 2 seconds)
        if (timeSinceLastClick < 2000) {
            console.log("WeatherPanel: Click throttled");
            return;
        }
        setLastClickTime(now);
        console.log("WeatherPanel: Manual refresh requested");
        try {
            setIsLoading(true);
            const weatherService = GlobalWeatherServiceManager.getInstance();
            await weatherService.refreshWeatherData();
            // Give some time for the service to update
            setTimeout(() => {
                const updatedData = weatherService.getCurrentWeather();
                if (updatedData) {
                    setWeatherData(updatedData);
                    setConnectionStatus("connected");
                }
                setIsLoading(false);
            }, 1000);
        }
        catch (error) {
            console.error("WeatherPanel: Manual refresh failed:", error);
            setConnectionStatus("error");
            setIsLoading(false);
        }
    };
    // Render loading state
    if (isLoading && !weatherData) {
        return (react_1.default.createElement("div", { className: `weather-panel loading ${className}` },
            react_1.default.createElement("div", { className: "weather-title" }, "TP. TH\u1EEAA THI\u00CAN HU\u1EBE"),
            react_1.default.createElement("div", { className: "weather-loading" },
                react_1.default.createElement("div", { className: "loading-spinner" }),
                react_1.default.createElement("div", { className: "loading-text" }, "\u0110ang t\u1EA3i..."))));
    }
    // Render error state
    if (!weatherData && connectionStatus === "error") {
        return (react_1.default.createElement("div", { className: `weather-panel error ${className}` },
            react_1.default.createElement("div", { className: "weather-title" }, "TP. TH\u1EEAA THI\u00CAN HU\u1EBE"),
            react_1.default.createElement("div", { className: "weather-error" },
                react_1.default.createElement("div", { className: "error-icon" }, "\u26A0"),
                react_1.default.createElement("div", { className: "error-text" }, "L\u1ED7i k\u1EBFt n\u1ED1i"),
                react_1.default.createElement("button", { className: "retry-button", onClick: handleRefresh }, "Th\u1EED l\u1EA1i"))));
    }
    if (!weatherData) {
        return null;
    }
    const weatherIcon = (0, weatherIcons_1.getWeatherIcon)(weatherData.weatherCode, weatherData.weatherCondition);
    // Get weather type for styling
    const getWeatherType = (condition) => {
        if (condition.includes("quang") ||
            condition.includes("nắng") ||
            condition.includes("Trời quang")) {
            return "sunny";
        }
        if (condition.includes("mưa") || condition.includes("phùn")) {
            return "rainy";
        }
        if (condition.includes("mây") ||
            condition.includes("u ám") ||
            condition.includes("U ám")) {
            return "cloudy";
        }
        if (condition.includes("dông") || condition.includes("sấm")) {
            return "stormy";
        }
        return "default";
    };
    const weatherType = getWeatherType(weatherData.weatherCondition);
    return (react_1.default.createElement("div", { className: `weather-panel professional ${weatherType} ${className}`, onClick: handleRefresh },
        react_1.default.createElement("div", { className: "weather-overlay" }),
        react_1.default.createElement("div", { className: "weather-header" },
            react_1.default.createElement("div", { className: "city-name" }, weatherData.cityName),
            react_1.default.createElement("div", { className: `connection-indicator ${connectionStatus}` })),
        react_1.default.createElement("div", { className: "weather-main-section" },
            react_1.default.createElement("div", { className: "weather-icon-container" },
                react_1.default.createElement("div", { className: `weather-icon-3d ${weatherType}`, dangerouslySetInnerHTML: { __html: weatherIcon } })),
            react_1.default.createElement("div", { className: "temperature-display" },
                react_1.default.createElement("div", { className: "temp-main" },
                    weatherData.temperature,
                    "\u00B0"),
                react_1.default.createElement("div", { className: "temp-feels" },
                    "- ",
                    weatherData.feelsLike,
                    "\u00B0"))),
        react_1.default.createElement("div", { className: "weather-details-grid" },
            react_1.default.createElement("div", { className: "detail-item" },
                react_1.default.createElement("span", { className: "detail-label" }, "\u0110\u1ED9 \u1EA9m"),
                react_1.default.createElement("span", { className: "detail-value" },
                    weatherData.humidity,
                    "%")),
            react_1.default.createElement("div", { className: "detail-item" },
                react_1.default.createElement("span", { className: "detail-label" }, "UV"),
                react_1.default.createElement("span", { className: "detail-value" }, getUVLevel(weatherData.uvIndex))),
            react_1.default.createElement("div", { className: "detail-item" },
                react_1.default.createElement("span", { className: "detail-label" }, "M\u01B0a"),
                react_1.default.createElement("span", { className: "detail-value" },
                    weatherData.rainProbability,
                    "%")),
            react_1.default.createElement("div", { className: "detail-item" },
                react_1.default.createElement("span", { className: "detail-label" }, "Gi\u00F3"),
                react_1.default.createElement("span", { className: "detail-value" }, weatherData.windSpeed))),
        react_1.default.createElement("div", { className: "weather-air-quality" },
            react_1.default.createElement("div", { className: "air-quality-item" },
                react_1.default.createElement("span", { className: "air-quality-label" }, "Ch\u1EA5t l\u01B0\u1EE3ng kh\u00F4ng kh\u00ED"),
                react_1.default.createElement("span", { className: "air-quality-status-value" }, "T\u1ED0T"))),
        react_1.default.createElement("div", { className: "device-measurements-section" },
            react_1.default.createElement("div", { className: "device-title" }, "C\u1EA2M BI\u1EBEN IOT"),
            react_1.default.createElement("div", { className: "device-readings" },
                react_1.default.createElement("div", { className: "sensor-row" },
                    react_1.default.createElement("div", { className: "sensor-item" },
                        react_1.default.createElement("span", { className: "sensor-label" }, "Nhi\u1EC7t \u0111\u1ED9"),
                        react_1.default.createElement("span", { className: "sensor-value" },
                            weatherData.temperature,
                            ".0\u00B0")),
                    react_1.default.createElement("div", { className: "sensor-item" },
                        react_1.default.createElement("span", { className: "sensor-label" }, "\u0110\u1ED9 \u1EA9m"),
                        react_1.default.createElement("span", { className: "sensor-value" },
                            weatherData.humidity,
                            ".0"))),
                react_1.default.createElement("div", { className: "sensor-row" },
                    react_1.default.createElement("div", { className: "sensor-item pm-item" },
                        react_1.default.createElement("span", { className: "sensor-label" }, "PM\u2082.\u2085"),
                        react_1.default.createElement("span", { className: "sensor-value pm-value" },
                            weatherData.pm25,
                            react_1.default.createElement("span", { className: "unit" }, "\u03BCg/m\u00B3"))),
                    react_1.default.createElement("div", { className: "sensor-item pm-item" },
                        react_1.default.createElement("span", { className: "sensor-label" }, "PM\u2081\u2080"),
                        react_1.default.createElement("span", { className: "sensor-value pm-value" },
                            weatherData.pm10,
                            react_1.default.createElement("span", { className: "unit" }, "\u03BCg/m\u00B3")))))),
        react_1.default.createElement("div", { className: "air-quality-status" },
            react_1.default.createElement("div", { className: "air-quality-text" },
                "Ch\u1EA5t l\u01B0\u1EE3ng kh\u00F4ng kh\u00ED: ",
                weatherData.airQuality),
            react_1.default.createElement("div", { className: "air-quality-badge good" }, "T\u1ED0T")),
        isLoading && (react_1.default.createElement("div", { className: "refresh-overlay" },
            react_1.default.createElement("div", { className: "refresh-spinner" })))));
};
exports.default = WeatherPanel;
