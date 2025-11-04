"use strict";
// weatherIcons.ts - Weather icon system with SVG icons (no emojis)
// Professional weather icons for outdoor billboard display
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherIcons = void 0;
exports.getWeatherIcon = getWeatherIcon;
exports.getWeatherIconColor = getWeatherIconColor;
// weatherIcons.ts - Weather icon system with image files
// Professional weather icons for outdoor billboard display using custom images
exports.WeatherIcons = {
    // Clear sky / Sunny - Using sun.png
    CLEAR_DAY: "../assets/imgs/sun.png",
    // Partly cloudy - Using weather.png
    PARTLY_CLOUDY: "../assets/imgs/weather.png",
    // Cloudy - Using weather.png
    CLOUDY: "../assets/imgs/weather.png",
    // Rainy - Using storm.png
    RAINY: "../assets/imgs/storm.png",
    // Heavy rain - Using storm.png
    HEAVY_RAIN: "../assets/imgs/storm.png",
    // Thunderstorm - Using storm.png
    THUNDERSTORM: "../assets/imgs/storm.png",
    // Snow - Using weather.png (fallback)
    SNOW: "../assets/imgs/weather.png",
    // Fog/Mist - Using weather.png (fallback)
    FOG: "../assets/imgs/weather.png",
    // Wind - Using wind.png
    WIND: "../assets/imgs/wind.png",
    // Default/Unknown - Using weather.png (fallback)
    DEFAULT: "../assets/imgs/weather.png",
};
/**
 * Get weather icon path based on weather code and condition
 */
function getWeatherIcon(weatherCode, condition) {
    // Clear sky conditions
    if (weatherCode === 0 ||
        weatherCode === 1 ||
        condition.includes("quang") ||
        condition.includes("nắng")) {
        return exports.WeatherIcons.CLEAR_DAY;
    }
    // Partly cloudy
    if (weatherCode === 2 ||
        weatherCode === 3 ||
        condition.includes("mây") ||
        condition.includes("u ám")) {
        return exports.WeatherIcons.PARTLY_CLOUDY;
    }
    // Cloudy
    if (condition.includes("âm u") || condition.includes("nhiều mây")) {
        return exports.WeatherIcons.CLOUDY;
    }
    // Rain conditions
    if ((weatherCode >= 61 && weatherCode <= 65) || condition.includes("mưa")) {
        if (condition.includes("to") || weatherCode === 65) {
            return exports.WeatherIcons.HEAVY_RAIN;
        }
        return exports.WeatherIcons.RAINY;
    }
    // Drizzle
    if ((weatherCode >= 51 && weatherCode <= 55) || condition.includes("phùn")) {
        return exports.WeatherIcons.RAINY;
    }
    // Thunderstorm
    if ((weatherCode >= 95 && weatherCode <= 99) || condition.includes("dông")) {
        return exports.WeatherIcons.THUNDERSTORM;
    }
    // Snow
    if ((weatherCode >= 71 && weatherCode <= 75) || condition.includes("tuyết")) {
        return exports.WeatherIcons.SNOW;
    }
    // Fog/Mist
    if (weatherCode === 45 || weatherCode === 48 || condition.includes("sương")) {
        return exports.WeatherIcons.FOG;
    }
    // Wind
    if (condition.includes("gió")) {
        return exports.WeatherIcons.WIND;
    }
    // Default
    return exports.WeatherIcons.DEFAULT;
}
/**
 * Get weather icon color based on condition
 */
function getWeatherIconColor(weatherCode, condition) {
    // Clear/Sunny - Yellow/Orange
    if (weatherCode === 0 ||
        weatherCode === 1 ||
        condition.includes("quang") ||
        condition.includes("nắng")) {
        return "#FFD700";
    }
    // Cloudy - Gray
    if ((weatherCode >= 2 && weatherCode <= 3) || condition.includes("mây")) {
        return "#B0C4DE";
    }
    // Rain - Blue
    if ((weatherCode >= 51 && weatherCode <= 65) ||
        condition.includes("mưa") ||
        condition.includes("phùn")) {
        return "#4682B4";
    }
    // Thunderstorm - Dark blue/purple
    if ((weatherCode >= 95 && weatherCode <= 99) || condition.includes("dông")) {
        return "#4B0082";
    }
    // Snow - Light blue/white
    if ((weatherCode >= 71 && weatherCode <= 75) || condition.includes("tuyết")) {
        return "#E6F3FF";
    }
    // Fog - Light gray
    if (weatherCode === 45 || weatherCode === 48 || condition.includes("sương")) {
        return "#D3D3D3";
    }
    // Default - White
    return "#FFFFFF";
}
