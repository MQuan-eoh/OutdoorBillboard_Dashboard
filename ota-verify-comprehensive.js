/**
 * OTA Update Verification Script - Comprehensive Test
 * Tests the entire OTA update flow from admin-web to desktop app
 *
 * Usage: node ota-verify-comprehensive.js
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

class OTAVerificationTool {
  constructor() {
    this.packageJson = null;
    this.latestYml = null;
    this.buildConfig = null;
    this.results = {
      configurationChecks: [],
      githubChecks: [],
      fileChecks: [],
      overallStatus: "UNKNOWN",
    };
  }

  async runFullVerification() {
    console.log(
      "🔍 OTA Update Verification Tool - Starting Comprehensive Check\n"
    );

    try {
      // Step 1: Load and validate configurations
      await this.loadConfigurations();

      // Step 2: Verify file configurations match
      this.verifyConfigurationConsistency();

      // Step 3: Check GitHub release availability
      await this.verifyGitHubReleases();

      // Step 4: Verify local files exist
      this.verifyLocalFiles();

      // Step 5: Generate report
      this.generateReport();
    } catch (error) {
      console.error("❌ Verification failed:", error.message);
      this.results.overallStatus = "FAILED";
    }
  }

  async loadConfigurations() {
    console.log("📋 Loading configuration files...");

    try {
      // Load package.json
      const packagePath = path.join(__dirname, "package.json");
      this.packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      console.log(
        `✅ package.json loaded - Version: ${this.packageJson.version}`
      );

      // Load latest.yml
      const latestYmlPath = path.join(__dirname, "latest.yml");
      if (fs.existsSync(latestYmlPath)) {
        const yamlContent = fs.readFileSync(latestYmlPath, "utf8");
        this.latestYml = this.parseYaml(yamlContent);
        console.log(
          `✅ latest.yml loaded - Version: ${this.latestYml.version}`
        );
      } else {
        console.log("⚠️  latest.yml not found");
      }

      // Load build config from package.json
      this.buildConfig = this.packageJson.build;
      console.log("✅ Build configuration loaded\n");
    } catch (error) {
      throw new Error(`Configuration loading failed: ${error.message}`);
    }
  }

  parseYaml(content) {
    // Simple YAML parser for our use case
    const lines = content.split("\n");
    const result = {};

    for (const line of lines) {
      if (line.includes(":") && !line.trim().startsWith("#")) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();

        if (key.trim() === "version") {
          result.version = value;
        } else if (key.trim() === "url") {
          result.url = value;
        } else if (key.trim() === "path") {
          result.path = value;
        }
      }
    }

    return result;
  }

  verifyConfigurationConsistency() {
    console.log("🔧 Verifying configuration consistency...");

    const packageVersion = this.packageJson.version;
    const expectedArtifactName = `ITS-Billboard-Setup-${packageVersion}.exe`;
    const expectedReleaseUrl = `https://github.com/MQuan-eoh/OutdoorBillboard_Dashboard/releases/download/v${packageVersion}/${expectedArtifactName}`;

    // Check package.json vs latest.yml version consistency
    if (this.latestYml) {
      if (this.latestYml.version === packageVersion) {
        this.results.configurationChecks.push({
          test: "Version Consistency (package.json vs latest.yml)",
          status: "PASS",
          message: `Both use version ${packageVersion}`,
        });
      } else {
        this.results.configurationChecks.push({
          test: "Version Consistency",
          status: "FAIL",
          message: `Mismatch: package.json=${packageVersion}, latest.yml=${this.latestYml.version}`,
        });
      }

      // Check artifact naming
      if (this.latestYml.path === expectedArtifactName) {
        this.results.configurationChecks.push({
          test: "Artifact Naming",
          status: "PASS",
          message: `Correct artifact name: ${expectedArtifactName}`,
        });
      } else {
        this.results.configurationChecks.push({
          test: "Artifact Naming",
          status: "FAIL",
          message: `Expected: ${expectedArtifactName}, Found: ${this.latestYml.path}`,
        });
      }

      // Check URL consistency
      if (this.latestYml.url === expectedReleaseUrl) {
        this.results.configurationChecks.push({
          test: "Release URL",
          status: "PASS",
          message: "URL matches expected pattern",
        });
      } else {
        this.results.configurationChecks.push({
          test: "Release URL",
          status: "FAIL",
          message: `Expected: ${expectedReleaseUrl}\nFound: ${this.latestYml.url}`,
        });
      }
    }

    // Check build configuration
    const nsisConfig = this.buildConfig?.nsis;
    if (nsisConfig?.artifactName === "ITS-Billboard-Setup-${version}.exe") {
      this.results.configurationChecks.push({
        test: "Build Artifact Template",
        status: "PASS",
        message: "NSIS artifact name template is correct",
      });
    } else {
      this.results.configurationChecks.push({
        test: "Build Artifact Template",
        status: "FAIL",
        message: `NSIS artifactName: ${nsisConfig?.artifactName}`,
      });
    }

    console.log("✅ Configuration consistency check completed\n");
  }

  async verifyGitHubReleases() {
    console.log("🐙 Checking GitHub releases...");

    const packageVersion = this.packageJson.version;
    const versions = [packageVersion, "1.0.2", "1.0.1"]; // Check current and previous versions

    for (const version of versions) {
      try {
        const releaseExists = await this.checkGitHubRelease(version);

        this.results.githubChecks.push({
          test: `GitHub Release v${version}`,
          status: releaseExists ? "PASS" : "FAIL",
          message: releaseExists ? "Release exists" : "Release not found",
        });

        if (releaseExists) {
          // Check if the expected asset exists
          const assetExists = await this.checkGitHubAsset(version);
          this.results.githubChecks.push({
            test: `Asset for v${version}`,
            status: assetExists ? "PASS" : "FAIL",
            message: assetExists ? "Asset file exists" : "Asset file missing",
          });
        }
      } catch (error) {
        this.results.githubChecks.push({
          test: `GitHub Release v${version}`,
          status: "ERROR",
          message: error.message,
        });
      }
    }

    console.log("✅ GitHub releases check completed\n");
  }

  checkGitHubRelease(version) {
    return new Promise((resolve, reject) => {
      const url = `https://api.github.com/repos/MQuan-eoh/OutdoorBillboard_Dashboard/releases/tags/v${version}`;

      const request = https.get(
        url,
        {
          headers: { "User-Agent": "OTA-Verification-Tool" },
          timeout: 10000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200) {
              try {
                const release = JSON.parse(data);
                resolve(!!release.tag_name);
              } catch (parseError) {
                reject(new Error(`Parse error: ${parseError.message}`));
              }
            } else {
              resolve(false); // Release not found
            }
          });
        }
      );

      request.on("error", (error) => reject(error));
      request.on("timeout", () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  checkGitHubAsset(version) {
    return new Promise((resolve, reject) => {
      const expectedAssetName = `ITS-Billboard-Setup-${version}.exe`;
      const url = `https://api.github.com/repos/MQuan-eoh/OutdoorBillboard_Dashboard/releases/tags/v${version}`;

      const request = https.get(
        url,
        {
          headers: { "User-Agent": "OTA-Verification-Tool" },
          timeout: 10000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200) {
              try {
                const release = JSON.parse(data);
                const hasAsset =
                  release.assets &&
                  release.assets.some(
                    (asset) => asset.name === expectedAssetName
                  );
                resolve(hasAsset);
              } catch (parseError) {
                reject(new Error(`Parse error: ${parseError.message}`));
              }
            } else {
              resolve(false);
            }
          });
        }
      );

      request.on("error", (error) => reject(error));
      request.on("timeout", () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  verifyLocalFiles() {
    console.log("📁 Checking local files...");

    const filesToCheck = [
      "package.json",
      "latest.yml",
      "main.js",
      "admin-web/update-service.js",
      "admin-web/mqtt-client.js",
      "admin-web/app.js",
    ];

    for (const file of filesToCheck) {
      const filePath = path.join(__dirname, file);
      const exists = fs.existsSync(filePath);

      this.results.fileChecks.push({
        test: `File: ${file}`,
        status: exists ? "PASS" : "FAIL",
        message: exists ? "File exists" : "File missing",
      });
    }

    console.log("✅ Local files check completed\n");
  }

  generateReport() {
    console.log("📊 COMPREHENSIVE OTA VERIFICATION REPORT");
    console.log("=".repeat(50));

    // Configuration checks
    console.log("\n🔧 CONFIGURATION CHECKS:");
    this.results.configurationChecks.forEach((check) => {
      const status =
        check.status === "PASS" ? "✅" : check.status === "FAIL" ? "❌" : "⚠️";
      console.log(`${status} ${check.test}: ${check.message}`);
    });

    // GitHub checks
    console.log("\n🐙 GITHUB RELEASE CHECKS:");
    this.results.githubChecks.forEach((check) => {
      const status =
        check.status === "PASS" ? "✅" : check.status === "FAIL" ? "❌" : "⚠️";
      console.log(`${status} ${check.test}: ${check.message}`);
    });

    // File checks
    console.log("\n📁 LOCAL FILE CHECKS:");
    this.results.fileChecks.forEach((check) => {
      const status = check.status === "PASS" ? "✅" : "❌";
      console.log(`${status} ${check.test}: ${check.message}`);
    });

    // Overall status
    const allChecks = [
      ...this.results.configurationChecks,
      ...this.results.githubChecks,
      ...this.results.fileChecks,
    ];

    const failedChecks = allChecks.filter(
      (check) => check.status === "FAIL" || check.status === "ERROR"
    );
    const warningChecks = allChecks.filter((check) => check.status === "WARN");

    console.log("\n🎯 OVERALL STATUS:");
    if (failedChecks.length === 0) {
      if (warningChecks.length === 0) {
        console.log(
          "✅ ALL CHECKS PASSED - OTA Update system is properly configured"
        );
        this.results.overallStatus = "PASSED";
      } else {
        console.log(
          `⚠️  PASSED WITH WARNINGS - ${warningChecks.length} warnings found`
        );
        this.results.overallStatus = "PASSED_WITH_WARNINGS";
      }
    } else {
      console.log(`❌ FAILED - ${failedChecks.length} critical issues found`);
      this.results.overallStatus = "FAILED";
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS:");
    if (failedChecks.length > 0) {
      console.log("1. Fix all FAILED checks before deploying OTA updates");
      console.log("2. Ensure GitHub releases have the correct artifact names");
      console.log(
        "3. Verify version consistency across all configuration files"
      );
    } else {
      console.log("1. Test OTA update with a minor version bump");
      console.log("2. Monitor update logs during deployment");
      console.log("3. Have rollback strategy ready");
    }

    console.log("\n" + "=".repeat(50));

    // Save results to file
    const reportPath = path.join(__dirname, "ota-verification-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📋 Detailed report saved to: ${reportPath}`);
  }
}

// Run verification
async function main() {
  const verifier = new OTAVerificationTool();
  await verifier.runFullVerification();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = OTAVerificationTool;
