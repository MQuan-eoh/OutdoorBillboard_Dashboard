/**
 * OTA Test Script - Verify OTA Fix
 * Tests the fixed OTA functionality
 */

const { app, autoUpdater } = require("electron");

async function testOTAFix() {
  console.log("=== OTA Fix Verification Test ===");
  console.log(`App Version: ${app.getVersion()}`);
  console.log(`App isPackaged: ${app.isPackaged}`);

  // Test 1: Check forceDevUpdateConfig
  console.log(`forceDevUpdateConfig: ${autoUpdater.forceDevUpdateConfig}`);

  // Test 2: Check feed URL configuration
  try {
    const feedURL = autoUpdater.getFeedURL();
    console.log("Feed URL configured:", feedURL);
  } catch (error) {
    console.log("Feed URL not configured:", error.message);
  }

  // Test 3: Test GitHub API access
  try {
    const https = require("https");
    const testVersion = app.getVersion();
    const url = `https://api.github.com/repos/MinhQuan7/ITS_OurdoorBillboard-/releases/tags/v${testVersion}`;

    console.log(`Testing GitHub API: ${url}`);

    const response = await new Promise((resolve, reject) => {
      https
        .get(
          url,
          { headers: { "User-Agent": "ITS-Billboard-Test" } },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                const release = JSON.parse(data);
                resolve(release);
              } catch (e) {
                reject(e);
              }
            });
          }
        )
        .on("error", reject);
    });

    if (response.tag_name) {
      console.log(
        "✅ GitHub API accessible, release found:",
        response.tag_name
      );
    } else {
      console.log("⚠️ Release not found for version:", testVersion);
    }
  } catch (error) {
    console.log("❌ GitHub API test failed:", error.message);
  }

  // Test 4: Check app-update.yml
  const fs = require("fs");
  const path = require("path");

  let resourcePath;
  if (app.isPackaged) {
    resourcePath = process.resourcesPath;
  } else {
    resourcePath = path.join(app.getAppPath(), "resources");
  }

  const appUpdatePath = path.join(resourcePath, "app-update.yml");

  if (fs.existsSync(appUpdatePath)) {
    console.log("✅ app-update.yml exists");
    try {
      const content = fs.readFileSync(appUpdatePath, "utf8");
      console.log("app-update.yml content preview:");
      console.log(content.split("\n").slice(0, 5).join("\n"));
    } catch (error) {
      console.log("❌ Could not read app-update.yml:", error.message);
    }
  } else {
    console.log("❌ app-update.yml not found at:", appUpdatePath);
  }

  console.log("=== Test Complete ===");
}

// Run test when app is ready
if (require.main === module) {
  app.whenReady().then(testOTAFix);
} else {
  module.exports = testOTAFix;
}
