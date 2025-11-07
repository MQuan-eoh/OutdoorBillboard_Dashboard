/**
 * Test Fix Verification
 * Kiểm tra xem fix gatewayToken có hoạt động không
 *
 * TRƯỚC KHI FIX:
 * - eraIotService extract token từ authToken
 * - mqttService ghi đè gatewayToken bằng extracted token
 * - Authentication FAIL -> Desktop app hiển thị N/A
 *
 * SAU KHI FIX:
 * - eraIotService sử dụng gatewayToken từ config.json
 * - mqttService giữ nguyên gatewayToken từ config.json
 * - Authentication SUCCESS -> Desktop app hiển thị data
 */

const fs = require("fs");
const path = require("path");
const mqtt = require("mqtt");

// Load config
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const gatewayToken = config.eraIot.gatewayToken;
const authToken = config.eraIot.authToken;

console.log("🔧 TESTING FIX VERIFICATION");
console.log("==========================");
console.log(`Original AuthToken: ${authToken}`);
console.log(`Config GatewayToken: ${gatewayToken}`);
console.log("");
console.log("🧪 TESTING AUTHENTICATION:");
console.log("===========================");

// Test with config gatewayToken (NEW way - fixed)
function testGatewayToken() {
  return new Promise((resolve) => {
    console.log("Testing FIXED approach (gatewayToken from config)...");

    const client = mqtt.connect("mqtt://mqtt1.eoh.io:1883", {
      username: gatewayToken,
      password: gatewayToken,
      clientId: `fix_test_${Date.now()}`,
      connectTimeout: 10000,
    });

    let resolved = false;

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log("❌ TIMEOUT: Gateway token test failed");
        client.end();
        resolve(false);
      }
    }, 15000);

    client.on("connect", () => {
      if (!resolved) {
        resolved = true;
        console.log("✅ SUCCESS: Gateway token authentication works!");

        // Test subscription
        const topic = `eoh/chip/${gatewayToken}/config/+/value`;
        client.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.log("❌ Subscription failed:", err.message);
          } else {
            console.log(`✅ Subscribed successfully to: ${topic}`);
          }
          client.end();
          resolve(true);
        });
      }
    });

    client.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        console.log(
          "❌ FAILED: Gateway token authentication failed:",
          error.message
        );
        client.end();
        resolve(false);
      }
    });
  });
}

// Test with extracted token (OLD way - should fail)
function testExtractedToken() {
  return new Promise((resolve) => {
    console.log("Testing OLD approach (extracted token from authToken)...");

    if (!extractedToken) {
      console.log("❌ SKIP: Could not extract token");
      resolve(false);
      return;
    }

    const client = mqtt.connect("mqtt://mqtt1.eoh.io:1883", {
      username: extractedToken,
      password: extractedToken,
      clientId: `old_test_${Date.now()}`,
      connectTimeout: 10000,
    });

    let resolved = false;

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log("❌ TIMEOUT: Extracted token test failed");
        client.end();
        resolve(false);
      }
    }, 15000);

    client.on("connect", () => {
      if (!resolved) {
        resolved = true;
        console.log("⚠️  UNEXPECTED: Extracted token worked (but should fail)");
        client.end();
        resolve(true);
      }
    });

    client.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        console.log(
          "✅ EXPECTED: Extracted token failed as expected:",
          error.message
        );
        client.end();
        resolve(false);
      }
    });
  });
}

async function runTest() {
  console.log("1️⃣ Testing FIXED approach...");
  const gatewayResult = await testGatewayToken();

  console.log("");
  console.log("2️⃣ Testing OLD approach...");
  const extractedResult = await testExtractedToken();

  console.log("");
  console.log("📋 RESULTS SUMMARY:");
  console.log("===================");
  console.log(
    `✅ Fixed Approach (gatewayToken): ${gatewayResult ? "SUCCESS" : "FAILED"}`
  );
  console.log(
    `❌ Old Approach (extracted): ${
      extractedResult ? "UNEXPECTED SUCCESS" : "FAILED AS EXPECTED"
    }`
  );

  if (gatewayResult && !extractedResult) {
    console.log("");
    console.log("🎉 FIX VERIFICATION SUCCESSFUL!");
    console.log("The desktop app should now work correctly.");
    console.log(
      "Expected behavior: IoT sensors should show real values instead of N/A"
    );
  } else {
    console.log("");
    console.log("⚠️  FIX VERIFICATION INCONCLUSIVE");
    console.log("Please check the implementation again.");
  }

  process.exit(0);
}

runTest();
