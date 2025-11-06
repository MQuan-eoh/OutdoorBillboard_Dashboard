/**
 * Test Specific Config ID
 * Kiểm tra xem config ID 145634 có hoạt động không
 */

const fs = require("fs");
const path = require("path");
const mqtt = require("mqtt");

// Load config
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const gatewayToken = config.eraIot.gatewayToken;
const targetConfigId = 145634; // Config ID bạn muốn test

console.log("🔍 TESTING SPECIFIC CONFIG ID");
console.log("==============================");
console.log(`Gateway Token: ${gatewayToken}`);
console.log(`Target Config ID: ${targetConfigId}`);
console.log(`Expected Topic: eoh/chip/${gatewayToken}/config/${targetConfigId}/value`);

const client = mqtt.connect("mqtt://mqtt1.eoh.io:1883", {
  username: gatewayToken,
  password: gatewayToken,
  clientId: `config_test_${Date.now()}`,
  keepalive: 60,
  connectTimeout: 15000,
});

let messageReceived = false;

client.on("connect", () => {
  console.log("✅ Connected to E-RA MQTT broker");
  
  // Subscribe to specific config ID
  const topic = `eoh/chip/${gatewayToken}/config/${targetConfigId}/value`;
  
  client.subscribe(topic, { qos: 1 }, (err) => {
    if (err) {
      console.error("❌ Subscription failed:", err);
      process.exit(1);
    } else {
      console.log(`✅ Subscribed to: ${topic}`);
      console.log("⏳ Waiting for messages from config ID 145634...");
      console.log("   (Wait 30 seconds to see if this config ID sends data)");
    }
  });
});

client.on("message", (topic, message) => {
  messageReceived = true;
  console.log(`📨 [${new Date().toLocaleTimeString()}] Message received!`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Message: ${message.toString()}`);
  
  try {
    const data = JSON.parse(message.toString());
    console.log(`   Parsed data:`, data);
  } catch (e) {
    console.log(`   Raw message: ${message.toString()}`);
  }
});

client.on("error", (error) => {
  console.error("❌ MQTT Error:", error);
});

// Subscribe to all config topics to see what's available
setTimeout(() => {
  const allTopic = `eoh/chip/${gatewayToken}/config/+/value`;
  console.log(`\n🔍 Also subscribing to all configs: ${allTopic}`);
  
  client.subscribe(allTopic, { qos: 1 }, (err) => {
    if (!err) {
      console.log("✅ Subscribed to all config topics");
      console.log("   This will show all active config IDs for comparison");
    }
  });
}, 2000);

// Timeout after 30 seconds
setTimeout(() => {
  console.log("\n📊 TEST RESULTS:");
  console.log("================");
  
  if (messageReceived) {
    console.log("✅ Config ID 145634 is ACTIVE and sending data");
  } else {
    console.log("❌ Config ID 145634 is NOT sending data or doesn't exist");
    console.log("💡 Check E-Ra platform to verify:");
    console.log("   1. Config ID 145634 exists");
    console.log("   2. Config ID 145634 is configured properly");
    console.log("   3. Sensor is connected and working");
  }
  
  client.end();
  process.exit(0);
}, 30000);