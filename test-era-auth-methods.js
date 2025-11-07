/**
 * E-RA MQTT Test với AuthToken
 * Test MQTT connection sử dụng authToken thay vì gatewayToken
 *
 * Dựa trên config.json:
 * - authToken: "Token a159b7047b33aebfdb2e83f614c5049e5d760d6d"
 * - gatewayToken: "1fb0dddf-8fd1-43f2-a229-32afeec4b0bf"
 *
 * Test cả hai phương thức authentication:
 * 1. authToken (từ E-RA platform)
 * 2. gatewayToken (extracted từ authToken)
 */

const fs = require("fs");
const path = require("path");

// Colors for better output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
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

const authToken = config.eraIot.authToken;
const gatewayToken = config.eraIot.gatewayToken;
const sensorConfigs = config.eraIot.sensorConfigs;

log("INFO", "E-RA Authentication Test");
log("INFO", "========================");
log(
  "INFO",
  `AuthToken: ${authToken ? authToken.substring(0, 20) + "..." : "MISSING"}`
);
log(
  "INFO",
  `GatewayToken: ${
    gatewayToken ? gatewayToken.substring(0, 15) + "..." : "MISSING"
  }`
);




log("INFO", "Token Analysis:");
log("INFO", `Original AuthToken: ${authToken}`);
log("INFO", `Config GatewayToken: ${gatewayToken}`);


// Check MQTT library
let mqtt = null;
try {
  mqtt = require("mqtt");
  log("SUCCESS", "MQTT.js library is available");
} catch (error) {
  log("ERROR", "MQTT.js library not found");
  process.exit(0);
}

// Test both authentication methods
async function testAuthentication(username, password, label) {
  return new Promise((resolve) => {
    log("INFO", `Testing ${label} authentication...`);
    log("DEBUG", `Username: ${username.substring(0, 15)}...`);
    log("DEBUG", `Password: ${password.substring(0, 15)}...`);

    const client = mqtt.connect("mqtt://mqtt1.eoh.io:1883", {
      username: username,
      password: password,
      clientId: `test_${label.toLowerCase()}_${Date.now()}`,
      keepalive: 60,
      connectTimeout: 10000,
      clean: true,
    });

    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        log("ERROR", `${label}: Connection timeout`);
        client.end();
        resolve({ success: false, error: "Timeout" });
      }
    }, 15000);

    client.on("connect", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        log("SUCCESS", `${label}: Connected successfully!`);

        // Subscribe to test topic
        const testTopic = `eoh/chip/${username}/config/+/value`;
        client.subscribe(testTopic, { qos: 1 }, (err) => {
          if (err) {
            log("ERROR", `${label}: Subscribe failed`, err.message);
          } else {
            log("SUCCESS", `${label}: Subscribed to ${testTopic}`);
          }

          setTimeout(() => {
            client.end();
            resolve({ success: true });
          }, 2000);
        });
      }
    });

    client.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        log("ERROR", `${label}: Connection error`, error.message);
        client.end();
        resolve({ success: false, error: error.message });
      }
    });
  });
}

// Run tests
async function runTests() {
  log("INFO", "");
  log("INFO", "Starting authentication tests...");
  log("INFO", "");

  // Test 1: Extracted token (như eraIotService.ts)
  if (extractedToken) {
    const result1 = await testAuthentication(
      extractedToken,
      extractedToken,
      "EXTRACTED_TOKEN"
    );
    log("INFO", "");
  }

  // Test 2: Config gatewayToken
  if (gatewayToken) {
    const result2 = await testAuthentication(
      gatewayToken,
      gatewayToken,
      "CONFIG_GATEWAY_TOKEN"
    );
    log("INFO", "");
  }

  // Test 3: Full authToken as username
  if (authToken) {
    const result3 = await testAuthentication(
      authToken,
      authToken,
      "FULL_AUTH_TOKEN"
    );
    log("INFO", "");
  }

  // Test 4: Username từ authToken, password = gatewayToken
  if (extractedToken && gatewayToken) {
    const result4 = await testAuthentication(
      extractedToken,
      gatewayToken,
      "MIXED_TOKENS"
    );
    log("INFO", "");
  }

  log("INFO", `${colors.bright}=== TEST SUMMARY ===${colors.reset}`);
  log(
    "INFO",
    "If authentication is successful but no data is received, check:"
  );
  log("INFO", "1. E-RA Gateway is online and publishing data");
  log("INFO", "2. Sensor Config IDs are correct");
  log("INFO", "3. Sensors are properly connected to gateway");
  log("INFO", "4. Topic subscription patterns match E-RA format");
  log("INFO", "");

  // Show expected topics for debugging
  log("INFO", "Expected MQTT Topics:");
  Object.entries(sensorConfigs).forEach(([sensor, configId]) => {
    if (configId) {
      // Use the working token (extractedToken or gatewayToken)
      const workingToken = extractedToken || gatewayToken;
      if (workingToken) {
        const topic = `eoh/chip/${workingToken}/config/${configId}/value`;
        log("INFO", `${sensor.toUpperCase()}: ${topic}`);
      }
    }
  });

  process.exit(0);
}

runTests();
