#!/usr/bin/env node
/**
 * Billboard Diagnostic Script - OTA Update Issue Analysis
 *
 * This script analyzes the current configuration and provides
 * troubleshooting steps for the OTA update functionality
 */

const fs = require("fs");
const path = require("path");

console.log("=== Billboard OTA Update Diagnostic ===\n");

// Check main configuration
const configPath = path.join(__dirname, "config.json");

console.log("1. Configuration Analysis:");
console.log(`   Config file: ${configPath}`);

if (fs.existsSync(configPath)) {
  try {
    const configData = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configData);

    console.log("   Config file exists and is valid JSON");

    // Check E-Ra IoT configuration
    if (config.eraIot) {
      console.log("   📡 E-Ra IoT Configuration:");
      console.log(`      - Enabled: ${config.eraIot.enabled}`);
      console.log(
        `      - Auth Token: ${config.eraIot.authToken ? "Present" : "Missing"}`
      );
      console.log(
        `      - Gateway Token: ${
          config.eraIot.gatewayToken ? "Present" : "Missing"
        }`
      );
      console.log(`      - Base URL: ${config.eraIot.baseUrl || "Not set"}`);
    } else {
      console.log("   ⚠️  E-Ra IoT configuration missing");
    }

    // Check logo manifest configuration
    if (config.logoManifest) {
      console.log("   🖼️  Logo Manifest Configuration:");
      console.log(`      - Enabled: ${config.logoManifest.enabled}`);
      console.log(
        `      - Manifest URL: ${config.logoManifest.manifestUrl || "Not set"}`
      );
    } else {
      console.log("   ⚠️  Logo Manifest configuration missing");
    }
  } catch (error) {
    console.log("   ❌ Error parsing config file:", error.message);
  }
} else {
  console.log("   ❌ Config file does not exist");
}

console.log("\n2. Known OTA Update Issues and Solutions:");

console.log(`
   🔧 Issue #1: MQTT Client Null Reference Error
   Problem: Main process MQTT client becomes null, causing subscription errors
   Solution: Added null safety checks in subscribeToCommandTopics()
   
   🔧 Issue #2: Command Broker Connection Timeout
   Problem: HiveMQ broker connection may timeout or fail
   Solution: Added retry logic and proper cleanup on connection errors
   
   🔧 Issue #3: Admin-Web MQTT Disconnection
   Problem: Admin-web MQTT client may disconnect during update commands
   Solution: Added connection check before sending commands and retry logic
   
   🔧 Issue #4: Update Acknowledgment Timeout
   Problem: Desktop app may not acknowledge update commands properly
   Solution: Improved acknowledgment handling with proper timeout management
`);

console.log("\n3. Diagnostic Recommendations:");

console.log(`
   📋 Step 1: Check MQTT Service Status
   - Open developer tools in admin-web
   - Check console for MQTT connection status
   - Look for "MQTT connected successfully" message
   
   📋 Step 2: Verify Desktop App MQTT Connection
   - Check main process console logs
   - Look for "Successfully connected to Command Broker!" message
   - Verify subscription to "its/billboard/commands" topic
   
   📋 Step 3: Test OTA Update Command Flow
   - Use admin-web to trigger an update
   - Monitor both admin-web and desktop app console logs
   - Check for command publish/receive confirmation
   
   📋 Step 4: Manual MQTT Test (if needed)
   - Run: node test-mqtt-connection-quick.js
   - Verify basic MQTT broker connectivity
   
   📋 Step 5: Check Auto-Updater Configuration
   - Verify GitHub repository access
   - Check release file naming: "ITS-Billboard.exe"
   - Ensure app-update.yml exists in resources/
`);

console.log("\n4. Quick Fix Commands:");

console.log(`
   🚀 Restart Billboard App:
   - Close the billboard application completely
   - Restart it to reinitialize MQTT connections
   
   🚀 Reset MQTT Configuration:
   - Clear browser cache for admin-web
   - Refresh admin-web page to reinitialize MQTT client
   
   🚀 Force Update Test:
   - Open admin-web → Settings → App Control
   - Click "Check for Updates" first
   - Then click "Force Update" if available
   
   🚀 Manual Update (if OTA fails):
   - Download latest release from GitHub
   - Close billboard app
   - Run installer manually
`);

console.log("\n=== Diagnostic Complete ===");
console.log(
  "If issues persist, check the specific error messages in console logs."
);
