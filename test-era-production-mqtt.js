/**
 * E-RA Production MQTT Test
 * Test chính thức với authentication và topic pattern đã được xác minh
 *
 * KẾT QUẢ TEST AUTHENTICATION:
 * ✅ gatewayToken works for authentication
 * ❌ extracted token from authToken fails
 *
 * NGUYÊN NHÂN DESKTOP APP HIỂN THỊ N/A:
 * - Code sử dụng extracted token cho topics nhưng gatewayToken cho auth
 * - Topics phải sử dụng gatewayToken thay vì extracted token
 */

const fs = require("fs");
const path = require("path");
const mqtt = require("mqtt");

// Colors for better output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bright: "\x1b[1m",
  magenta: "\x1b[35m",
};

function log(level, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  let colorCode = colors.reset;

  switch (level) {
    case "SUCCESS":
      colorCode = colors.green;
      break;
    case "ERROR":
      colorCode = colors.red;
      break;
    case "WARNING":
      colorCode = colors.yellow;
      break;
    case "INFO":
      colorCode = colors.blue;
      break;
    case "DEBUG":
      colorCode = colors.cyan;
      break;
    case "DATA":
      colorCode = colors.magenta;
      break;
  }

  console.log(`${colorCode}[${timestamp}] ${level}: ${message}${colors.reset}`);
  if (data) {
    console.log(
      `${colors.cyan}${JSON.stringify(data, null, 2)}${colors.reset}`
    );
  }
}

// Load config
let config = null;
try {
  const configPath = path.join(__dirname, "config.json");
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  log("SUCCESS", "Config loaded successfully");
} catch (error) {
  log("ERROR", "Could not load config.json", error.message);
  process.exit(1);
}

if (!config.eraIot || !config.eraIot.enabled) {
  log("ERROR", "E-RA IoT is not enabled in config.json");
  process.exit(1);
}

const gatewayToken = config.eraIot.gatewayToken;
const sensorConfigs = config.eraIot.sensorConfigs;

log("INFO", "E-RA Production MQTT Test");
log("INFO", "=========================");
log("INFO", `GatewayToken: ${gatewayToken}`);
log("INFO", "Sensor Configs:", sensorConfigs);

// Create MQTT client with WORKING authentication
const client = mqtt.connect("mqtt://mqtt1.eoh.io:1883", {
  username: gatewayToken, // ✅ Sử dụng gatewayToken (đã test thành công)
  password: gatewayToken,
  clientId: `production_test_${Date.now()}`,
  keepalive: 60,
  connectTimeout: 30000,
  clean: true,
});

let sensorData = {
  temperature: null,
  humidity: null,
  pm25: null,
  pm10: null,
};

let dataReceivedCount = 0;

client.on("connect", () => {
  log("SUCCESS", "Connected to E-RA MQTT Broker!");

  // Subscribe với ĐÚNG topic pattern (sử dụng gatewayToken)
  Object.entries(sensorConfigs).forEach(([sensor, configId]) => {
    if (configId) {
      const topic = `eoh/chip/${gatewayToken}/config/${configId}/value`; // ✅ Sử dụng gatewayToken

      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          log("ERROR", `Subscribe failed for ${sensor}`, err.message);
        } else {
          log("SUCCESS", `Subscribed to ${sensor.toUpperCase()}: ${topic}`);
        }
      });
    }
  });

  log("INFO", "");
  log("INFO", "🔥 LISTENING FOR SENSOR DATA...");
  log("INFO", "Press Ctrl+C to stop");
  log("INFO", "");
});

client.on("message", (topic, message) => {
  dataReceivedCount++;

  try {
    const value = message.toString();
    log("DATA", `📡 Raw Message Received:`);
    log("DATA", `Topic: ${topic}`);
    log("DATA", `Value: ${value}`);

    // Parse topic để xác định sensor type
    const topicParts = topic.split("/");
    const configId = topicParts[topicParts.length - 2]; // Extract config ID from topic

    // Map config ID to sensor name
    let sensorName = null;
    Object.entries(sensorConfigs).forEach(([sensor, id]) => {
      if (id.toString() === configId) {
        sensorName = sensor;
      }
    });

    if (sensorName) {
      sensorData[sensorName] = parseFloat(value);
      log("SUCCESS", `✅ ${sensorName.toUpperCase()}: ${value}`);

      // Display current sensor status
      log("INFO", "");
      log("INFO", "📊 CURRENT SENSOR STATUS:");
      Object.entries(sensorData).forEach(([sensor, value]) => {
        const status = value !== null ? `${value}` : "N/A";
        const statusColor = value !== null ? colors.green : colors.red;
        console.log(
          `${statusColor}   ${sensor.toUpperCase()}: ${status}${colors.reset}`
        );
      });
      log("INFO", `Total messages received: ${dataReceivedCount}`);
      log("INFO", "");
    } else {
      log("WARNING", `Unknown config ID: ${configId}`);
    }
  } catch (error) {
    log("ERROR", "Error parsing message", error.message);
  }
});

client.on("error", (error) => {
  log("ERROR", "MQTT Connection Error", error.message);
});

client.on("close", () => {
  log("WARNING", "MQTT Connection Closed");
});

client.on("offline", () => {
  log("WARNING", "MQTT Client Offline");
});

client.on("reconnect", () => {
  log("INFO", "Attempting to reconnect...");
});

// Graceful shutdown
process.on("SIGINT", () => {
  log("INFO", "");
  log("INFO", "🛑 Stopping MQTT test...");
  log("INFO", "");
  log("INFO", "📋 FINAL RESULTS:");
  log("INFO", "=================");

  Object.entries(sensorData).forEach(([sensor, value]) => {
    const status = value !== null ? `${value}` : "NO DATA RECEIVED";
    const statusColor = value !== null ? colors.green : colors.red;
    console.log(
      `${statusColor}${sensor.toUpperCase()}: ${status}${colors.reset}`
    );
  });

  log("INFO", `Total messages received: ${dataReceivedCount}`);

  if (dataReceivedCount === 0) {
    log("WARNING", "");
    log("WARNING", "❌ NO DATA RECEIVED. Possible causes:");
    log("WARNING", "1. E-RA Gateway is offline");
    log("WARNING", "2. Sensors are not connected to gateway");
    log("WARNING", "3. Gateway is not publishing to these config IDs");
    log("WARNING", "4. Network connectivity issues");
  } else {
    log("SUCCESS", "");
    log("SUCCESS", "✅ Data reception verified!");
    log(
      "SUCCESS",
      "The MQTT connection and authentication is working correctly."
    );
  }

  client.end();
  process.exit(0);
});

// Auto-exit after 60 seconds for testing purposes
setTimeout(() => {
  log("INFO", "");
  log("INFO", "⏰ 60 second test completed. Stopping...");
  process.kill(process.pid, "SIGINT");
}, 60000);

log("INFO", "");
log("INFO", "🚀 Starting 60-second sensor data monitoring...");
log("INFO", "Watch for real-time sensor data below:");
log("INFO", "");
