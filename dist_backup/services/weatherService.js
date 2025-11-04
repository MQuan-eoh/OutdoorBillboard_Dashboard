"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const eraIotService_1 = __importDefault(require("./eraIotService"));
class WeatherService {
    constructor(config, eraIotConfig) {
        this.currentData = null;
        this.updateTimer = null;
        this.retryCount = 0;
        this.isUpdating = false;
        this.eraIotService = null;
        this.apiEndpoints = [
            {
                name: "OpenMeteo",
                baseUrl: "https://api.open-meteo.com/v1",
                enabled: true,
            },
        ];
        this.config = config;
        // Initialize E-Ra IoT service if configuration is provided
        if (eraIotConfig && eraIotConfig.authToken) {
            try {
                this.eraIotService = new eraIotService_1.default(eraIotConfig);
                this.eraIotService.startPeriodicUpdates();
                console.log("WeatherService: E-Ra IoT service initialized");
            }
            catch (error) {
                console.error("WeatherService: Failed to initialize E-Ra IoT service:", error);
            }
        }
        this.initializeService();
    }
    async initializeService() {
        console.log("WeatherService: Initializing for", this.config.location.city);
        try {
            await this.fetchWeatherData();
            console.log("WeatherService: Initial fetch completed");
        }
        catch (error) {
            console.error("WeatherService: Initial fetch failed:", error);
        }
        this.startPeriodicUpdates();
    }
    startPeriodicUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        this.updateTimer = setInterval(() => {
            this.fetchWeatherData();
        }, this.config.updateInterval * 60 * 1000);
        console.log(`WeatherService: Updates every ${this.config.updateInterval} minutes`);
    }
    stopPeriodicUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }
    async fetchWeatherData() {
        if (this.isUpdating) {
            console.log("WeatherService: Update in progress, skipping");
            return;
        }
        this.isUpdating = true;
        try {
            for (const api of this.apiEndpoints) {
                if (!api.enabled)
                    continue;
                try {
                    console.log(`WeatherService: Fetching from ${api.name}`);
                    const data = await this.fetchFromAPI(api);
                    if (data) {
                        this.currentData = data;
                        this.retryCount = 0;
                        console.log("WeatherService: Data updated successfully", {
                            temp: data.temperature,
                            condition: data.weatherCondition,
                            humidity: data.humidity,
                        });
                        break;
                    }
                }
                catch (error) {
                    console.error(`WeatherService: ${api.name} failed:`, error);
                    continue;
                }
            }
            if (!this.currentData || this.isDataStale()) {
                this.handleFetchFailure();
            }
        }
        catch (error) {
            console.error("WeatherService: Critical error:", error);
            this.handleFetchFailure();
        }
        finally {
            this.isUpdating = false;
        }
    }
    async fetchFromAPI(api) {
        const { lat, lon, city } = this.config.location;
        switch (api.name) {
            case "OpenMeteo":
                return this.fetchFromOpenMeteo(api, lat, lon, city);
            default:
                console.error(`Unknown API: ${api.name}`);
                return null;
        }
    }
    async fetchFromOpenMeteo(api, lat, lon, city) {
        const url = `${api.baseUrl}/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,uv_index,apparent_temperature,precipitation_probability,visibility&timezone=Asia/Ho_Chi_Minh&forecast_days=1`;
        console.log("WeatherService: API URL:", url);
        try {
            const response = await axios_1.default.get(url, {
                timeout: 15000,
                headers: {
                    "User-Agent": "ITS-Billboard/1.0",
                },
            });
            const data = response.data;
            console.log("WeatherService: API Response:", {
                hasCurrentWeather: !!data.current_weather,
                hasHourly: !!data.hourly,
                temperature: data.current_weather?.temperature,
            });
            const current = data.current_weather;
            const hourly = data.hourly;
            if (!current) {
                throw new Error("No current weather data");
            }
            const currentHour = new Date().getHours();
            const feelsLike = hourly.apparent_temperature?.[currentHour] || current.temperature;
            const humidity = hourly.relativehumidity_2m?.[currentHour] || 70;
            const uvIndex = hourly.uv_index?.[currentHour] || 3;
            const rainProbability = hourly.precipitation_probability?.[currentHour] ||
                (current.weathercode >= 51 ? 80 : 20);
            const visibility = hourly.visibility?.[currentHour]
                ? Math.round(hourly.visibility[currentHour] / 1000)
                : 10;
            const weatherCondition = this.getWeatherCondition(current.weathercode, rainProbability);
            const airQualityData = this.estimateAirQuality(current.weathercode, visibility);
            // Get real sensor data from E-Ra IoT service if available
            const sensorData = this.getSensorData();
            const weatherData = {
                cityName: city,
                temperature: Math.round(sensorData.temperature ?? current.temperature),
                feelsLike: Math.round(feelsLike),
                humidity: Math.round(sensorData.humidity ?? humidity),
                windSpeed: Math.round(current.windspeed),
                uvIndex: Math.round(uvIndex),
                rainProbability: Math.round(rainProbability),
                weatherCondition: weatherCondition,
                weatherCode: current.weathercode,
                airQuality: airQualityData.text,
                aqi: airQualityData.index,
                visibility: visibility,
                pm25: sensorData.pm25 ?? 2.06,
                pm10: sensorData.pm10 ?? 2.4,
                lastUpdated: new Date(),
            };
            console.log("WeatherService: Data processed:", weatherData);
            return weatherData;
        }
        catch (error) {
            console.error("WeatherService: OpenMeteo error:", error);
            if (axios_1.default.isAxiosError(error)) {
                console.error("Network details:", {
                    code: error.code,
                    message: error.message,
                    status: error.response?.status,
                });
            }
            throw error;
        }
    }
    getWeatherCondition(code, rainProb) {
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
            61: "Mưa nhẹ",
            63: "Mưa vừa",
            65: "Mưa to",
            71: "Tuyết nhẹ",
            73: "Tuyết vừa",
            75: "Tuyết to",
            80: "Mưa rào nhẹ",
            81: "Mưa rào vừa",
            82: "Mưa rào to",
            95: "Dông",
            96: "Dông có mưa đá nhẹ",
            99: "Dông có mưa đá to",
        };
        let condition = conditions[code] || "Không xác định";
        if (rainProb > 70 && !condition.includes("mưa")) {
            condition += " (có khả năng mưa)";
        }
        return condition;
    }
    estimateAirQuality(weatherCode, visibility) {
        if (visibility >= 10) {
            if (weatherCode <= 3)
                return { text: "Tốt", index: 1 };
            if (weatherCode >= 61 && weatherCode <= 82)
                return { text: "Khá", index: 2 };
            return { text: "Trung bình", index: 3 };
        }
        else if (visibility >= 5) {
            return { text: "Trung bình", index: 3 };
        }
        else {
            return { text: "Kém", index: 4 };
        }
    }
    handleFetchFailure() {
        this.retryCount++;
        console.error(`WeatherService: Failed (${this.retryCount}/${this.config.maxRetries})`);
        if (this.retryCount >= this.config.maxRetries) {
            console.error("WeatherService: Max retries reached");
            this.useFallbackData();
            this.retryCount = 0;
        }
        else {
            const retryDelay = Math.min(this.config.retryInterval * Math.pow(2, this.retryCount - 1), 30);
            console.log(`WeatherService: Retrying in ${retryDelay} minutes`);
            setTimeout(() => {
                this.fetchWeatherData();
            }, retryDelay * 60 * 1000);
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
                pm25: 2.06,
                pm10: 2.4,
                lastUpdated: new Date(),
            };
            console.log("WeatherService: Using fallback data");
        }
    }
    isDataStale() {
        if (!this.currentData)
            return true;
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        return this.currentData.lastUpdated < twoHoursAgo;
    }
    /**
     * Get sensor data from E-Ra IoT service with fallback values
     */
    getSensorData() {
        if (!this.eraIotService) {
            return {
                temperature: null,
                humidity: null,
                pm25: null,
                pm10: null,
            };
        }
        const iotData = this.eraIotService.getCurrentData();
        if (!iotData) {
            return {
                temperature: null,
                humidity: null,
                pm25: null,
                pm10: null,
            };
        }
        console.log("WeatherService: Using E-Ra IoT sensor data:", {
            temperature: iotData.temperature,
            humidity: iotData.humidity,
            pm25: iotData.pm25,
            pm10: iotData.pm10,
            status: iotData.status,
        });
        return {
            temperature: iotData.temperature,
            humidity: iotData.humidity,
            pm25: iotData.pm25,
            pm10: iotData.pm10,
        };
    }
    getCurrentWeather() {
        return this.currentData;
    }
    async refreshWeatherData() {
        if (this.currentData) {
            const dataAge = Date.now() - this.currentData.lastUpdated.getTime();
            const fiveMinutes = 5 * 60 * 1000;
            if (dataAge < fiveMinutes) {
                console.log(`WeatherService: Data fresh (${Math.round(dataAge / 60000)}min), skipping`);
                return;
            }
        }
        console.log("WeatherService: Manual refresh");
        await this.fetchWeatherData();
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.startPeriodicUpdates();
    }
    getStatus() {
        return {
            isRunning: this.updateTimer !== null,
            lastUpdate: this.currentData?.lastUpdated || null,
            retryCount: this.retryCount,
        };
    }
    destroy() {
        this.stopPeriodicUpdates();
        if (this.eraIotService) {
            this.eraIotService.destroy();
        }
        this.currentData = null;
        console.log("WeatherService: Destroyed");
    }
    /**
     * Get E-Ra IoT service status for debugging
     */
    getIotStatus() {
        if (!this.eraIotService) {
            return { enabled: false };
        }
        const status = this.eraIotService.getStatus();
        return {
            enabled: true,
            status: status.currentStatus,
            lastUpdate: status.lastUpdate,
        };
    }
}
exports.default = WeatherService;
