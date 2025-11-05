#!/usr/bin/env node

/**
 * GitHub Actions Workflow Validator & System Test
 * Validates YAML syntax, URL configurations, and deployment readiness
 */

const fs = require("fs");
const path = require("path");

class WorkflowValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.issues = [];
    this.baseUrl = "https://mquan-eoh.github.io/ITS_OurdoorBillboard-";
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);

    if (type === "error") this.errors.push(message);
    if (type === "warning") this.warnings.push(message);
    if (type === "issue") this.issues.push(message);
  }

  validateWorkflowSyntax() {
    this.log("info", "🔍 Validating GitHub Actions workflow syntax...");

    const workflowPath = ".github/workflows/deploy-pages.yml";
    if (!fs.existsSync(workflowPath)) {
      this.log("error", `Workflow file not found: ${workflowPath}`);
      return false;
    }

    const content = fs.readFileSync(workflowPath, "utf8");

    // Check for common YAML issues
    const issues = [
      {
        pattern: /`/g,
        message: "Backticks found - may cause YAML syntax errors",
      },
      {
        pattern: /\$\{[^}]+\}/g,
        message:
          "Template literals found - should use proper string concatenation",
      },
      {
        pattern: /concurrency:/g,
        message:
          "Concurrency configuration found - good for preventing conflicts",
      },
    ];

    let hasIssues = false;
    issues.forEach((issue) => {
      const matches = content.match(issue.pattern);
      if (matches && issue.pattern.source.includes("`")) {
        this.log(
          "error",
          `YAML Syntax Issue: ${issue.message} (${matches.length} occurrences)`
        );
        hasIssues = true;
      } else if (matches) {
        this.log("info", `✅ ${issue.message}`);
      }
    });

    if (!hasIssues) {
      this.log("info", "✅ No YAML syntax issues detected");
    }

    return !hasIssues;
  }

  validateUrlConsistency() {
    this.log("info", "🔗 Validating URL consistency across codebase...");

    const configFiles = [
      "config.json",
      "admin-web/config.js",
      "admin-web/config-loader.js",
      "admin-web/config/github.js",
      "renderer/App.tsx",
      "renderer/logo-manifest-debugger.js",
      "resources/app-update.yml",
    ];

    const expectedUrls = [
      "https://mquan-eoh.github.io/ITS_OurdoorBillboard-/logos-cdn/manifest.json",
      "https://mquan-eoh.github.io/ITS_OurdoorBillboard-/logos-cdn",
      "https://mquan-eoh.github.io/ITS_OurdoorBillboard-/admin",
      "MinhQuan7/ITS_OurdoorBillboard-",
    ];

    let inconsistencies = 0;

    configFiles.forEach((file) => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, "utf8");

        // Check for old URLs
        const oldPatterns = [
          "billboard-logos-cdn",
          "MQuan-eoh/billboard-logos-cdn",
          "mquan-eoh.github.io/billboard-logos-cdn",
        ];

        oldPatterns.forEach((pattern) => {
          if (content.includes(pattern)) {
            this.log("error", `Old URL pattern found in ${file}: ${pattern}`);
            inconsistencies++;
          }
        });

        // Check for new URLs
        const hasNewUrl = expectedUrls.some((url) => content.includes(url));
        if (hasNewUrl) {
          this.log("info", `✅ ${file} - Updated URLs found`);
        } else if (!content.includes("ITS_OurdoorBillboard-")) {
          this.log("warning", `${file} - No new repository URLs found`);
        }
      } else {
        this.log("warning", `Config file not found: ${file}`);
      }
    });

    if (inconsistencies === 0) {
      this.log("info", "✅ All URLs appear to be consistent");
    }

    return inconsistencies === 0;
  }

  validateBuildConfiguration() {
    this.log("info", "🏗️ Validating build configuration...");

    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

    // Check version
    if (packageJson.version !== "1.0.3") {
      this.log(
        "error",
        `Package version should be 1.0.3, found: ${packageJson.version}`
      );
    } else {
      this.log("info", "✅ Package version is correct: 1.0.3");
    }

    // Check build config
    if (packageJson.build && packageJson.build.publish) {
      const publish = packageJson.build.publish;
      if (publish.repo === "ITS_OurdoorBillboard-") {
        this.log("info", "✅ Build configuration points to correct repository");
      } else {
        this.log(
          "error",
          `Build repo should be ITS_OurdoorBillboard-, found: ${publish.repo}`
        );
      }
    }

    return true;
  }

  checkWorkflowDuplicates() {
    this.log("info", "🔄 Checking for workflow duplicates...");

    const workflowDir = ".github/workflows";
    const files = fs.readdirSync(workflowDir);

    const duplicates = [
      "deploy-manifest.yml",
      "deploy-admin-web.yml",
      "jekyll-gh-pages.yml",
    ];

    let foundDuplicates = 0;
    duplicates.forEach((file) => {
      if (files.includes(file)) {
        this.log(
          "error",
          `Duplicate workflow found: ${file} (should be removed)`
        );
        foundDuplicates++;
      }
    });

    if (foundDuplicates === 0) {
      this.log("info", "✅ No duplicate workflows found");
    }

    // Check for unified workflow
    if (files.includes("deploy-pages.yml")) {
      this.log(
        "info",
        "✅ Unified deployment workflow (deploy-pages.yml) exists"
      );
    } else {
      this.log(
        "error",
        "Unified deployment workflow (deploy-pages.yml) not found"
      );
    }

    return foundDuplicates === 0;
  }

  generateReport() {
    this.log("info", "\n📊 VALIDATION REPORT");
    this.log("info", "==================");

    console.log(`\n✅ Successful checks: ${this.getSuccessCount()}`);

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors (${this.errors.length}):`);
      this.errors.forEach((error, i) => console.log(`   ${i + 1}. ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${this.warnings.length}):`);
      this.warnings.forEach((warning, i) =>
        console.log(`   ${i + 1}. ${warning}`)
      );
    }

    const isValid = this.errors.length === 0;

    console.log(`\n🎯 OVERALL STATUS: ${isValid ? "✅ PASSED" : "❌ FAILED"}`);

    if (isValid) {
      console.log("\n🚀 Ready for deployment!");
      console.log("Expected endpoints after deployment:");
      console.log(`   - Main site: ${this.baseUrl}/`);
      console.log(`   - Admin panel: ${this.baseUrl}/admin/`);
      console.log(`   - Logos CDN: ${this.baseUrl}/logos-cdn/`);
      console.log(`   - Manifest API: ${this.baseUrl}/logos-cdn/manifest.json`);
    } else {
      console.log("\n🔧 Please fix the errors above before deploying.");
    }

    return isValid;
  }

  getSuccessCount() {
    // Estimate successful checks based on log messages
    return this.getAllLogs().filter((msg) => msg.includes("✅")).length;
  }

  getAllLogs() {
    return [...this.errors, ...this.warnings, ...this.issues];
  }

  async run() {
    console.log("🚀 ITS Billboard System - GitHub Actions Fix Validator");
    console.log("=".repeat(60));

    const checks = [
      () => this.validateWorkflowSyntax(),
      () => this.checkWorkflowDuplicates(),
      () => this.validateUrlConsistency(),
      () => this.validateBuildConfiguration(),
    ];

    for (const check of checks) {
      try {
        await check();
      } catch (error) {
        this.log("error", `Validation failed: ${error.message}`);
      }
    }

    return this.generateReport();
  }
}

// Run validation
if (require.main === module) {
  const validator = new WorkflowValidator();
  validator
    .run()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Validation failed:", error);
      process.exit(1);
    });
}

module.exports = WorkflowValidator;
