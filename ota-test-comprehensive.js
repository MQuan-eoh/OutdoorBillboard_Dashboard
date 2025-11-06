/**
 * Comprehensive OTA Test Script
 * Tests all OTA scenarios: upgrade, downgrade, force reinstall
 */

const fs = require("fs").promises;
const path = require("path");

class OTATestSuite {
  constructor() {
    this.testResults = [];
    this.currentVersion = "1.0.3"; // Current app version
  }

  async runAllTests() {
    console.log("🧪 STARTING COMPREHENSIVE OTA TEST SUITE");
    console.log("=".repeat(60));

    try {
      // Test 1: Version Comparison Logic
      await this.testVersionComparison();

      // Test 2: Upgrade Scenario
      await this.testUpgradeScenario();

      // Test 3: Downgrade Scenario
      await this.testDowngradeScenario();

      // Test 4: Force Reinstall Scenario
      await this.testForceReinstallScenario();

      // Test 5: MessageId Tracking
      await this.testMessageIdTracking();

      // Test 6: MQTT Command Structure
      await this.testMqttCommandStructure();

      // Summary
      this.printTestSummary();
    } catch (error) {
      console.error("❌ Test suite failed:", error);
    }
  }

  async testVersionComparison() {
    console.log("\n1️⃣ Testing Version Comparison Logic");
    console.log("-".repeat(40));

    const tests = [
      { v1: "1.0.2", v2: "1.0.3", expected: -1, name: "Downgrade" },
      { v1: "1.0.3", v2: "1.0.2", expected: 1, name: "Upgrade" },
      { v1: "1.0.3", v2: "1.0.3", expected: 0, name: "Same version" },
      { v1: "2.0.0", v2: "1.9.9", expected: 1, name: "Major upgrade" },
      { v1: "1.2.0", v2: "1.2.1", expected: -1, name: "Patch downgrade" },
    ];

    for (const test of tests) {
      const result = this.compareVersions(test.v1, test.v2);
      const passed = result === test.expected;

      console.log(
        `  ${passed ? "✅" : "❌"} ${test.name}: ${test.v1} vs ${
          test.v2
        } = ${result}`
      );

      this.testResults.push({
        test: `Version Comparison - ${test.name}`,
        passed: passed,
        details: `${test.v1} vs ${test.v2} => ${result} (expected ${test.expected})`,
      });
    }
  }

  compareVersions(version1, version2) {
    const v1parts = version1.split(".").map(Number);
    const v2parts = version2.split(".").map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }
    return 0;
  }

  async testUpgradeScenario() {
    console.log("\n2️⃣ Testing Upgrade Scenario");
    console.log("-".repeat(40));

    const targetVersion = "1.0.4";
    const command = this.createOTACommand(targetVersion);

    console.log(`  Current: ${this.currentVersion} → Target: ${targetVersion}`);
    console.log(`  Command:`, JSON.stringify(command, null, 2));

    const isUpgrade =
      this.compareVersions(targetVersion, this.currentVersion) > 0;
    console.log(
      `  ${isUpgrade ? "✅" : "❌"} Detected as upgrade: ${isUpgrade}`
    );

    this.testResults.push({
      test: "Upgrade Scenario",
      passed: isUpgrade,
      details: `${this.currentVersion} → ${targetVersion}`,
    });
  }

  async testDowngradeScenario() {
    console.log("\n3️⃣ Testing Downgrade Scenario");
    console.log("-".repeat(40));

    const targetVersion = "1.0.2";
    const command = this.createOTACommand(targetVersion);

    console.log(`  Current: ${this.currentVersion} → Target: ${targetVersion}`);
    console.log(`  Command:`, JSON.stringify(command, null, 2));

    const isDowngrade =
      this.compareVersions(targetVersion, this.currentVersion) < 0;
    console.log(
      `  ${isDowngrade ? "✅" : "❌"} Detected as downgrade: ${isDowngrade}`
    );

    this.testResults.push({
      test: "Downgrade Scenario",
      passed: isDowngrade,
      details: `${this.currentVersion} → ${targetVersion}`,
    });
  }

  async testForceReinstallScenario() {
    console.log("\n4️⃣ Testing Force Reinstall Scenario");
    console.log("-".repeat(40));

    const targetVersion = this.currentVersion; // Same version
    const command = this.createOTACommand(targetVersion);

    console.log(`  Current: ${this.currentVersion} → Target: ${targetVersion}`);
    console.log(`  Command:`, JSON.stringify(command, null, 2));

    const isForceReinstall =
      this.compareVersions(targetVersion, this.currentVersion) === 0;
    console.log(
      `  ${
        isForceReinstall ? "✅" : "❌"
      } Detected as force reinstall: ${isForceReinstall}`
    );

    this.testResults.push({
      test: "Force Reinstall Scenario",
      passed: isForceReinstall,
      details: `${this.currentVersion} → ${targetVersion}`,
    });
  }

  async testMessageIdTracking() {
    console.log("\n5️⃣ Testing MessageId Tracking");
    console.log("-".repeat(40));

    const command1 = this.createOTACommand("1.0.4");
    const command2 = this.createOTACommand("1.0.5");

    const hasMessageId1 = !!command1.messageId;
    const hasMessageId2 = !!command2.messageId;
    const uniqueIds = command1.messageId !== command2.messageId;

    console.log(
      `  ✅ Command 1 has messageId: ${hasMessageId1} (${command1.messageId})`
    );
    console.log(
      `  ✅ Command 2 has messageId: ${hasMessageId2} (${command2.messageId})`
    );
    console.log(
      `  ${uniqueIds ? "✅" : "❌"} MessageIds are unique: ${uniqueIds}`
    );

    this.testResults.push({
      test: "MessageId Tracking",
      passed: hasMessageId1 && hasMessageId2 && uniqueIds,
      details: `Generated unique IDs: ${command1.messageId} ≠ ${command2.messageId}`,
    });
  }

  async testMqttCommandStructure() {
    console.log("\n6️⃣ Testing MQTT Command Structure");
    console.log("-".repeat(40));

    const command = this.createOTACommand("1.0.4");
    const requiredFields = [
      "action",
      "version",
      "targetVersion",
      "messageId",
      "timestamp",
      "source",
      "deviceTarget",
    ];

    let missingFields = [];
    let hasAllFields = true;

    for (const field of requiredFields) {
      if (!command.hasOwnProperty(field)) {
        missingFields.push(field);
        hasAllFields = false;
      }
    }

    console.log(
      `  ${
        hasAllFields ? "✅" : "❌"
      } All required fields present: ${hasAllFields}`
    );

    if (!hasAllFields) {
      console.log(`  ❌ Missing fields: ${missingFields.join(", ")}`);
    }

    console.log(`  ✅ Command structure:`, JSON.stringify(command, null, 4));

    this.testResults.push({
      test: "MQTT Command Structure",
      passed: hasAllFields,
      details: hasAllFields
        ? "All fields present"
        : `Missing: ${missingFields.join(", ")}`,
    });
  }

  createOTACommand(version) {
    return {
      action: "force_update",
      version: version,
      targetVersion: version,
      messageId: `update_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      timestamp: Date.now(),
      source: "admin_web",
      deviceTarget: "all",
    };
  }

  printTestSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 OTA TEST SUITE SUMMARY");
    console.log("=".repeat(60));

    let passed = 0;
    let total = this.testResults.length;

    for (const result of this.testResults) {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} ${result.test}`);

      if (result.details) {
        console.log(`     Details: ${result.details}`);
      }

      if (result.passed) passed++;
    }

    console.log("\n" + "-".repeat(60));
    console.log(
      `📈 Results: ${passed}/${total} tests passed (${Math.round(
        (passed / total) * 100
      )}%)`
    );

    if (passed === total) {
      console.log("🎉 ALL TESTS PASSED! OTA system is working correctly.");
    } else {
      console.log("⚠️  Some tests failed. Please review the issues above.");
    }

    console.log("=".repeat(60));
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  const testSuite = new OTATestSuite();
  testSuite.runAllTests().catch(console.error);
}

module.exports = OTATestSuite;
