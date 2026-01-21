// test-weather-comparison.js - So sánh kết quả từ nhiều weather APIs
const axios = require("axios");

async function compareWeatherAPIs() {
  console.log("🌤️  WEATHER API COMPARISON FOR HUE, VIETNAM");
  console.log("=".repeat(60));

  const lat = 16.4637;
  const lon = 107.5909;
  const city = "Hue, Vietnam";

  // 1. Test OpenMeteo (Current)
  await testOpenMeteo(lat, lon, city);

  console.log("\n" + "=".repeat(60));

  // 2. Test WeatherAPI (Demo)
  await testWeatherAPI(lat, lon, city);

  console.log("\n" + "=".repeat(60));

  // 3. Compare with visual web services
  console.log("🌐 VISUAL WEB SERVICES FOR COMPARISON:");
  console.log("1. AccuWeather: https://www.accuweather.com/");
  console.log("   Search: 'Hue, Vietnam'");
  console.log("2. Weather.com: https://weather.com/");
  console.log("   Search: 'Hue, Thua Thien Hue, Vietnam'");
  console.log("3. Windy.com: https://www.windy.com/");
  console.log("   Search: 'Hue, Vietnam'");
  console.log("4. OpenWeatherMap: https://openweathermap.org/city/1580700");
}

async function testOpenMeteo(lat, lon, city) {
  console.log("🟢 OPENMETEO API (Current Primary)");

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,uv_index,apparent_temperature,precipitation_probability,visibility&timezone=Asia/Ho_Chi_Minh&forecast_days=1`;

    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    const current = data.current_weather;
    const hourly = data.hourly;
    const currentHour = new Date().getHours();

    console.log(`📍 Location: ${city}`);
    console.log(`🌡️  Temperature: ${Math.round(current.temperature)}°C`);
    console.log(
      `🌡️  Feels Like: ${Math.round(
        hourly.apparent_temperature[currentHour] || current.temperature
      )}°C`
    );
    console.log(
      `💧 Humidity: ${Math.round(
        hourly.relativehumidity_2m[currentHour] || 70
      )}%`
    );
    console.log(`💨 Wind Speed: ${Math.round(current.windspeed)} km/h`);
    console.log(
      `☀️  UV Index: ${Math.round(hourly.uv_index[currentHour] || 0)}`
    );
    console.log(
      `🌧️  Rain Probability: ${Math.round(
        hourly.precipitation_probability[currentHour] || 20
      )}%`
    );
    console.log(
      `👀 Visibility: ${Math.round(
        hourly.visibility[currentHour] / 1000 || 10
      )} km`
    );
    console.log(`⏰ Time: ${new Date().toLocaleString("vi-VN")}`);
    console.log(`✅ Status: SUCCESS`);
  } catch (error) {
    console.log(`❌ Status: FAILED - ${error.message}`);
  }
}

async function testWeatherAPI(lat, lon, city) {
  console.log("🟡 WEATHERAPI.COM (Demo - Limited)");

  try {
    // Using demo key - limited requests
    const url = `https://api.weatherapi.com/v1/current.json?key=demo&q=${lat},${lon}&aqi=yes`;

    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    const current = data.current;

    console.log(`📍 Location: ${data.location.name}, ${data.location.country}`);
    console.log(`🌡️  Temperature: ${Math.round(current.temp_c)}°C`);
    console.log(`🌡️  Feels Like: ${Math.round(current.feelslike_c)}°C`);
    console.log(`💧 Humidity: ${current.humidity}%`);
    console.log(`💨 Wind Speed: ${Math.round(current.wind_kph)} km/h`);
    console.log(`☀️  UV Index: ${current.uv}`);
    console.log(`🌧️  Precipitation: ${current.precip_mm}mm`);
    console.log(`👀 Visibility: ${current.vis_km} km`);
    console.log(`🌤️  Condition: ${current.condition.text}`);
    console.log(`⏰ Time: ${current.last_updated}`);
    console.log(`✅ Status: SUCCESS`);
  } catch (error) {
    console.log(`❌ Status: FAILED - ${error.message}`);
    console.log(
      "💡 Note: Demo key has limited requests. For full access, need real API key."
    );
  }
}

// Run comparison
compareWeatherAPIs().catch(console.error);
