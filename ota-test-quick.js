/**
 * Quick OTA Test Script - End-to-End Validation
 * Tests basic OTA functionality without full deployment
 * Usage: node ota-test-quick.js
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

class QuickOTATest {
  constructor() {
    this.packageVersion = null;
    this.testResults = [];
  }

  async runTests() {
    console.log("🧪 Quick OTA Update Test - Starting...\n");

    try {
      await this.loadPackageInfo();
      await this.testVersionConsistency();
      await this.testGitHubRelease();
      await this.testFileStructure();
      await this.testConfiguration();

      this.printResults();
    } catch (error) {
      console.error("❌ Test failed:", error.message);
    }
  }

  async loadPackageInfo() {
    const packagePath = path.join(__dirname, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    this.packageVersion = packageJson.version;
    console.log(`📦 Loaded package.json - Version: ${this.packageVersion}`);
  }

  async testVersionConsistency() {
    console.log("🔍 Testing version consistency...");

    try {
      // Check latest.yml
      const latestYmlPath = path.join(__dirname, "latest.yml");
      if (fs.existsSync(latestYmlPath)) {
        const yamlContent = fs.readFileSync(latestYmlPath, "utf8");
        const versionMatch = yamlContent.match(/version:\s*(.+)/);
        const urlMatch = yamlContent.match(/url:\s*(.+)/);
        const pathMatch = yamlContent.match(/path:\s*(.+)/);

        if (versionMatch) {
          const yamlVersion = versionMatch[1].trim();
          if (yamlVersion === this.packageVersion) {
            this.addResult(
              "✅",
              "Version Consistency",
              "package.json and latest.yml versions match"
            );
          } else {
            this.addResult(
              "❌",
              "Version Consistency",
              `Mismatch: package.json=${this.packageVersion}, latest.yml=${yamlVersion}`
            );
          }
        }

        // Check URL pattern
        if (urlMatch) {
          const expectedUrl = `https://github.com/MQuan-eoh/OutdoorBillboard_Dashboard/releases/download/v${this.packageVersion}/ITS-Billboard-Setup-${this.packageVersion}.exe`;
          const actualUrl = urlMatch[1].trim();
          if (actualUrl === expectedUrl) {
            this.addResult(
              "✅",
              "URL Pattern",
              "latest.yml URL matches expected pattern"
            );
          } else {
            this.addResult(
              "❌",
              "URL Pattern",
              `Expected: ${expectedUrl}\nActual: ${actualUrl}`
            );
          }
        }

        // Check filename pattern
        if (pathMatch) {
          const expectedPath = `ITS-Billboard-Setup-${this.packageVersion}.exe`;
          const actualPath = pathMatch[1].trim();
          if (actualPath === expectedPath) {
            this.addResult(
              "✅",
              "Filename Pattern",
              "latest.yml path matches expected pattern"
            );
          } else {
            this.addResult(
              "❌",
              "Filename Pattern",
              `Expected: ${expectedPath}, Actual: ${actualPath}`
            );
          }
        }
      } else {
        this.addResult("⚠️", "latest.yml", "File not found");
      }
    } catch (error) {
      this.addResult("❌", "Version Consistency", error.message);
    }
  }

  async testGitHubRelease() {
    console.log("🐙 Testing GitHub release...");

    try {
      const releaseExists = await this.checkGitHubRelease(this.packageVersion);
      if (releaseExists) {
        this.addResult(
          "✅",
          "GitHub Release",
          `v${this.packageVersion} exists`
        );

        // Check for assets
        const assetExists = await this.checkGitHubAsset(this.packageVersion);
        if (assetExists) {
          this.addResult("✅", "Release Asset", `Setup file exists in release`);
        } else {
          this.addResult(
            "❌",
            "Release Asset",
            `Setup file missing in release`
          );
        }
      } else {
        this.addResult(
          "⚠️",
          "GitHub Release",
          `v${this.packageVersion} not found (may need to create)`
        );
      }
    } catch (error) {
      this.addResult("❌", "GitHub Release", error.message);
    }
  }

  checkGitHubRelease(version) {
    return new Promise((resolve, reject) => {
      const url = `https://api.github.com/repos/MQuan-eoh/OutdoorBillboard_Dashboard/releases/tags/v${version}`;

      const request = https.get(
        url,
        {
          headers: { "User-Agent": "OTA-Quick-Test" },
          timeout: 5000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200) {
              resolve(true);
            } else if (res.statusCode === 404) {
              resolve(false);
            } else {
              reject(new Error(`GitHub API returned ${res.statusCode}`));
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
      const url = `https://api.github.com/repos/MQuan-eoh/OutdoorBillboard_Dashboard/releases/tags/v${version}`;
      const expectedAssetName = `ITS-Billboard-Setup-${version}.exe`;

      const request = https.get(
        url,
        {
          headers: { "User-Agent": "OTA-Quick-Test" },
          timeout: 5000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              if (res.statusCode === 200) {
                const release = JSON.parse(data);
                const hasAsset =
                  release.assets &&
                  release.assets.some(
                    (asset) =>
                      asset.name === expectedAssetName ||
                      asset.name.includes("ITS-Billboard-Setup")
                  );
                resolve(hasAsset);
              } else {
                resolve(false);
              }
            } catch (parseError) {
              reject(parseError);
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

  testFileStructure() {
    console.log("📁 Testing file structure...");

    const requiredFiles = [
      { path: "main.js", description: "Main Electron process" },
      { path: "package.json", description: "Package configuration" },
      {
        path: "admin-web/update-service.js",
        description: "Admin update service",
      },
      { path: "admin-web/mqtt-client.js", description: "MQTT client" },
      { path: "admin-web/app.js", description: "Admin web app" },
    ];

    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(__dirname, file.path));
      if (exists) {
        this.addResult("✅", "File Structure", `${file.path} exists`);
      } else {
        this.addResult("❌", "File Structure", `${file.path} missing`);
      }
    }
  }

  testConfiguration() {
    console.log("⚙️ Testing configuration...");

    try {
      // Check package.json build config
      const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
      const buildConfig = packageJson.build;

      if (buildConfig) {
        // Check NSIS config
        if (buildConfig.nsis && buildConfig.nsis.artifactName) {
          const artifactName = buildConfig.nsis.artifactName;
          if (artifactName === "ITS-Billboard-Setup-${version}.exe") {
            this.addResult(
              "✅",
              "NSIS Config",
              "Artifact name template correct"
            );
          } else {
            this.addResult(
              "❌",
              "NSIS Config",
              `Unexpected artifact name: ${artifactName}`
            );
          }
        }

        // Check publish config
        if (buildConfig.publish) {
          const publish = buildConfig.publish;
          if (
            publish.provider === "github" &&
            publish.owner === "MQuan-eoh" &&
            publish.repo === "OutdoorBillboard_Dashboard"
          ) {
            this.addResult(
              "✅",
              "Publish Config",
              "GitHub publishing configured correctly"
            );
          } else {
            this.addResult(
              "❌",
              "Publish Config",
              "GitHub publish config incorrect"
            );
          }
        }
      }

      // Check if built files would have correct names
      const expectedSetupName = `ITS-Billboard-Setup-${this.packageVersion}.exe`;
      this.addResult(
        "ℹ️",
        "Expected Build",
        `Should create: ${expectedSetupName}`
      );
    } catch (error) {
      this.addResult("❌", "Configuration", error.message);
    }
  }

  addResult(status, category, message) {
    this.testResults.push({ status, category, message });
  }

  printResults() {
    console.log("\n📊 QUICK OTA TEST RESULTS");
    console.log("=".repeat(40));

    const categories = [...new Set(this.testResults.map((r) => r.category))];

    for (const category of categories) {
      console.log(`\n${category}:`);
      const categoryResults = this.testResults.filter(
        (r) => r.category === category
      );
      for (const result of categoryResults) {
        console.log(`  ${result.status} ${result.message}`);
      }
    }

    // Summary
    const passed = this.testResults.filter((r) => r.status === "✅").length;
    const failed = this.testResults.filter((r) => r.status === "❌").length;
    const warnings = this.testResults.filter((r) => r.status === "⚠️").length;

    console.log("\n📈 SUMMARY:");
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);

    if (failed === 0) {
      if (warnings === 0) {
        console.log("\n🎉 All tests passed! OTA update system looks good.");
      } else {
        console.log(
          "\n⚠️ Tests passed with warnings. Review warnings before deploying."
        );
      }
    } else {
      console.log(
        "\n❌ Some tests failed. Fix issues before using OTA updates."
      );
    }

    console.log("\n💡 Next Steps:");
    console.log("1. Fix any failed tests");
    console.log("2. Run full build: npm run build:nsis");
    console.log("3. Create GitHub release with built artifacts");
    console.log("4. Test OTA update from admin-web");
  }
}

// Run tests
async function main() {
  const tester = new QuickOTATest();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = QuickOTATest;
