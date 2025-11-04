/**
 * Unified GitHub Configuration Manager
 * Handles all GitHub-related configurations with environment detection
 * Replaces inconsistent configuration across multiple files
 */

export class GitHubConfigManager {
  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    console.log("[GitHubConfig] Unified configuration loaded:", this.config);
  }

  /**
   * Load configuration with environment detection
   */
  loadConfiguration() {
    const baseConfig = {
      // Primary repository (default)
      primary: {
        owner: "MQuan-eoh",
        repo: "billboard-logos-cdn",
        branch: "main",
        uploadPath: "logos/",
      },

      // Fallback repositories
      fallbacks: [
        {
          owner: "MinhQuan7",
          repo: "billboard-logos-cdn",
          branch: "main",
          uploadPath: "logos/",
        },
      ],

      // API endpoints
      api: {
        endpoint: "https://api.github.com",
        version: "v3",
      },

      // File constraints
      files: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif"],
        compressionQuality: 0.8,
      },

      // Upload settings
      upload: {
        retryAttempts: 3,
        retryDelay: 2000,
        timeoutMs: 30000,
        batchSize: 5,
      },

      // Environment-specific overrides
      environments: {
        development: {
          api: {
            endpoint: "https://api.github.com",
          },
        },
        production: {
          api: {
            endpoint: "https://api.github.com",
          },
        },
      },
    };

    // Apply environment-specific overrides
    const environment = this.detectEnvironment();
    if (baseConfig.environments[environment]) {
      this.mergeConfiguration(baseConfig, baseConfig.environments[environment]);
    }

    // Set current active repository (will be determined at runtime)
    baseConfig.active = { ...baseConfig.primary };

    return baseConfig;
  }

  /**
   * Detect current environment
   */
  detectEnvironment() {
    const hostname = window.location.hostname;

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.includes("192.168")
    ) {
      return "development";
    }

    return "production";
  }

  /**
   * Merge configuration objects
   */
  mergeConfiguration(target, source) {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {};
        this.mergeConfiguration(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    const required = {
      "primary.owner": this.config.primary?.owner,
      "primary.repo": this.config.primary?.repo,
      "primary.branch": this.config.primary?.branch,
      "primary.uploadPath": this.config.primary?.uploadPath,
      "api.endpoint": this.config.api?.endpoint,
    };

    for (const [path, value] of Object.entries(required)) {
      if (!value) {
        throw new Error(
          `[GitHubConfig] Missing required configuration: ${path}`
        );
      }
    }

    console.log("[GitHubConfig] Configuration validation passed");
  }

  /**
   * Switch to a specific repository configuration
   */
  switchRepository(repoConfig) {
    if (!repoConfig.owner || !repoConfig.repo) {
      throw new Error("[GitHubConfig] Invalid repository configuration");
    }

    this.config.active = {
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      branch: repoConfig.branch || "main",
      uploadPath: repoConfig.uploadPath || "logos/",
    };

    console.log("[GitHubConfig] Switched to repository:", this.config.active);
    return true;
  }

  /**
   * Switch to fallback repository
   */
  switchToFallback(index = 0) {
    if (this.config.fallbacks[index]) {
      return this.switchRepository(this.config.fallbacks[index]);
    }

    console.error("[GitHubConfig] No fallback repository at index:", index);
    return false;
  }

  /**
   * Switch to user's own repository
   */
  switchToUserRepository(userLogin) {
    if (!userLogin) {
      throw new Error("[GitHubConfig] User login required");
    }

    const userRepo = {
      owner: userLogin,
      repo: this.config.primary.repo,
      branch: this.config.primary.branch,
      uploadPath: this.config.primary.uploadPath,
    };

    return this.switchRepository(userRepo);
  }

  /**
   * Get current repository URL
   */
  getRepositoryUrl() {
    return `https://github.com/${this.config.active.owner}/${this.config.active.repo}`;
  }

  /**
   * Get repository API URL
   */
  getApiUrl() {
    return `${this.config.api.endpoint}/repos/${this.config.active.owner}/${this.config.active.repo}`;
  }

  /**
   * Get CDN endpoint URL
   */
  getCdnUrl() {
    return `https://${this.config.active.owner}.github.io/${this.config.active.repo}`;
  }

  /**
   * Get manifest URL
   */
  getManifestUrl() {
    return `${this.getCdnUrl()}/manifest.json`;
  }

  /**
   * Get file upload URL
   */
  getUploadUrl(filename) {
    const filePath = this.config.active.uploadPath + filename;
    return `${this.getApiUrl()}/contents/${filePath}`;
  }

  /**
   * Get file CDN URL
   */
  getFileUrl(filename) {
    return `${this.getCdnUrl()}/${this.config.active.uploadPath}${filename}`;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      ...this.config,
      // Computed URLs
      urls: {
        repository: this.getRepositoryUrl(),
        api: this.getApiUrl(),
        cdn: this.getCdnUrl(),
        manifest: this.getManifestUrl(),
      },
    };
  }

  /**
   * Export configuration for backward compatibility
   */
  exportLegacyConfig() {
    return {
      // For github-upload-service.js compatibility
      repository: {
        owner: this.config.active.owner,
        repo: this.config.active.repo,
        branch: this.config.active.branch,
        uploadPath: this.config.active.uploadPath,
      },
      api: {
        endpoint: this.config.api.endpoint,
        cdnEndpoint: this.getCdnUrl(),
      },

      // For services/github.js compatibility
      owner: this.config.active.owner,
      repo: this.config.active.repo,
      branch: this.config.active.branch,
      apiEndpoint: this.config.api.endpoint,
      uploadPath: this.config.active.uploadPath,
      cdnEndpoint: this.getCdnUrl(),

      // For config.js compatibility
      github: {
        enabled: true,
        owner: this.config.active.owner,
        repo: this.config.active.repo,
        branch: this.config.active.branch,
        apiEndpoint: this.config.api.endpoint,
        cdnEndpoint: this.getCdnUrl(),
        uploadPath: this.config.active.uploadPath,
        maxFileSize: this.config.files.maxSize,
      },
    };
  }

  /**
   * Reset to primary repository
   */
  resetToPrimary() {
    this.config.active = { ...this.config.primary };
    console.log("[GitHubConfig] Reset to primary repository");
    return true;
  }

  /**
   * Get repository status info
   */
  getRepositoryInfo() {
    return {
      current: `${this.config.active.owner}/${this.config.active.repo}`,
      branch: this.config.active.branch,
      uploadPath: this.config.active.uploadPath,
      cdnUrl: this.getCdnUrl(),
      isPrimary: this.config.active.owner === this.config.primary.owner,
      environment: this.detectEnvironment(),
    };
  }
}

// Create global instance
window.GitHubConfigManager = new GitHubConfigManager();

// Backward compatibility - expose unified config through existing interfaces
window.GitHubConfig = window.GitHubConfigManager.exportLegacyConfig();
window.ConfigLoader = {
  getGitHubConfig: () => window.GitHubConfigManager.exportLegacyConfig(),
  github: window.GitHubConfigManager.exportLegacyConfig(),
};

console.log("[GitHubConfig] Unified configuration manager loaded and ready");
