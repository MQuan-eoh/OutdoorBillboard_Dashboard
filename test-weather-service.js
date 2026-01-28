// Test Weather Service Integration
const WeatherService = require("./dist/weatherService").default;

async function testWeatherService() {
  console.log("Testing WeatherService integration...");

  const config = {
    location: {
      lat: 16.4637,
      lon: 107.5909,
      city: "MENAS ZONE VĨ DẠ",
    },
    updateInterval: 10,
    retryInterval: 3,
    maxRetries: 5,
  };

  try {
    console.log("Creating WeatherService instance...");
    const weatherService = new WeatherService(config);

    console.log("Waiting for initial data...");

    // Wait a bit for initial fetch
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const weatherData = weatherService.getCurrentWeather();

    if (weatherData) {
      console.log("Weather Data Retrieved Successfully:");
      console.log("- City:", weatherData.cityName);
      console.log("- Temperature:", weatherData.temperature + "°C");
      console.log("- Condition:", weatherData.weatherCondition);
      console.log("- Humidity:", weatherData.humidity + "%");
      console.log("- Last Updated:", weatherData.lastUpdated.toLocaleString());
    } else {
      console.log("No weather data available");
    }

    const status = weatherService.getStatus();
    console.log("Service Status:", status);

    // Cleanup
    weatherService.destroy();
  } catch (error) {
    console.error("WeatherService test failed:", error);
  }
}

testWeatherService();
