/**
 * Fix Validation Script
 * Kiểm tra và validate bug fixes cho HTTP 404 và connection errors
 */

const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

class FixValidationService {
  constructor() {
    this.manifestUrls = [
      "https://mquan-eoh.github.io/ITS_OurdoorBillboard-/logos-cdn/manifest.json",
      "https://mquan-eoh.github.io/billboard-logos-cdn/manifest.json", // Old URL for comparison
    ];
    this.configFiles = [
      "./config.json",
      "./admin-web/config.js",
      "./admin-web/services/github-config.js",
    ];
  }

  /**
   * Test manifest URLs accessibility
   */
  async testManifestUrls() {
    console.log("🔍 Testing manifest URLs...\n");

    for (const url of this.manifestUrls) {
      try {
        console.log(`Testing: ${url}`);
        const response = await axios.get(url, { timeout: 10000 });

        if (response.status === 200) {
          const manifest = response.data;
          console.log(`✅ SUCCESS - Status: ${response.status}`);
          console.log(`   Version: ${manifest.version || "Unknown"}`);
          console.log(`   Logos: ${manifest.logos?.length || 0}`);
          console.log(
            `   Last Updated: ${manifest.lastUpdated || "Unknown"}\n`
          );
        } else {
          console.log(`⚠️  Warning - Status: ${response.status}\n`);
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`❌ ERROR 404 - Manifest not found`);
          console.log(`   URL: ${url}`);
          console.log(`   This should be the old URL or misconfigured URL\n`);
        } else {
          console.log(`❌ ERROR - ${error.message}`);
          console.log(`   URL: ${url}\n`);
        }
      }
    }
  }

  /**
   * Validate config file consistency
   */
  async validateConfigFiles() {
    console.log("📋 Validating config files...\n");

    const configData = {};

    for (const configFile of this.configFiles) {
      try {
        const fullPath = path.resolve(configFile);
        const exists = await fs
          .access(fullPath)
          .then(() => true)
          .catch(() => false);

        if (!exists) {
          console.log(`⚠️  File not found: ${configFile}`);
          continue;
        }

        const content = await fs.readFile(fullPath, "utf-8");
        configData[configFile] = content;

        // Check for manifest URL patterns
        const manifestUrlMatches =
          content.match(/https:\/\/[^"'\s]+manifest\.json/g) || [];
        const repoMatches =
          content.match(/["']repo["']:\s*["']([^"']+)["']/g) || [];

        console.log(`📁 ${configFile}:`);
        console.log(`   Manifest URLs found: ${manifestUrlMatches.length}`);
        manifestUrlMatches.forEach((url) => {
          const isCorrect = url.includes("ITS_OurdoorBillboard-");
          console.log(`   ${isCorrect ? "✅" : "❌"} ${url}`);
        });

        console.log(`   Repository configs: ${repoMatches.length}`);
        repoMatches.forEach((repo) => {
          const isCorrect = repo.includes("ITS_OurdoorBillboard-");
          console.log(`   ${isCorrect ? "✅" : "❌"} ${repo}`);
        });
        console.log();
      } catch (error) {
        console.log(`❌ Error reading ${configFile}: ${error.message}\n`);
      }
    }

    return configData;
  }

  /**
   * Test MQTT configuration
   */
  async testMqttConfig() {
    console.log("📡 Testing MQTT configuration...\n");

    try {
      // Read admin-web config
      const configPath = path.resolve("./admin-web/config.js");
      const configContent = await fs.readFile(configPath, "utf-8");

      // Extract MQTT broker URL
      const brokerMatch = configContent.match(/broker:\s*["']([^"']+)["']/);
      if (brokerMatch) {
        const brokerUrl = brokerMatch[1];
        console.log(`MQTT Broker: ${brokerUrl}`);

        // Validate URL format
        if (brokerUrl.startsWith("wss://")) {
          console.log("✅ MQTT broker URL format is correct (WSS)");
        } else {
          console.log("❌ MQTT broker URL should use WSS protocol");
        }

        // Test if broker is reachable (basic check)
        try {
          const url = new URL(brokerUrl);
          console.log(`✅ MQTT broker URL is parseable`);
          console.log(`   Host: ${url.hostname}`);
          console.log(`   Port: ${url.port || "default"}`);
        } catch (error) {
          console.log(`❌ Invalid MQTT broker URL: ${error.message}`);
        }
      } else {
        console.log("❌ MQTT broker configuration not found");
      }
    } catch (error) {
      console.log(`❌ Error testing MQTT config: ${error.message}`);
    }

    console.log();
  }

  /**
   * Generate fix report
   */
  async generateReport() {
    console.log("📊 GENERATING FIX VALIDATION REPORT\n");
    console.log("=".repeat(60));

    await this.testManifestUrls();
    console.log("=".repeat(60));

    await this.validateConfigFiles();
    console.log("=".repeat(60));

    await this.testMqttConfig();
    console.log("=".repeat(60));

    console.log("✅ Fix validation completed!");
    console.log("\n💡 RECOMMENDATIONS:");
    console.log(
      '1. All config files should use "ITS_OurdoorBillboard-" repository'
    );
    console.log("2. Manifest URL should be accessible without 404 errors");
    console.log("3. MQTT broker should use WSS protocol");
    console.log("4. Test both admin-web and desktop-app after changes");
    console.log("\n📝 If you see any ❌ errors above, please fix them first!");
  }

  /**
   * Quick fix suggestions
   */
  async suggestFixes() {
    console.log("\n🔧 QUICK FIX SUGGESTIONS:\n");

    // Check for old repository references
    const files = [
      "./admin-web/modules/logo-manager.js",
      "./admin-web/manifest-cleanup.js",
      "./admin-web/services/github-config.js",
    ];

    for (const file of files) {
      try {
        const content = await fs.readFile(path.resolve(file), "utf-8");
        if (content.includes("billboard-logos-cdn")) {
          console.log(`⚠️  ${file} still contains old repository references`);
          console.log(
            '   Run: Find & Replace "billboard-logos-cdn" → "ITS_OurdoorBillboard-"'
          );
        }
      } catch (error) {
        // File might not exist
      }
    }

    console.log("\n🎯 After applying fixes:");
    console.log("1. Restart admin-web");
    console.log("2. Restart desktop-app");
    console.log("3. Test manifest loading");
    console.log("4. Test MQTT connections");
  }
}

// Run validation
async function runValidation() {
  const validator = new FixValidationService();

  await validator.generateReport();
  await validator.suggestFixes();
}

// Execute if run directly
if (require.main === module) {
  runValidation().catch(console.error);
}

module.exports = FixValidationService;
