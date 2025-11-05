/**
 * GitHub Upload Service - Global Wrapper
 * Bridges ES6 GitHubService with Global Context
 *
 * This wraps the modular GitHubService class and exposes it globally
 * for use in HTML event handlers and legacy code
 */

class GitHubUploadService {
  constructor() {
    // Use unified configuration
    this.configManager = window.GitHubConfigManager;
    this.config = this.configManager
      ? this.configManager.exportLegacyConfig()
      : this.getDefaultConfig();

    this.token = null;
    this.isAuthenticated = false;
    this.authenticatedUser = null;
    this.listeners = {};

    console.log("[GitHubUploadService] Initialized with unified config:", {
      owner: this.config.repository.owner,
      repo: this.config.repository.repo,
    });
  }

  /**
   * Get default configuration fallback
   */
  getDefaultConfig() {
    return {
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
    };
  }

  /**
   * Update configuration from unified manager
   */
  updateConfig() {
    if (this.configManager) {
      this.config = this.configManager.exportLegacyConfig();
      console.log(
        "[GitHubUploadService] Configuration updated:",
        this.config.repository
      );
    }
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Emit event
   */
  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  /**
   * Initialize with GitHub token
   */
  async initialize(token) {
    try {
      this.token = token;
      const authTest = await this.testAuthentication();

      if (authTest) {
        this.isAuthenticated = true;
        console.log("[GitHubUploadService] Authentication successful");
        this._emit("authenticated", { user: this.authenticatedUser });
        return true;
      }

      console.error("[GitHubUploadService] Authentication failed");
      return false;
    } catch (error) {
      console.error("[GitHubUploadService] Initialization failed:", error);
      this._emit("error", { message: error.message });
      return false;
    }
  }

  /**
   * Test GitHub authentication with enhanced error handling
   */
  async testAuthentication() {
    if (!this.token) return false;

    try {
      console.log("[GitHubUploadService] Testing authentication...");
      const response = await this.makeApiRequest(
        `${this.config.api.endpoint}/user`
      );

      if (response.ok) {
        const userData = await response.json();
        this.authenticatedUser = userData;
        console.log(
          "[GitHubUploadService] Authenticated user:",
          userData.login
        );

        console.log("[GitHubUploadService] Testing repository access...");
        const repoAccess = await this.testRepositoryAccess();

        if (repoAccess.success) {
          console.log("[GitHubUploadService] Repository access confirmed");
          return true;
        } else {
          console.log(
            "[GitHubUploadService] Repository access denied, trying alternatives..."
          );
          return await this.handleRepositoryFallback();
        }
      }

      return false;
    } catch (error) {
      console.error("[GitHubUploadService] Auth test failed:", error);
      return false;
    }
  }

  /**
   * Make API request with retry mechanism
   */
  async makeApiRequest(url, options = {}, retries = 3) {
    const defaultOptions = {
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(
          `[GitHubUploadService] API request attempt ${attempt}/${retries}: ${url}`
        );

        const response = await fetch(url, defaultOptions);

        if (response.ok) {
          return response;
        }

        // Handle specific HTTP errors
        if (response.status === 401) {
          throw new Error("Authentication failed - Invalid token");
        }

        if (response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.message?.includes("rate limit")) {
            console.log(
              "[GitHubUploadService] Rate limited, waiting before retry..."
            );
            await this.delay(5000 * attempt);
            continue;
          }
          throw new Error("Access denied - Check token permissions");
        }

        if (response.status === 404) {
          throw new Error("Repository or resource not found");
        }

        if (attempt === retries) {
          throw new Error(
            `Request failed: ${response.status} ${response.statusText}`
          );
        }

        console.log(
          `[GitHubUploadService] Request failed, retrying in ${
            2000 * attempt
          }ms...`
        );
        await this.delay(2000 * attempt);
      } catch (error) {
        if (
          attempt === retries ||
          error.message.includes("Authentication failed")
        ) {
          throw error;
        }

        console.log(
          `[GitHubUploadService] Request error, retrying: ${error.message}`
        );
        await this.delay(2000 * attempt);
      }
    }
  }

  /**
   * Delay helper
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Test repository access
   */
  async testRepositoryAccess() {
    try {
      const repoResponse = await fetch(
        `${this.config.api.endpoint}/repos/${this.config.repository.owner}/${this.config.repository.repo}`,
        {
          headers: {
            Authorization: `token ${this.token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (repoResponse.ok) {
        return { success: true, status: repoResponse.status };
      } else {
        const errorData = await repoResponse.json().catch(() => ({}));
        return {
          success: false,
          status: repoResponse.status,
          error: errorData.message || repoResponse.statusText,
        };
      }
    } catch (error) {
      console.error(
        "[GitHubUploadService] Repository access test failed:",
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle repository fallback
   */
  async handleRepositoryFallback() {
    if (
      this.authenticatedUser &&
      this.authenticatedUser.login !== this.config.repository.owner
    ) {
      console.log(
        `[GitHubUploadService] Trying user's own repository: ${this.authenticatedUser.login}/${this.config.repository.repo}`
      );

      const originalOwner = this.config.repository.owner;
      this.config.repository.owner = this.authenticatedUser.login;

      const userRepoAccess = await this.testRepositoryAccess();

      if (userRepoAccess.success) {
        console.log("[GitHubUploadService] Using user repository");
        this.config.api.cdnEndpoint = `https://${this.authenticatedUser.login}.github.io/${this.config.repository.repo}`;
        return true;
      } else if (userRepoAccess.status === 404) {
        console.log("[GitHubUploadService] Attempting to create repository...");
        const createSuccess = await this.createRepository();
        if (createSuccess) return true;
      }

      this.config.repository.owner = originalOwner;
    }

    throw new Error(
      `Cannot access repository ${this.config.repository.owner}/${this.config.repository.repo}. ` +
        `Token for user '${this.authenticatedUser?.login}' does not have write access.`
    );
  }

  /**
   * Create repository
   */
  async createRepository() {
    try {
      const createRepoResponse = await fetch(
        `${this.config.api.endpoint}/user/repos`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${this.token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: this.config.repository.repo,
            description: "Billboard logos CDN repository",
            auto_init: true,
            public: true,
          }),
        }
      );

      if (createRepoResponse.ok) {
        console.log("[GitHubUploadService] Repository created successfully");
        await this.enableGitHubPages();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      }

      const createError = await createRepoResponse.json().catch(() => ({}));
      console.error(
        "[GitHubUploadService] Repository creation failed:",
        createError
      );
      return false;
    } catch (error) {
      console.error("[GitHubUploadService] Error creating repository:", error);
      return false;
    }
  }

  /**
   * Enable GitHub Pages
   */
  async enableGitHubPages() {
    try {
      const pagesResponse = await fetch(
        `${this.config.api.endpoint}/repos/${this.config.repository.owner}/${this.config.repository.repo}/pages`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${this.token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: {
              branch: this.config.repository.branch,
            },
          }),
        }
      );

      if (pagesResponse.ok) {
        console.log("[GitHubUploadService] GitHub Pages enabled");
        return true;
      }

      console.warn("[GitHubUploadService] Could not enable GitHub Pages");
      return false;
    } catch (error) {
      console.error(
        "[GitHubUploadService] Error enabling GitHub Pages:",
        error
      );
      return false;
    }
  }

  /**
   * Upload logo file with enhanced URL generation
   */
  async uploadLogo(file, metadata = {}) {
    if (!this.isAuthenticated) {
      throw new Error("GitHub service not authenticated");
    }

    try {
      console.log(`[GitHubUploadService] Uploading ${file.name}...`);

      const base64Content = await this.fileToBase64(file);
      const filename =
        metadata.filename || this.generateUniqueFilename(file.name);
      const filePath = this.config.repository.uploadPath + filename;

      // Use unified config manager for URL generation if available
      const uploadUrl = this.configManager
        ? this.configManager.getUploadUrl(filename)
        : `${this.config.api.endpoint}/repos/${this.config.repository.owner}/${this.config.repository.repo}/contents/${filePath}`;

      console.log("[GitHubUploadService] Upload URL:", uploadUrl);

      const existingFile = await this.getFileInfo(filePath);

      const commitData = {
        message: existingFile
          ? `Update logo: ${filename}`
          : `Upload logo: ${filename}`,
        content: base64Content,
        branch: this.config.repository.branch,
      };

      if (existingFile) {
        commitData.sha = existingFile.sha;
      }

      const uploadResponse = await this.makeApiRequest(uploadUrl, {
        method: "PUT",
        body: JSON.stringify(commitData),
      });

      const uploadResult = await uploadResponse.json();
      console.log(`[GitHubUploadService] File uploaded: ${filename}`);

      // Generate CDN URL using unified config manager
      const logoUrl = this.configManager
        ? this.configManager.getFileUrl(filename)
        : uploadResult.content.download_url;

      const logoMetadata = {
        id: this.generateLogoId(filename),
        name: metadata.name || file.name.replace(/\.[^/.]+$/, ""),
        url: logoUrl,
        filename: filename,
        size: file.size,
        type: file.type,
        priority: metadata.priority || 1,
        active: metadata.active !== false,
        uploadedAt: new Date().toISOString(),
        githubPath: filePath,
        githubSha: uploadResult.content.sha,
      };

      this._emit("logoUploaded", logoMetadata);
      return logoMetadata;
    } catch (error) {
      console.error("[GitHubUploadService] Upload failed:", error);
      this._emit("error", { message: error.message });
      throw error;
    }
  }

  /**
   * Upload logo batch
   */
  async uploadLogoBatch(files, onProgress = null) {
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        if (onProgress) {
          onProgress(i, files.length, `Uploading ${file.name}...`);
        }

        const result = await this.uploadLogo(file);
        results.push(result);

        console.log(
          `[GitHubUploadService] Batch upload ${i + 1}/${
            files.length
          } completed`
        );
      } catch (error) {
        console.error(
          `[GitHubUploadService] Batch upload ${i + 1} failed:`,
          error
        );
        errors.push({ file: file.name, error: error.message });
      }
    }

    if (onProgress) {
      onProgress(files.length, files.length, "Upload batch completed");
    }

    return { results, errors };
  }

  /**
   * Get current manifest
   */
  async getCurrentManifest() {
    try {
      const manifestPath = "manifest.json";
      const fileInfo = await this.getFileInfo(manifestPath);

      if (fileInfo) {
        const content = atob(fileInfo.content);
        const manifest = JSON.parse(content);
        return this.validateAndFixManifest(manifest);
      }

      return this.createDefaultManifest();
    } catch (error) {
      console.warn(
        "[GitHubUploadService] Could not load manifest, using default:",
        error
      );
      return this.createDefaultManifest();
    }
  }

  /**
   * Validate and fix manifest
   */
  validateAndFixManifest(manifest) {
    const fixedManifest = { ...manifest };

    if (!fixedManifest.version) {
      fixedManifest.version = `1.0.${Date.now()}`;
    }
    if (!fixedManifest.lastUpdated) {
      fixedManifest.lastUpdated = new Date().toISOString();
    }
    if (!fixedManifest.logos || !Array.isArray(fixedManifest.logos)) {
      fixedManifest.logos = [];
    }
    if (!fixedManifest.settings) {
      fixedManifest.settings = {
        logoMode: "loop",
        logoLoopDuration: 30,
        schedules: [],
      };
    }
    if (!fixedManifest.metadata) {
      fixedManifest.metadata = {
        author: "Admin Web Interface",
        description: "Billboard logo manifest",
        apiVersion: "v1",
      };
    }

    return fixedManifest;
  }

  /**
   * Create default manifest
   */
  createDefaultManifest() {
    return {
      version: `1.0.${Date.now()}`,
      lastUpdated: new Date().toISOString(),
      logos: [],
      settings: {
        logoMode: "loop",
        logoLoopDuration: 30,
        schedules: [],
      },
      metadata: {
        author: "Admin Web Interface",
        description: "Billboard logo manifest",
        apiVersion: "v1",
      },
    };
  }

  /**
   * Add logo to manifest
   */
  addLogoToManifest(manifest, logoMetadata) {
    const updatedManifest = { ...manifest };

    if (!updatedManifest.logos) {
      updatedManifest.logos = [];
    }

    updatedManifest.logos = updatedManifest.logos.filter(
      (logo) => logo.id !== logoMetadata.id
    );

    updatedManifest.logos.push(logoMetadata);
    updatedManifest.logos.sort((a, b) => a.priority - b.priority);

    updatedManifest.version = `1.0.${Date.now()}`;
    updatedManifest.lastUpdated = new Date().toISOString();

    if (!updatedManifest.metadata) {
      updatedManifest.metadata = {
        author: "Admin Web Interface",
        description: "Billboard logo manifest",
        apiVersion: "v1",
      };
    }
    updatedManifest.metadata.lastModifiedBy = "Admin Web Interface";

    return updatedManifest;
  }

  /**
   * Upload manifest
   */
  async uploadManifest(manifest) {
    const manifestPath = "manifest.json";
    const content = JSON.stringify(manifest, null, 2);
    const base64Content = btoa(content);

    const existingFile = await this.getFileInfo(manifestPath);

    const commitData = {
      message: `Update manifest: ${manifest.version}`,
      content: base64Content,
      branch: this.config.repository.branch,
    };

    if (existingFile) {
      commitData.sha = existingFile.sha;
    }

    const response = await fetch(
      `${this.config.api.endpoint}/repos/${this.config.repository.owner}/${this.config.repository.repo}/contents/${manifestPath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commitData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Manifest upload failed: ${errorData.message}`);
    }

    return await response.json();
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath) {
    try {
      const response = await fetch(
        `${this.config.api.endpoint}/repos/${this.config.repository.owner}/${this.config.repository.repo}/contents/${filePath}?ref=${this.config.repository.branch}`,
        {
          headers: {
            Authorization: `token ${this.token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (response.ok) {
        return await response.json();
      } else if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }
    } catch (error) {
      console.error("[GitHubUploadService] Error getting file info:", error);
      return null;
    }
  }

  /**
   * File to base64
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Generate unique filename
   */
  generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const ext = originalName.split(".").pop();
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const cleanName = nameWithoutExt
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();
    return `${cleanName}-${timestamp}.${ext}`;
  }

  /**
   * Generate logo ID
   */
  generateLogoId(filename) {
    return filename
      .toLowerCase()
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Trigger workflow
   */
  async triggerWorkflow() {
    try {
      console.log("[GitHubUploadService] Triggering deployment workflow...");

      const workflowNames = [
        "jekyll-gh-pages.yml",
        "deploy-manifest.yml",
        "pages-build-deployment",
      ];

      for (const workflowName of workflowNames) {
        const response = await fetch(
          `${this.config.api.endpoint}/repos/${this.config.repository.owner}/${this.config.repository.repo}/actions/workflows/${workflowName}/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `token ${this.token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ref: this.config.repository.branch,
              inputs: { force_rebuild: "true" },
            }),
          }
        );

        if (response.ok) {
          console.log(`[GitHubUploadService] Workflow triggered`);
          return true;
        }
      }

      console.warn(
        "[GitHubUploadService] No workflow found, GitHub Pages will auto-deploy"
      );
      return false;
    } catch (error) {
      console.error("[GitHubUploadService] Error triggering workflow:", error);
      return false;
    }
  }

  /**
   * Complete upload workflow
   */
  async completeUploadWorkflow(files, settings = {}, options = {}) {
    try {
      console.log(
        `[GitHubUploadService] Starting complete upload workflow for ${files.length} files...`
      );

      const { results, errors } = await this.uploadLogoBatch(
        files,
        options.onProgress
      );

      if (results.length === 0) {
        throw new Error("No files uploaded successfully");
      }

      let currentManifest = await this.getCurrentManifest();
      currentManifest.logos = [];

      if (!currentManifest.settings) {
        currentManifest.settings = {
          logoMode: "loop",
          logoLoopDuration: 30,
          schedules: [],
        };
      }

      if (settings.logoMode) {
        currentManifest.settings.logoMode = settings.logoMode;
      }
      if (settings.logoLoopDuration) {
        currentManifest.settings.logoLoopDuration = settings.logoLoopDuration;
      }

      for (const logoMetadata of results) {
        currentManifest = this.addLogoToManifest(currentManifest, logoMetadata);
      }

      await this.uploadManifest(currentManifest);
      await this.triggerWorkflow();

      console.log("[GitHubUploadService] Complete upload workflow finished");

      return {
        success: true,
        uploaded: results.length,
        failed: errors.length,
        errors: errors,
        manifest: currentManifest,
      };
    } catch (error) {
      console.error(
        "[GitHubUploadService] Complete upload workflow failed:",
        error
      );
      this._emit("error", { message: error.message });
      throw error;
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      authenticated: this.isAuthenticated,
      repository: `${this.config.repository.owner}/${this.config.repository.repo}`,
      branch: this.config.repository.branch,
      uploadPath: this.config.repository.uploadPath,
    };
  }
}

// Create global instance
window.GitHubUploadService = new GitHubUploadService();

// Global functions for backward compatibility
window.initializeGitHubService = async function (token) {
  return await window.GitHubUploadService.initialize(token);
};

window.uploadLogosToGitHub = async function (files, settings = {}, onProgress) {
  return await window.GitHubUploadService.completeUploadWorkflow(
    files,
    settings,
    { onProgress }
  );
};

window.getGitHubServiceStatus = function () {
  return window.GitHubUploadService.getStatus();
};
