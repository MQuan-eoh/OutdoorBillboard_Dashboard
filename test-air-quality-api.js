/**
 * Test script để test Air Quality API với Unit ID
 * Test API: /property_manager/units/{unit_id}/summary/
 * Dùng để debug và validate chất lượng không khí data
 */

const fs = require("fs");
const path = require("path");

// Load config để lấy auth token
function loadConfig() {
  try {
    const configPath = path.join(__dirname, "config.json");
    const configData = fs.readFileSync(configPath, "utf8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Error loading config:", error.message);
    return null;
  }
}

// Mock auth service để test
class TestAuthService {
  constructor(token) {
    this.token = token;
  }

  isAuthenticated() {
    return !!this.token;
  }

  getAuthHeaders() {
    return {
      Authorization: this.token, // Token already includes "Token " prefix
      "Content-Type": "application/json",
    };
  }
}

// Test function để test Air Quality API
async function testAirQualityAPI() {
  console.log("🌬️  TESTING AIR QUALITY API - DEBUG REPORT");
  console.log("=".repeat(60));

  const config = loadConfig();
  if (!config || !config.eraIot || !config.eraIot.authToken) {
    console.error("❌ No E-Ra auth token found in config.json");
    return;
  }

  const authService = new TestAuthService(config.eraIot.authToken);
  const baseUrl = "https://backend.eoh.io";

  console.log("✅ Auth token loaded successfully");
  console.log("🌐 Base URL:", baseUrl);
  console.log("");

  // Step 1: Get some unit IDs first
  console.log("📋 STEP 1: Get Available Unit IDs");
  console.log("-".repeat(40));

  let availableUnits = [];
  try {
    const unitsUrl = `${baseUrl}/api/property_manager/iot_dashboard/dev_mode/units/`;
    console.log("🔗 URL:", unitsUrl);

    const response = await fetch(unitsUrl, {
      method: "GET",
      headers: authService.getAuthHeaders(),
    });

    const responseData = await response.json();
    console.log("📊 Response Status:", response.status);

    if (response.ok && responseData) {
      const units = parseUnitsResponse(responseData);
      availableUnits = units.slice(0, 10); // Take first 10 units for testing
      console.log(
        `✅ Found ${units.length} total units, testing first ${availableUnits.length}:`
      );

      availableUnits.forEach((unit, index) => {
        console.log(`   ${index + 1}. ${unit.name} (ID: ${unit.id})`);
      });
    } else {
      console.log("❌ Failed to get units list");
      return;
    }
  } catch (error) {
    console.error("❌ Error calling units API:", error.message);
    return;
  }

  console.log("");

  // Step 2: Test Air Quality API with different Unit IDs
  console.log("🌬️  STEP 2: Test Air Quality API with Unit IDs");
  console.log("-".repeat(40));

  const successfulUnits = [];
  const failedUnits = [];

  for (let i = 0; i < Math.min(availableUnits.length, 5); i++) {
    const unit = availableUnits[i];
    console.log(`\n🔍 Testing Unit ${i + 1}: ${unit.name} (ID: ${unit.id})`);
    console.log("   " + "-".repeat(50));

    try {
      const airQualityUrl = `${baseUrl}/api/property_manager/units/${unit.id}/summary/`;
      console.log(`   🔗 URL: ${airQualityUrl}`);

      const response = await fetch(airQualityUrl, {
        method: "GET",
        headers: authService.getAuthHeaders(),
      });

      const responseData = await response.json();
      console.log(`   📊 Status: ${response.status}`);

      if (response.ok && responseData) {
        console.log("   ✅ SUCCESS - Air quality data available!");

        // Parse và hiển thị air quality data
        const airQualityData = parseAirQualityResponse(responseData);
        displayAirQualityData(airQualityData, unit);

        successfulUnits.push({
          unit: unit,
          data: airQualityData,
        });
      } else {
        console.log("   ❌ FAILED - No air quality data");
        console.log(`   📄 Response: ${JSON.stringify(responseData, null, 2)}`);
        failedUnits.push({
          unit: unit,
          error: responseData.message || responseData.error || "Unknown error",
        });
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failedUnits.push({
        unit: unit,
        error: error.message,
      });
    }

    // Add delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("");

  // Step 3: Summary Report
  console.log("📊 STEP 3: Summary Report");
  console.log("-".repeat(40));

  console.log(`✅ Successful Units: ${successfulUnits.length}`);
  console.log(`❌ Failed Units: ${failedUnits.length}`);

  if (successfulUnits.length > 0) {
    console.log("\n🎯 WORKING UNITS WITH AIR QUALITY DATA:");
    successfulUnits.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.unit.name} (ID: ${item.unit.id})`);
      console.log(`      📊 Data points: ${Object.keys(item.data).length}`);
      if (item.data.pm25 !== undefined)
        console.log(`      🌫️  PM2.5: ${item.data.pm25} μg/m³`);
      if (item.data.pm10 !== undefined)
        console.log(`      🌪️  PM10: ${item.data.pm10} μg/m³`);
      if (item.data.temperature !== undefined)
        console.log(`      🌡️  Temperature: ${item.data.temperature}°C`);
      if (item.data.humidity !== undefined)
        console.log(`      💧 Humidity: ${item.data.humidity}%`);
    });
  }

  if (failedUnits.length > 0) {
    console.log("\n❌ FAILED UNITS:");
    failedUnits.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.unit.name} (ID: ${item.unit.id})`);
      console.log(`      Error: ${item.error}`);
    });
  }

  // Step 4: Detailed analysis for best unit
  if (successfulUnits.length > 0) {
    console.log("");
    console.log("🔬 STEP 4: Detailed Analysis for Best Unit");
    console.log("-".repeat(40));

    const bestUnit = successfulUnits[0]; // Take first successful unit
    await performDetailedAnalysis(bestUnit, authService, baseUrl);
  }

  console.log("");
  console.log("🏁 AIR QUALITY API TEST COMPLETED");
  console.log("=".repeat(60));
}

// Parse units response (reused from test-units-debug.js)
function parseUnitsResponse(responseData) {
  const units = [];

  try {
    let unitData = null;

    if (responseData.units && Array.isArray(responseData.units)) {
      unitData = responseData.units;
    } else if (responseData.results && Array.isArray(responseData.results)) {
      unitData = responseData.results;
    } else if (Array.isArray(responseData)) {
      unitData = responseData;
    } else if (responseData.data && Array.isArray(responseData.data)) {
      unitData = responseData.data;
    }

    if (Array.isArray(unitData)) {
      unitData.forEach((unit) => {
        units.push({
          id: unit.id || unit.unit_id || unit.unitId || 0,
          name:
            unit.name || unit.unit_name || unit.unitName || `Unit ${unit.id}`,
          description: unit.description || unit.desc || undefined,
          address: unit.address || undefined,
          type: unit.type || unit.unit_type || undefined,
          status: unit.status || (unit.is_active ? "active" : "inactive"),
          building: unit.building || unit.building_name || undefined,
          floor: unit.floor || unit.floor_name || undefined,
          room: unit.room || unit.room_name || undefined,
        });
      });
    }
  } catch (error) {
    console.error("Error parsing units response:", error);
  }

  return units;
}

// Parse air quality response
function parseAirQualityResponse(responseData) {
  const airQuality = {};

  try {
    // Handle different possible response structures
    let data = responseData;

    // Check for nested data structures
    if (responseData.data) {
      data = responseData.data;
    } else if (responseData.summary) {
      data = responseData.summary;
    } else if (responseData.air_quality) {
      data = responseData.air_quality;
    }

    // Extract air quality parameters
    const fields = [
      "pm25",
      "pm2_5",
      "PM2.5",
      "PM25",
      "pm10",
      "PM10",
      "temperature",
      "temp",
      "Temperature",
      "humidity",
      "hum",
      "Humidity",
      "pressure",
      "Pressure",
      "aqi",
      "AQI",
      "air_quality_index",
    ];

    // Check in multiple possible locations
    const checkLocations = [data, responseData];

    checkLocations.forEach((location) => {
      if (location && typeof location === "object") {
        fields.forEach((field) => {
          if (location[field] !== undefined && location[field] !== null) {
            const normalizedField = normalizeFieldName(field);
            if (airQuality[normalizedField] === undefined) {
              airQuality[normalizedField] = location[field];
            }
          }
        });

        // Check for nested sensor data
        if (location.sensors && Array.isArray(location.sensors)) {
          location.sensors.forEach((sensor) => {
            fields.forEach((field) => {
              if (sensor[field] !== undefined && sensor[field] !== null) {
                const normalizedField = normalizeFieldName(field);
                if (airQuality[normalizedField] === undefined) {
                  airQuality[normalizedField] = sensor[field];
                }
              }
            });
          });
        }
      }
    });

    // Store raw response for debugging
    airQuality._raw = responseData;
  } catch (error) {
    console.error("Error parsing air quality response:", error);
    airQuality.error = error.message;
    airQuality._raw = responseData;
  }

  return airQuality;
}

// Normalize field names
function normalizeFieldName(field) {
  const fieldMap = {
    pm2_5: "pm25",
    "PM2.5": "pm25",
    PM25: "pm25",
    PM10: "pm10",
    temp: "temperature",
    Temperature: "temperature",
    hum: "humidity",
    Humidity: "humidity",
    Pressure: "pressure",
    AQI: "aqi",
    air_quality_index: "aqi",
  };

  return fieldMap[field] || field.toLowerCase();
}

// Display air quality data
function displayAirQualityData(data, unit) {
  console.log(`   📊 Air Quality Data for ${unit.name}:`);

  const displayData = Object.keys(data).filter((key) => !key.startsWith("_"));

  if (displayData.length === 0) {
    console.log("   ❌ No air quality parameters found");
    return;
  }

  displayData.forEach((key) => {
    const value = data[key];
    const emoji = getParameterEmoji(key);
    const unit_suffix = getParameterUnit(key);
    console.log(`      ${emoji} ${key}: ${value}${unit_suffix}`);
  });
}

// Get emoji for parameter
function getParameterEmoji(param) {
  const emojiMap = {
    pm25: "🌫️ ",
    pm10: "🌪️ ",
    temperature: "🌡️ ",
    humidity: "💧",
    pressure: "🌪️ ",
    aqi: "📊",
  };
  return emojiMap[param] || "📈";
}

// Get unit suffix for parameter
function getParameterUnit(param) {
  const unitMap = {
    pm25: " μg/m³",
    pm10: " μg/m³",
    temperature: "°C",
    humidity: "%",
    pressure: " hPa",
    aqi: "",
  };
  return unitMap[param] || "";
}

// Perform detailed analysis for a unit
async function performDetailedAnalysis(unitData, authService, baseUrl) {
  console.log(
    `🔬 Detailed analysis for: ${unitData.unit.name} (ID: ${unitData.unit.id})`
  );

  try {
    const airQualityUrl = `${baseUrl}/api/property_manager/units/${unitData.unit.id}/summary/`;

    // Make multiple requests to check data consistency
    console.log("   📊 Making 3 requests to check data consistency...");

    const requests = [];
    for (let i = 0; i < 3; i++) {
      requests.push(
        fetch(airQualityUrl, {
          method: "GET",
          headers: authService.getAuthHeaders(),
        }).then((res) => res.json())
      );
      await new Promise((resolve) => setTimeout(resolve, 200)); // Small delay
    }

    const responses = await Promise.all(requests);

    console.log("   📈 Data consistency check:");
    responses.forEach((response, index) => {
      const data = parseAirQualityResponse(response);
      console.log(`      Request ${index + 1}:`);
      if (data.pm25 !== undefined) console.log(`         PM2.5: ${data.pm25}`);
      if (data.pm10 !== undefined) console.log(`         PM10: ${data.pm10}`);
      if (data.temperature !== undefined)
        console.log(`         Temp: ${data.temperature}`);
      if (data.humidity !== undefined)
        console.log(`         Humidity: ${data.humidity}`);
    });

    // Analyze raw response structure
    console.log("   🔍 Raw response structure analysis:");
    const sample = responses[0];
    console.log(`      Type: ${typeof sample}`);
    console.log(`      Keys: ${Object.keys(sample).join(", ")}`);
    console.log(`      Sample response (first 500 chars):`);
    console.log(
      `      ${JSON.stringify(sample, null, 2).substring(0, 500)}...`
    );
  } catch (error) {
    console.log(`   ❌ Error in detailed analysis: ${error.message}`);
  }
}

// Run the test
if (require.main === module) {
  testAirQualityAPI().catch(console.error);
}

module.exports = { testAirQualityAPI };
