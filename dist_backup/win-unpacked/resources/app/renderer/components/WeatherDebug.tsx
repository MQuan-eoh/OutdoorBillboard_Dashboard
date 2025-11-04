// WeatherDebug.tsx - Debug component using global weather service
import React, { useState, useEffect } from "react";
import { WeatherData } from "../services/weatherService";

// Import the GlobalWeatherServiceManager from WeatherPanel
// Note: In a proper app structure, this should be in a separate utils file
declare global {
  interface Window {
    GlobalWeatherServiceManager: any;
  }
}

const WeatherDebug: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("unknown");

  useEffect(() => {
    // Access the global weather service (assumes WeatherPanel is already rendered)
    const checkForGlobalService = () => {
      try {
        // Try to get existing data from global service
        // This is a simplified approach - in production, we'd have proper module exports
        const globalServiceExists =
          typeof window !== "undefined" &&
          document.querySelector(".weather-panel");

        if (globalServiceExists) {
          // Subscribe to the same data as WeatherPanel
          const pollInterval = setInterval(() => {
            // Check if WeatherPanel has updated data by looking at its displayed content
            const tempElement = document.querySelector(".temperature-main");
            const humidityElement = document.querySelector(
              ".weather-details .detail-value"
            );

            if (tempElement && humidityElement) {
              const displayedTemp = tempElement.textContent?.replace("°", "");
              const displayedHumidity = humidityElement.textContent?.replace(
                "%",
                ""
              );

              if (displayedTemp && displayedHumidity) {
                // Create debug data object matching what's displayed
                const debugData: WeatherData = {
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
        } else {
          setError("WeatherPanel not found - Global service not available");
          setIsLoading(false);
        }
      } catch (err) {
        setError(`Debug Error: ${err}`);
        setIsLoading(false);
        console.error("WeatherDebug: Error accessing global service:", err);
      }
    };

    // Wait a bit for WeatherPanel to initialize
    setTimeout(checkForGlobalService, 2000);
  }, []);

  if (isLoading) {
    return (
      <div style={{ color: "white", padding: "10px" }}>
        Loading weather data...
      </div>
    );
  }

  if (error) {
    return <div style={{ color: "red", padding: "10px" }}>Error: {error}</div>;
  }

  if (!weatherData) {
    return (
      <div style={{ color: "yellow", padding: "10px" }}>
        No weather data available
      </div>
    );
  }

  return (
    <div
      style={{
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
      }}
    >
      <h4>Weather API Debug</h4>
      <div>City: {weatherData.cityName}</div>
      <div>Temperature: {weatherData.temperature}°C</div>
      <div>Feels like: {weatherData.feelsLike}°C</div>
      <div>Humidity: {weatherData.humidity}%</div>
      <div>Wind: {weatherData.windSpeed} km/h</div>
      <div>Rain: {weatherData.rainProbability}%</div>
      <div>UV: {weatherData.uvIndex}</div>
      <div>Condition: {weatherData.weatherCondition}</div>
      <div>Code: {weatherData.weatherCode}</div>
      <div>
        AQI: {weatherData.airQuality} ({weatherData.aqi})
      </div>
      <div>Updated: {weatherData.lastUpdated.toLocaleTimeString()}</div>
    </div>
  );
};

export default WeatherDebug;
