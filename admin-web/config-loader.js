/**
 * Config Loader - Unified Configuration Access
 * Bridges Global Script Loading with ES6 Modules
 *
 * Usage:
 * - In global context: window.ConfigLoader.github
 * - In modules: import { ConfigLoader } from './config-loader.js'
 */

class ConfigLoader {
  constructor() {
    // Load all configs here
    this.github = {
      repository: {
        owner: "MinhQuan7",
        repo: "ITS_OurdoorBillboard-",
        branch: "main",
        uploadPath: "logos/",
      },
      api: {
        endpoint: "https://api.github.com",
        cdnEndpoint:
          "https://mquan-eoh.github.io/ITS_OurdoorBillboard-/logos-cdn",
      },
      alternatives: [
        {
          owner: "MQuan-eoh",
          repo: "ITS_OurdoorBillboard-",
          branch: "main",
          uploadPath: "logos/",
        },
      ],
      autoDetectRepo: true,
      createRepoIfNotFound: true,
      enableGitHubPages: true,
      pagesSource: "main",

      getCurrentRepoUrl() {
        return `https://github.com/${this.repository.owner}/${this.repository.repo}`;
      },

      getManifestUrl() {
        return `${this.api.cdnEndpoint}/manifest.json`;
      },

      getRepoApiUrl() {
        return `${this.api.endpoint}/repos/${this.repository.owner}/${this.repository.repo}`;
      },

      switchToAlternative(index = 0) {
        if (this.alternatives[index]) {
          this.repository = { ...this.alternatives[index] };
          this.api.cdnEndpoint = `https://${this.repository.owner}.github.io/${this.repository.repo}`;
          console.log(
            "[ConfigLoader] Switched to alternative repository:",
            this.repository
          );
          return true;
        }
        return false;
      },

      validate() {
        const required = ["owner", "repo", "branch", "uploadPath"];
        for (const field of required) {
          if (!this.repository[field]) {
            throw new Error(`[ConfigLoader] Missing required field: ${field}`);
          }
        }
        return true;
      },
    };

    this.mqtt = {
      broker: "mqtt://localhost:1883",
      topics: {
        commands: "its/billboard/commands",
        status: "its/billboard/status",
        updates: "its/billboard/updates",
        reset: "its/billboard/reset",
      },
    };

    console.log("[ConfigLoader] Configuration loaded");
  }

  /**
   * Get GitHub config
   */
  getGitHubConfig() {
    return this.github;
  }

  /**
   * Get MQTT config
   */
  getMqttConfig() {
    return this.mqtt;
  }

  /**
   * Validate all configs
   */
  validateAll() {
    try {
      this.github.validate();
      console.log("[ConfigLoader] All configurations validated successfully");
      return true;
    } catch (error) {
      console.error("[ConfigLoader] Configuration validation failed:", error);
      return false;
    }
  }
}

// Global instance
window.ConfigLoader = new ConfigLoader();

// Backward compatibility: Also expose as window.GitHubConfig
window.GitHubConfig = window.ConfigLoader.github;

// Export for ES6 modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ConfigLoader: window.ConfigLoader };
}
