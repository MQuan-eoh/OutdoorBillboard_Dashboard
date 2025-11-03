#!/usr/bin/env node

/**
 * 🚀 FAST OTA TESTING SCRIPT
 * Kiểm tra OTA update từ admin-web tới desktop app
 *
 * Chạy: node test-ota-quick.js
 */

const mqtt = require("mqtt");
const fs = require("fs");
const path = require("path");

// ✅ CONFIG
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const COMMAND_TOPIC = "its/billboard/commands";
const ACK_TOPIC = "its/billboard/update/ack";
const TEST_VERSION = "1.0.3"; // Version để test
const TIMEOUT_SEC = 10;

console.log("╔════════════════════════════════════════════════════╗");
console.log("║           🚀 OTA QUICK TEST SCRIPT                 ║");
console.log("╚════════════════════════════════════════════════════╝");
console.log("");

let client = null;
let ackReceived = false;
let testPassed = false;

// 🎯 STEP 1: Kết nối MQTT
console.log("📡 STEP 1: Connecting to MQTT broker...");
console.log(`   Broker: ${MQTT_BROKER}`);

client = mqtt.connect(MQTT_BROKER, {
  clientId: `test_${Date.now()}`,
  reconnectPeriod: 1000,
  clean: true,
  connectTimeout: 5000,
});

client.on("connect", () => {
  console.log("✅ Connected to MQTT broker\n");

  // 🎯 STEP 2: Subscribe to ACK topic
  console.log("📡 STEP 2: Subscribing to ACK topic...");
  console.log(`   Topic: ${ACK_TOPIC}`);

  client.subscribe(ACK_TOPIC, (err) => {
    if (err) {
      console.error("❌ Failed to subscribe:", err);
      cleanup();
      return;
    }
    console.log("✅ Subscribed to ACK topic\n");

    // 🎯 STEP 3: Send force_update command
    console.log("📡 STEP 3: Sending force_update command...");
    const messageId = `test_${Date.now()}`;
    const command = {
      action: "force_update",
      version: TEST_VERSION,
      messageId: messageId,
      timestamp: Date.now(),
      source: "test_script",
      targetVersion: TEST_VERSION,
    };

    console.log(`   Topic: ${COMMAND_TOPIC}`);
    console.log(`   Payload:`, JSON.stringify(command, null, 2));

    client.publish(COMMAND_TOPIC, JSON.stringify(command), (err) => {
      if (err) {
        console.error("❌ Failed to publish:", err);
        cleanup();
        return;
      }
      console.log("✅ Command sent\n");

      // 🎯 STEP 4: Wait for ACK
      console.log(`⏳ STEP 4: Waiting for ACK (${TIMEOUT_SEC}s timeout)...`);
      let timeLeft = TIMEOUT_SEC;

      const countdownInterval = setInterval(() => {
        process.stdout.write(`\r   Waiting... ${timeLeft}s left`);
        timeLeft--;

        if (timeLeft < 0) {
          clearInterval(countdownInterval);
          console.log("\n");
          console.log("❌ TIMEOUT: No ACK received from desktop app");
          console.log("   Desktop app might be:");
          console.log("   • Not running");
          console.log("   • Not connected to MQTT");
          console.log("   • Not subscribed to command topic");
          testPassed = false;
          cleanup();
        }
      }, 1000);

      // Set cleanup timeout
      setTimeout(() => {
        if (!ackReceived) {
          clearInterval(countdownInterval);
        }
      }, TIMEOUT_SEC * 1000 + 500);
    });
  });
});

// 🎯 STEP 5: Handle ACK message
client.on("message", (topic, message) => {
  if (topic === ACK_TOPIC && !ackReceived) {
    ackReceived = true;
    console.log("\n✅ ACK RECEIVED!\n");

    try {
      const ack = JSON.parse(message.toString());
      console.log("   Device Response:");
      console.log(`   • Device ID: ${ack.deviceId}`);
      console.log(`   • Status: ${ack.status}`);
      console.log(`   • Current Version: ${ack.deviceVersion}`);
      console.log(`   • Message: ${ack.message}`);
      console.log("");

      testPassed = true;

      console.log("╔════════════════════════════════════════════════════╗");
      console.log("║           ✅ OTA TEST PASSED!                     ║");
      console.log("╚════════════════════════════════════════════════════╝");
      console.log("");
      console.log("✅ Desktop app is:");
      console.log("   • Connected to MQTT");
      console.log("   • Subscribed to command topic");
      console.log("   • Receiving and processing commands");
      console.log("   • Sending acknowledgments back");
      console.log("");
      console.log("Next: Check desktop app console for [OTA] logs");
      console.log("");

      cleanup();
    } catch (e) {
      console.error("❌ Invalid ACK format:", e.message);
      cleanup();
    }
  }
});

client.on("error", (err) => {
  console.error("❌ MQTT Connection Error:", err.message);
  cleanup();
});

client.on("disconnect", () => {
  console.log("Disconnected from MQTT");
});

// Cleanup
function cleanup() {
  if (client) {
    client.end();
  }
  process.exit(testPassed ? 0 : 1);
}

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\nTest interrupted by user");
  cleanup();
});
