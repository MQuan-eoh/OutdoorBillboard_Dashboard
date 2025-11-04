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
Object.defineProperty(exports, "__esModule", { value: true });
// WeatherDebug.tsx - Debug component using global weather service
const react_1 = __importStar(require("react"));
const WeatherDebug = () => {
    const [weatherData, setWeatherData] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [dataSource, setDataSource] = (0, react_1.useState)("unknown");
    (0, react_1.useEffect)(() => {
        // Access the global weather service (assumes WeatherPanel is already rendered)
        const checkForGlobalService = () => {
            try {
                // Try to get existing data from global service
                // This is a simplified approach - in production, we'd have proper module exports
                const globalServiceExists = typeof window !== "undefined" &&
                    document.querySelector(".weather-panel");
                if (globalServiceExists) {
                    // Subscribe to the same data as WeatherPanel
                    const pollInterval = setInterval(() => {
                        // Check if WeatherPanel has updated data by looking at its displayed content
                        const tempElement = document.querySelector(".temperature-main");
                        const humidityElement = document.querySelector(".weather-details .detail-value");
                        if (tempElement && humidityElement) {
                            const displayedTemp = tempElement.textContent?.replace("°", "");
                            const displayedHumidity = humidityElement.textContent?.replace("%", "");
                            if (displayedTemp && displayedHumidity) {
                                // Create debug data object matching what's displayed
                                const debugData = {
                                    cityName: "TP. THỪA THIÊN HUẾ (from UI)",
                                    temperature: parseInt(displayedTemp),
                                    feelsLike: parseInt(displayedTemp), // Approximation
                                    humidity: parseInt(displayedHumidity),
                                    windSpeed: 0, // Will be updated with actual values
                                    uvIndex: 0,
                                    rainProbability: 0,
                                    weatherCondition: "Debug Mode",
                                    weatherCode: 0,
                                    airQuality: "Debug",
                                    aqi: 1,
                                    visibility: 10,
                                    pm25: 25, // Default PM2.5 value for debug
                                    pm10: 45, // Default PM10 value for debug
                                    lastUpdated: new Date(),
                                };
                                setWeatherData(debugData);
                                setDataSource("UI Display");
                                setIsLoading(false);
                                setError(null);
                            }
                        }
                    }, 1000);
                    // Cleanup interval after 30 seconds
                    setTimeout(() => {
                        clearInterval(pollInterval);
                    }, 30000);
                }
                else {
                    setError("WeatherPanel not found - Global service not available");
                    setIsLoading(false);
                }
            }
            catch (err) {
                setError(`Debug Error: ${err}`);
                setIsLoading(false);
                console.error("WeatherDebug: Error accessing global service:", err);
            }
        };
        // Wait a bit for WeatherPanel to initialize
        setTimeout(checkForGlobalService, 2000);
    }, []);
    if (isLoading) {
        return (react_1.default.createElement("div", { style: { color: "white", padding: "10px" } }, "Loading weather data..."));
    }
    if (error) {
        return react_1.default.createElement("div", { style: { color: "red", padding: "10px" } },
            "Error: ",
            error);
    }
    if (!weatherData) {
        return (react_1.default.createElement("div", { style: { color: "yellow", padding: "10px" } }, "No weather data available"));
    }
    return (react_1.default.createElement("div", { style: {
            position: "fixed",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontSize: "10px",
            zIndex: 1000,
            maxWidth: "200px",
        } },
        react_1.default.createElement("h4", null, "Weather API Debug"),
        react_1.default.createElement("div", null,
            "City: ",
            weatherData.cityName),
        react_1.default.createElement("div", null,
            "Temperature: ",
            weatherData.temperature,
            "\u00B0C"),
        react_1.default.createElement("div", null,
            "Feels like: ",
            weatherData.feelsLike,
            "\u00B0C"),
        react_1.default.createElement("div", null,
            "Humidity: ",
            weatherData.humidity,
            "%"),
        react_1.default.createElement("div", null,
            "Wind: ",
            weatherData.windSpeed,
            " km/h"),
        react_1.default.createElement("div", null,
            "Rain: ",
            weatherData.rainProbability,
            "%"),
        react_1.default.createElement("div", null,
            "UV: ",
            weatherData.uvIndex),
        react_1.default.createElement("div", null,
            "Condition: ",
            weatherData.weatherCondition),
        react_1.default.createElement("div", null,
            "Code: ",
            weatherData.weatherCode),
        react_1.default.createElement("div", null,
            "AQI: ",
            weatherData.airQuality,
            " (",
            weatherData.aqi,
            ")"),
        react_1.default.createElement("div", null,
            "Updated: ",
            weatherData.lastUpdated.toLocaleTimeString())));
};
exports.default = WeatherDebug;
