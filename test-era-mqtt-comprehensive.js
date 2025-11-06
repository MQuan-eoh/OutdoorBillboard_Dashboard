/**
 * E-RA MQTT Comprehensive Test
 * Tests E-RA MQTT connection with real config values from config.json
 *
 * Configuration from config.json:
 * - temperature: 145634
 * - humidity: 145615
 * - pm25: 145635
 * - pm10: 145636
 * - gatewayToken: 1fb0dddf-8fd1-43f2-a229-32afeec4b0bf
 *
 * E-RA MQTT Specification:
 * - Broker: mqtt1.eoh.io:1883
 * - Username: {gatewayToken}
 * - Password: {gatewayToken}
 * - Topic: eoh/chip/{gatewayToken}/config/{configId}/value
 * - Message format: JSON {"key": value} or direct value
 * - QoS: 1 (At least once delivery)
 */

const fs = require("fs");
const path = require("path");

// Color codes for better terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bright: "\x1b[1m",
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
  }

  console.log(`${colorCode}[${timestamp}] ${level}: ${message}${colors.reset}`);
  if (data && typeof data === "object") {
    console.log(
      `${colors.cyan}${JSON.stringify(data, null, 2)}${colors.reset}`
    );
  } else if (data) {
    console.log(`${colors.cyan}${data}${colors.reset}`);
  }
}

// Load configuration
let config = null;
try {
  const configPath = path.join(__dirname, "config.json");
  const rawConfig = fs.readFileSync(configPath, "utf-8");
  config = JSON.parse(rawConfig);
  log("SUCCESS", "Config loaded successfully");
} catch (error) {
  log("ERROR", "Could not load config.json", error.message);
  process.exit(1);
}

// Validate E-RA IoT configuration
if (!config.eraIot || !config.eraIot.enabled) {
  log("ERROR", "E-RA IoT is not enabled in config.json");
  process.exit(1);
}

const gatewayToken = config.eraIot.gatewayToken;
const sensorConfigs = config.eraIot.sensorConfigs;

if (!gatewayToken) {
  log("ERROR", "Gateway token is required in config.eraIot.gatewayToken");
  process.exit(1);
}

log("INFO", "E-RA MQTT Configuration Test");
log("INFO", "============================");
log("INFO", `Broker: mqtt1.eoh.io:1883`);
log("INFO", `Gateway Token: ${gatewayToken.substring(0, 15)}...`);
log("INFO", `Sensor Configs:`, sensorConfigs);

// Check MQTT.js availability
let mqtt = null;
try {
  mqtt = require("mqtt");
  log("SUCCESS", "MQTT.js library is available");
} catch (error) {
  log("ERROR", "MQTT.js library not found. Install with: npm install mqtt");
  log("WARNING", "For testing purposes, showing configuration only.");

  // Show what the test would do
  log("INFO", "Expected MQTT Topics:");
  Object.entries(sensorConfigs).forEach(([sensor, configId]) => {
    if (configId) {
      const topic = `eoh/chip/${gatewayToken}/config/${configId}/value`;
      log("INFO", `${sensor.toUpperCase()}: ${topic}`);
    }
  });

  process.exit(0);
}

// MQTT Connection Setup
log("INFO", "Connecting to E-RA MQTT broker...");

const mqttOptions = {
  username: gatewayToken,
  password: gatewayToken,
  clientId: `test_era_${gatewayToken.substring(0, 8)}_${Date.now()}`,
  keepalive: 60,
  connectTimeout: 15000,
  clean: true,
  reconnectPeriod: 5000,
  will: {
    topic: `eoh/chip/${gatewayToken}/lwt`,
    payload: JSON.stringify({ ol: 0 }), // Gateway offline
    qos: 1,
    retain: true,
  },
};

log("DEBUG", "MQTT Connection Options:", {
  broker: "mqtt1.eoh.io:1883",
  username: gatewayToken.substring(0, 10) + "...",
  clientId: mqttOptions.clientId,
  keepalive: mqttOptions.keepalive,
});

const client = mqtt.connect("mqtt://mqtt1.eoh.io:1883", mqttOptions);

// Connection tracking
let connectionTimer = null;
let messageCount = 0;
let receivedData = {
  temperature: null,
  humidity: null,
  pm25: null,
  pm10: null,
};

// Start connection timeout
connectionTimer = setTimeout(() => {
  log("ERROR", "Connection timeout after 20 seconds");
  client.end();
  process.exit(1);
}, 20000);

// MQTT Event Handlers
client.on("connect", () => {
  clearTimeout(connectionTimer);
  log("SUCCESS", `Connected to E-RA MQTT broker successfully!`);

  // Subscribe to all sensor topics
  const subscriptions = [];

  Object.entries(sensorConfigs).forEach(([sensor, configId]) => {
    if (configId) {
      const topic = `eoh/chip/${gatewayToken}/config/${configId}/value`;
      subscriptions.push(topic);
      log("INFO", `Subscribing to ${sensor.toUpperCase()}: ${topic}`);
    }
  });

  // Subscribe to LWT (Last Will and Testament) for gateway status
  const lwtTopic = `eoh/chip/${gatewayToken}/lwt`;
  subscriptions.push(lwtTopic);
  log("INFO", `Subscribing to LWT: ${lwtTopic}`);

  // Subscribe to all topics
  subscriptions.forEach((topic) => {
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        log("ERROR", `Failed to subscribe to ${topic}`, err.message);
      } else {
        log("SUCCESS", `Subscribed to: ${topic}`);
      }
    });
  });

  log("INFO", "");
  log("INFO", "Waiting for sensor data... (Press Ctrl+C to stop)");
  log("INFO", 'Expected message format: JSON {"key": value} or direct value');
  log("INFO", "");
});

client.on("message", (topic, message) => {
  messageCount++;
  const messageStr = message.toString();
  const timestamp = new Date().toLocaleTimeString();

  log("SUCCESS", `Message #${messageCount} received at ${timestamp}`);
  log("INFO", `Topic: ${topic}`);
  log("INFO", `Payload: ${messageStr}`);

  // Handle LWT messages
  if (topic.endsWith("/lwt")) {
    handleLwtMessage(messageStr);
    return;
  }

  // Extract config ID from topic
  const configIdMatch = topic.match(/\/config\/(\d+)\/value$/);
  if (!configIdMatch) {
    log("WARNING", "Could not extract config ID from topic");
    return;
  }

  const configId = parseInt(configIdMatch[1]);
  log("DEBUG", `Config ID: ${configId}`);

  // Identify sensor type
  const sensorType = Object.entries(sensorConfigs).find(
    ([, id]) => id === configId
  )?.[0];
  if (!sensorType) {
    log("WARNING", `Unknown config ID: ${configId}`);
    return;
  }

  log("INFO", `Sensor Type: ${sensorType.toUpperCase()}`);

  // Parse message value
  const parsedValue = parseEraValue(messageStr);
  if (parsedValue !== null) {
    receivedData[sensorType] = parsedValue;
    log("SUCCESS", `${sensorType.toUpperCase()} = ${parsedValue}`);

    // Display current data summary
    displayDataSummary();
  } else {
    log("ERROR", `Could not parse value for ${sensorType}`);
  }

  log("INFO", ""); // Blank line for readability
});

function handleLwtMessage(messageStr) {
  log("INFO", "LWT (Gateway Status) message received");
  try {
    const lwtData = JSON.parse(messageStr);
    if (lwtData.ol === 1) {
      log("SUCCESS", "Gateway is ONLINE");
    } else if (lwtData.ol === 0) {
      log("WARNING", "Gateway is OFFLINE");
    } else {
      log("DEBUG", "Unknown LWT status", lwtData);
    }
  } catch (error) {
    log("WARNING", "Could not parse LWT message as JSON", messageStr);
  }
}

function parseEraValue(valueStr) {
  log("DEBUG", `Parsing E-RA value: "${valueStr}"`);

  try {
    // Strategy 1: Try parsing as JSON first
    const jsonData = JSON.parse(valueStr);
    if (typeof jsonData === "object" && jsonData !== null) {
      // Extract value from object (E-RA format: {"key": value})
      const keys = Object.keys(jsonData);
      if (keys.length === 1) {
        const value = jsonData[keys[0]];
        const parsed = parseNumericValue(value);
        if (parsed !== null) {
          log("DEBUG", `JSON parsing successful: ${parsed}`);
          return parsed;
        }
      }

      // Try common field names
      const commonValue =
        jsonData.value ?? jsonData.current_value ?? jsonData.data;
      if (commonValue !== undefined) {
        const parsed = parseNumericValue(commonValue);
        if (parsed !== null) {
          log("DEBUG", `JSON field parsing successful: ${parsed}`);
          return parsed;
        }
      }
    } else if (typeof jsonData === "number") {
      log("DEBUG", `Direct JSON number: ${jsonData}`);
      return jsonData;
    }
  } catch (error) {
    // Not JSON, try as plain text
    log("DEBUG", "Not valid JSON, trying plain text parsing");
  }

  // Strategy 2: Parse as plain numeric value
  const parsed = parseNumericValue(valueStr);
  if (parsed !== null) {
    log("DEBUG", `Plain text parsing successful: ${parsed}`);
    return parsed;
  }

  log("WARNING", `All parsing strategies failed for: "${valueStr}"`);
  return null;
}

function parseNumericValue(value) {
  if (typeof value === "number" && !isNaN(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  // Remove common prefixes and suffixes
  let cleanValue = value.trim();

  // Handle "+" prefix (E-RA specific)
  if (cleanValue.startsWith("+")) {
    cleanValue = cleanValue.substring(1);
    log("DEBUG", `Removed "+" prefix: ${cleanValue}`);
  }

  // Handle comma decimal separator (European format)
  if (cleanValue.includes(",") && !cleanValue.includes(".")) {
    cleanValue = cleanValue.replace(",", ".");
    log("DEBUG", `Replaced comma with dot: ${cleanValue}`);
  }

  // Direct parse attempt
  const directParse = parseFloat(cleanValue);
  if (!isNaN(directParse)) {
    return directParse;
  }

  // Extract first numeric value using regex
  const numericMatch = cleanValue.match(/[-+]?\d*\.?\d+/);
  if (numericMatch) {
    const extracted = parseFloat(numericMatch[0]);
    if (!isNaN(extracted)) {
      log("DEBUG", `Regex extraction successful: ${extracted}`);
      return extracted;
    }
  }

  return null;
}

function displayDataSummary() {
  log("INFO", `${colors.bright}=== CURRENT SENSOR DATA ===${colors.reset}`);
  log("INFO", `Temperature: ${receivedData.temperature ?? "N/A"}°C`);
  log("INFO", `Humidity: ${receivedData.humidity ?? "N/A"}%`);
  log("INFO", `PM2.5: ${receivedData.pm25 ?? "N/A"} μg/m³`);
  log("INFO", `PM10: ${receivedData.pm10 ?? "N/A"} μg/m³`);

  const validReadings = Object.values(receivedData).filter(
    (v) => v !== null
  ).length;
  log(
    "INFO",
    `Data completeness: ${validReadings}/4 sensors (${Math.round(
      (validReadings / 4) * 100
    )}%)`
  );
  log("INFO", `${colors.bright}===============================${colors.reset}`);
}

// Error handling
client.on("error", (error) => {
  clearTimeout(connectionTimer);
  log("ERROR", "MQTT Connection error", error.message);

  // Common error troubleshooting
  if (error.message.includes("ENOTFOUND")) {
    log("ERROR", "DNS resolution failed - check network connection");
  } else if (error.message.includes("ECONNREFUSED")) {
    log("ERROR", "Connection refused - check broker address and port");
  } else if (error.message.includes("Not authorized")) {
    log("ERROR", "Authentication failed - check gateway token");
  }

  client.end();
  process.exit(1);
});

client.on("close", () => {
  log("INFO", "MQTT connection closed");
  displayFinalSummary();
});

client.on("disconnect", () => {
  log("WARNING", "Disconnected from MQTT broker");
});

client.on("reconnect", () => {
  log("INFO", "Attempting to reconnect...");
});

function displayFinalSummary() {
  log("INFO", "");
  log("INFO", `${colors.bright}=== TEST SUMMARY ===${colors.reset}`);
  log("INFO", `Total messages received: ${messageCount}`);
  log("INFO", `Gateway Token: ${gatewayToken.substring(0, 15)}...`);

  Object.entries(sensorConfigs).forEach(([sensor, configId]) => {
    const value = receivedData[sensor];
    const status =
      value !== null
        ? `${colors.green}✓ ${value}${colors.reset}`
        : `${colors.red}✗ No data${colors.reset}`;
    log("INFO", `${sensor.toUpperCase()} (ID: ${configId}): ${status}`);
  });

  const validReadings = Object.values(receivedData).filter(
    (v) => v !== null
  ).length;
  if (validReadings === 4) {
    log("SUCCESS", "All sensors are working correctly!");
  } else if (validReadings > 0) {
    log("WARNING", `${validReadings}/4 sensors are providing data`);
  } else {
    log(
      "ERROR",
      "No sensor data received - check E-RA gateway and sensor connections"
    );
  }
  log("INFO", `${colors.bright}===================${colors.reset}`);
}

// Graceful shutdown
process.on("SIGINT", () => {
  log("INFO", "\nShutting down gracefully...");
  client.end();
  process.exit(0);
});

// Keep process alive and show periodic status
let statusInterval = setInterval(() => {
  if (messageCount === 0) {
    log(
      "INFO",
      `Still waiting for messages... (${Math.floor(
        (Date.now() - client.connected) / 1000
      )}s connected)`
    );
  }
}, 30000); // Every 30 seconds

// Auto-exit after 5 minutes if no messages received
setTimeout(() => {
  if (messageCount === 0) {
    log("WARNING", "No messages received after 5 minutes - stopping test");
    log("WARNING", "This might indicate:");
    log("WARNING", "1. Gateway is offline or not publishing data");
    log("WARNING", "2. Sensor config IDs are incorrect");
    log("WARNING", "3. Gateway token authentication failed");
    client.end();
    process.exit(0);
  }
}, 300000); // 5 minutes
