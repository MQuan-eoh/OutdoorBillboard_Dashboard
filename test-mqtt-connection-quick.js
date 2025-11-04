#!/usr/bin/env node
/**
 * Quick MQTT Connection Test for Billboard OTA Update Issue
 *
 * This script tests the MQTT connection to HiveMQ broker
 * to diagnose the OTA update command issue
 */

const mqtt = require("mqtt");

console.log("=== MQTT Connection Test for Billboard OTA ===");
console.log("Testing connection to HiveMQ broker...\n");

// Test the same broker used by the billboard app
const brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
const clientId = `test_billboard_${Date.now()}`;

console.log(`Connecting to: ${brokerUrl}`);
console.log(`Client ID: ${clientId}`);

const client = mqtt.connect(brokerUrl, {
  clean: true,
  connectTimeout: 15000,
  clientId: clientId,
  keepalive: 60,
});

// Set connection timeout
const connectionTimeout = setTimeout(() => {
  console.log("❌ Connection timeout (15 seconds)");
  process.exit(1);
}, 15000);

client.on("connect", () => {
  clearTimeout(connectionTimeout);
  console.log("✅ Connected to MQTT broker successfully!");

  // Test subscribing to the command topic
  const commandTopic = "its/billboard/commands";
  console.log(`\nSubscribing to topic: ${commandTopic}`);

  client.subscribe(commandTopic, { qos: 1 }, (err) => {
    if (err) {
      console.log("❌ Subscription failed:", err.message);
      client.end();
      process.exit(1);
    } else {
      console.log("✅ Subscription successful!");

      // Test publishing a command (similar to admin-web)
      console.log("\nTesting OTA update command...");

      const testCommand = {
        action: "force_update",
        version: "1.0.0-test",
        targetVersion: "1.0.0-test",
        messageId: `test_${Date.now()}`,
        timestamp: Date.now(),
        source: "test_script",
        deviceTarget: "all",
      };

      client.publish(
        commandTopic,
        JSON.stringify(testCommand),
        { qos: 1 },
        (err) => {
          if (err) {
            console.log("❌ Publish failed:", err.message);
          } else {
            console.log("✅ Test command published successfully!");
            console.log(
              "Command payload:",
              JSON.stringify(testCommand, null, 2)
            );
          }

          // Clean up and exit
          setTimeout(() => {
            console.log("\n=== Test completed ===");
            client.end();
            process.exit(0);
          }, 2000);
        }
      );
    }
  });
});

client.on("message", (topic, message) => {
  console.log(`📥 Received message on ${topic}:`, message.toString());
});

client.on("error", (error) => {
  clearTimeout(connectionTimeout);
  console.log("❌ MQTT error:", error.message);
  process.exit(1);
});

client.on("close", () => {
  console.log("🔌 Connection closed");
});

// Handle script interruption
process.on("SIGINT", () => {
  console.log("\n⚠️ Test interrupted by user");
  if (client) {
    client.end();
  }
  process.exit(0);
});
