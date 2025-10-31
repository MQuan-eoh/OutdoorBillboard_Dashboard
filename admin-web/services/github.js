/**
 * GitHub Service for Logo Management
 * Handles GitHub repository configuration and logo upload operations
 * Unified service merging github-config.js and github-upload-service.js
 */

import { GITHUB_CONFIG } from "../config/github.js";

export class GitHubService {
  constructor(configOverride = {}) {
    this.config = {
      owner: configOverride.owner || GITHUB_CONFIG.owner || "MQuan-eoh",
      repo: configOverride.repo || GITHUB_CONFIG.repo || "billboard-logos-cdn",
      branch: configOverride.branch || GITHUB_CONFIG.branch || "main",
      apiEndpoint: configOverride.apiEndpoint || "https://api.github.com",
      uploadPath:
        configOverride.uploadPath || GITHUB_CONFIG.uploadPath || "logos/",
      cdnEndpoint: configOverride.cdnEndpoint || GITHUB_CONFIG.cdnEndpoint,
    };

    this.token = null;
    this.isAuthenticated = false;
    this.authenticatedUser = null;

    console.log("[GitHub] Service initialized with config:", {
      owner: this.config.owner,
      repo: this.config.repo,
      branch: this.config.branch,
    });
  }

  /**
   * Initialize service with GitHub token
   */
  async initialize(token) {
    try {
      this.token = token;
      const authTest = await this.testAuthentication();

      if (authTest) {
        this.isAuthenticated = true;
        console.log("[GitHub] Authentication successful");
        console.log(
          "[GitHub] Using repository:",
          `${this.config.owner}/${this.config.repo}`
        );
        return true;
      } else {
        console.error("[GitHub] Authentication failed");
        return false;
      }
    } catch (error) {
      console.error("[GitHub] Initialization failed:", error);
      return false;
    }
  }

  /**
   * Test GitHub authentication
   */
  async testAuthentication() {
    if (!this.token) return false;

    try {
      console.log("[GitHub] Testing authentication...");
      const response = await fetch(`${this.config.apiEndpoint}/user`, {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (response.ok) {
        const userData = await response.json();
        this.authenticatedUser = userData;
        console.log("[GitHub] Authenticated user:", userData.login);

        console.log("[GitHub] Testing repository access...");
        const repoAccess = await this.testRepositoryAccess();

        if (repoAccess.success) {
          console.log("[GitHub] Repository access confirmed");
          return true;
        } else {
          console.log(
            "[GitHub] Repository access denied, trying alternatives..."
          );
          const fallbackSuccess = await this.handleRepositoryFallback();
          return fallbackSuccess;
        }
      }

      return response.ok;
    } catch (error) {
      console.error("[GitHub] Auth test failed:", error);
      return false;
    }
  }

  /**
   * Test repository access
   */
  async testRepositoryAccess() {
    try {
      const repoResponse = await fetch(
        `${this.config.apiEndpoint}/repos/${this.config.owner}/${this.config.repo}`,
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
      console.error("[GitHub] Repository access test failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle repository fallback
   */
  async handleRepositoryFallback() {
    if (
      this.authenticatedUser &&
      this.authenticatedUser.login !== this.config.owner
    ) {
      console.log(
        `[GitHub] Trying user's own repository: ${this.authenticatedUser.login}/${this.config.repo}`
      );

      const originalOwner = this.config.owner;
      this.config.owner = this.authenticatedUser.login;

      const userRepoAccess = await this.testRepositoryAccess();

      if (userRepoAccess.success) {
        console.log("[GitHub] Using user repository");
        this.config.cdnEndpoint = `https://${this.authenticatedUser.login}.github.io/${this.config.repo}`;
        return true;
      } else if (userRepoAccess.status === 404) {
        console.log("[GitHub] Attempting to create repository...");
        const createSuccess = await this.createRepository();
        if (createSuccess) return true;
      }

      this.config.owner = originalOwner;
    }

    throw new Error(
      `Cannot access repository ${this.config.owner}/${this.config.repo}. ` +
        `Token for user '${this.authenticatedUser?.login}' does not have write access.`
    );
  }

  /**
   * Create repository for authenticated user
   */
  async createRepository() {
    try {
      const createRepoResponse = await fetch(
        `${this.config.apiEndpoint}/user/repos`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${this.token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: this.config.repo,
            description: "Billboard logos CDN repository",
            auto_init: true,
            public: true,
          }),
        }
      );

      if (createRepoResponse.ok) {
        console.log("[GitHub] Repository created successfully");
        await this.enableGitHubPages();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      } else {
        const createError = await createRepoResponse.json().catch(() => ({}));
        console.error("[GitHub] Repository creation failed:", createError);
        return false;
      }
    } catch (error) {
      console.error("[GitHub] Error creating repository:", error);
      return false;
    }
  }

  /**
   * Enable GitHub Pages for repository
   */
  async enableGitHubPages() {
    try {
      const pagesResponse = await fetch(
        `${this.config.apiEndpoint}/repos/${this.config.owner}/${this.config.repo}/pages`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${this.token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: {
              branch: this.config.branch,
            },
          }),
        }
      );

      if (pagesResponse.ok) {
        console.log("[GitHub] GitHub Pages enabled");
        return true;
      } else {
        console.warn("[GitHub] Could not enable GitHub Pages");
        return false;
      }
    } catch (error) {
      console.error("[GitHub] Error enabling GitHub Pages:", error);
      return false;
    }
  }

  /**
   * Upload logo file to repository
   */
  async uploadLogo(file, metadata = {}) {
    if (!this.isAuthenticated) {
      throw new Error("GitHub service not authenticated");
    }

    try {
      console.log(`[GitHub] Uploading ${file.name}...`);

      const base64Content = await this.fileToBase64(file);
      const filename =
        metadata.filename || this.generateUniqueFilename(file.name);
      const filePath = this.config.uploadPath + filename;

      console.log("[GitHub] Generated filename:", filename);

      const existingFile = await this.getFileInfo(filePath);

      const commitData = {
        message: existingFile
          ? `Update logo: ${filename}`
          : `Upload logo: ${filename}`,
        content: base64Content,
        branch: this.config.branch,
      };

      if (existingFile) {
        commitData.sha = existingFile.sha;
      }

      const uploadUrl = `${this.config.apiEndpoint}/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commitData),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({
          message: `HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`,
        }));

        if (uploadResponse.status === 404) {
          throw new Error(
            `Repository or path not found. Check if '${this.config.owner}/${this.config.repo}' exists.`
          );
        } else if (uploadResponse.status === 401) {
          throw new Error("Authentication failed. Check your GitHub token.");
        } else if (uploadResponse.status === 403) {
          throw new Error("Access denied. Check write permissions.");
        } else {
          throw new Error(
            `Upload failed: ${errorData.message || uploadResponse.statusText}`
          );
        }
      }

      const uploadResult = await uploadResponse.json();
      console.log(`[GitHub] File uploaded: ${filename}`);

      const logoMetadata = {
        id: this.generateLogoId(filename),
        name: metadata.name || file.name.replace(/\.[^/.]+$/, ""),
        url: uploadResult.content.download_url,
        filename: filename,
        size: file.size,
        type: file.type,
        priority: metadata.priority || 1,
        active: metadata.active !== false,
        uploadedAt: new Date().toISOString(),
        githubPath: filePath,
        githubSha: uploadResult.content.sha,
      };

      return logoMetadata;
    } catch (error) {
      console.error("[GitHub] Upload failed:", error);
      throw error;
    }
  }

  /**
   * Upload multiple logos in batch
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

        console.log(`[GitHub] Batch upload ${i + 1}/${files.length} completed`);
      } catch (error) {
        console.error(`[GitHub] Batch upload ${i + 1} failed:`, error);
        errors.push({ file: file.name, error: error.message });
      }
    }

    if (onProgress) {
      onProgress(files.length, files.length, "Upload batch completed");
    }

    return { results, errors };
  }

  /**
   * Get current manifest from repository
   */
  async getCurrentManifest() {
    try {
      const manifestPath = "manifest.json";
      const fileInfo = await this.getFileInfo(manifestPath);

      if (fileInfo) {
        const content = atob(fileInfo.content);
        const manifest = JSON.parse(content);
        return this.validateAndFixManifest(manifest);
      } else {
        return this.createDefaultManifest();
      }
    } catch (error) {
      console.warn("[GitHub] Could not load manifest, using default:", error);
      return this.createDefaultManifest();
    }
  }

  /**
   * Validate and fix manifest structure
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
   * Upload manifest file
   */
  async uploadManifest(manifest) {
    const manifestPath = "manifest.json";
    const content = JSON.stringify(manifest, null, 2);
    const base64Content = btoa(content);

    const existingFile = await this.getFileInfo(manifestPath);

    const commitData = {
      message: `Update manifest: ${manifest.version}`,
      content: base64Content,
      branch: this.config.branch,
    };

    if (existingFile) {
      commitData.sha = existingFile.sha;
    }

    const response = await fetch(
      `${this.config.apiEndpoint}/repos/${this.config.owner}/${this.config.repo}/contents/${manifestPath}`,
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
   * Get file information from repository
   */
  async getFileInfo(filePath) {
    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}?ref=${this.config.branch}`,
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
      console.error("[GitHub] Error getting file info:", error);
      return null;
    }
  }

  /**
   * Convert file to base64
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
   * Trigger GitHub Actions workflow
   */
  async triggerWorkflow() {
    try {
      console.log("[GitHub] Triggering deployment workflow...");

      const workflowNames = [
        "jekyll-gh-pages.yml",
        "deploy-manifest.yml",
        "pages-build-deployment",
      ];

      for (const workflowName of workflowNames) {
        console.log(`[GitHub] Trying workflow: ${workflowName}`);

        const response = await fetch(
          `${this.config.apiEndpoint}/repos/${this.config.owner}/${this.config.repo}/actions/workflows/${workflowName}/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `token ${this.token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ref: this.config.branch,
              inputs: { force_rebuild: "true" },
            }),
          }
        );

        if (response.ok) {
          console.log(`[GitHub] Workflow '${workflowName}' triggered`);
          return true;
        }
      }

      console.warn("[GitHub] No workflow found, GitHub Pages will auto-deploy");
      return false;
    } catch (error) {
      console.error("[GitHub] Error triggering workflow:", error);
      return false;
    }
  }

  /**
   * Complete upload workflow
   */
  async completeUploadWorkflow(files, settings = {}, options = {}) {
    try {
      console.log(
        `[GitHub] Starting complete upload workflow for ${files.length} files...`
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

      console.log("[GitHub] Complete upload workflow finished");

      return {
        success: true,
        uploaded: results.length,
        failed: errors.length,
        errors: errors,
        manifest: currentManifest,
      };
    } catch (error) {
      console.error("[GitHub] Complete upload workflow failed:", error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      authenticated: this.isAuthenticated,
      repository: `${this.config.owner}/${this.config.repo}`,
      branch: this.config.branch,
      uploadPath: this.config.uploadPath,
      cdnEndpoint: this.config.cdnEndpoint,
    };
  }
}
