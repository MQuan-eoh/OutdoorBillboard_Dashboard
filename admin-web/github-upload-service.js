/**
 * GitHub Upload Service for Logo Management
 * Handles uploading logos from admin-web to GitHub repository
 * Integrates with GitHub CDN sync system
 */

class GitHubUploadService {
  constructor() {
    // Use configuration from github-config.js
    this.config = {
      owner: window.GitHubConfig?.repository?.owner || "MQuan-eoh",
      repo: window.GitHubConfig?.repository?.repo || "billboard-logos-cdn",
      branch: window.GitHubConfig?.repository?.branch || "main",
      apiEndpoint:
        window.GitHubConfig?.api?.endpoint || "https://api.github.com",
      uploadPath: window.GitHubConfig?.repository?.uploadPath || "logos/",
    };

    this.token = null;
    this.isAuthenticated = false;
    this.authenticatedUser = null;

    console.log("GitHubUploadService: Initialized with config:", this.config);
  }

  /**
   * Initialize service with GitHub token
   */
  async initialize(token) {
    try {
      this.token = token;

      // Test authentication and auto-correct owner if needed
      const authTest = await this.testAuthentication();
      if (authTest) {
        this.isAuthenticated = true;
        console.log("GitHubUploadService: Authentication successful");
        console.log(
          "GitHubUploadService: Using repository:",
          `${this.config.owner}/${this.config.repo}`
        );
        return true;
      } else {
        console.error("GitHubUploadService: Authentication failed");
        return false;
      }
    } catch (error) {
      console.error("GitHubUploadService: Initialization failed:", error);
      return false;
    }
  }

  /**
   * Test GitHub authentication
   */
  async testAuthentication() {
    if (!this.token) return false;

    try {
      console.log("GitHubUploadService: Testing authentication...");
      const response = await fetch(`${this.config.apiEndpoint}/user`, {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      console.log(
        "GitHubUploadService: Auth response status:",
        response.status
      );

      if (response.ok) {
        const userData = await response.json();
        this.authenticatedUser = userData;
        console.log("GitHubUploadService: Authenticated user:", userData.login);

        // Check if authenticated user can access the configured repository
        console.log("GitHubUploadService: Testing repository access...");
        const repoAccess = await this.testRepositoryAccess();

        if (repoAccess.success) {
          console.log("GitHubUploadService: Repository access confirmed");
          return true;
        } else {
          console.log(
            "GitHubUploadService: Repository access denied, trying alternatives..."
          );

          // Try alternative repositories or create new one
          const fallbackSuccess = await this.handleRepositoryFallback();
          return fallbackSuccess;
        }
      }

      return response.ok;
    } catch (error) {
      console.error("GitHubUploadService: Auth test failed:", error);
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

      console.log(
        "GitHubUploadService: Repository access status:",
        repoResponse.status
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
        "GitHubUploadService: Repository access test failed:",
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle repository fallback - try alternatives or create new
   */
  async handleRepositoryFallback() {
    // If authenticated user is different from configured owner, try user's own repo
    if (
      this.authenticatedUser &&
      this.authenticatedUser.login !== this.config.owner
    ) {
      console.log(
        `GitHubUploadService: Trying user's own repository: ${this.authenticatedUser.login}/${this.config.repo}`
      );

      const originalOwner = this.config.owner;
      this.config.owner = this.authenticatedUser.login;

      const userRepoAccess = await this.testRepositoryAccess();

      if (userRepoAccess.success) {
        console.log("GitHubUploadService: Using user's repository");
        // Update config
        if (window.GitHubConfig) {
          window.GitHubConfig.repository.owner = this.authenticatedUser.login;
          window.GitHubConfig.api.cdnEndpoint = `https://${this.authenticatedUser.login}.github.io/${this.config.repo}`;
        }
        return true;
      } else if (userRepoAccess.status === 404) {
        // Try to create repository
        console.log("GitHubUploadService: Attempting to create repository...");
        const createSuccess = await this.createRepository();
        if (createSuccess) {
          return true;
        }
      }

      // Restore original owner if user repo doesn't work
      this.config.owner = originalOwner;
    }

    // Show clear error message
    throw new Error(
      `Cannot access repository ${this.config.owner}/${this.config.repo}. ` +
        `The token for user '${this.authenticatedUser?.login}' does not have write access. ` +
        `Please use the correct token for account '${this.config.owner}' or add '${this.authenticatedUser?.login}' as a collaborator.`
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
        console.log("GitHubUploadService: Repository created successfully");

        // Enable GitHub Pages
        await this.enableGitHubPages();

        // Wait for repository to be ready
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      } else {
        const createError = await createRepoResponse.json().catch(() => ({}));
        console.error(
          "GitHubUploadService: Repository creation failed:",
          createError
        );
        return false;
      }
    } catch (error) {
      console.error("GitHubUploadService: Error creating repository:", error);
      return false;
    }
  }

  /**
   * Enable GitHub Pages for the repository
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
        console.log("GitHubUploadService: GitHub Pages enabled");
        return true;
      } else {
        console.warn("GitHubUploadService: Could not enable GitHub Pages");
        return false;
      }
    } catch (error) {
      console.error("GitHubUploadService: Error enabling GitHub Pages:", error);
      return false;
    }
  }

  /**
   * Upload logo file to GitHub repository
   */
  async uploadLogo(file, metadata = {}) {
    console.log("GitHubUploadService: Starting uploadLogo for:", file.name);
    console.log(
      "GitHubUploadService: Authentication status:",
      this.isAuthenticated
    );
    console.log("GitHubUploadService: Token exists:", !!this.token);
    console.log("GitHubUploadService: Config:", this.config);

    if (!this.isAuthenticated) {
      throw new Error("GitHub service not authenticated");
    }

    try {
      console.log(`GitHubUploadService: Uploading ${file.name}...`);

      // Convert file to base64
      console.log("GitHubUploadService: Converting file to base64...");
      const base64Content = await this.fileToBase64(file);
      console.log(
        "GitHubUploadService: Base64 conversion completed, length:",
        base64Content.length
      );

      // Generate filename with timestamp if needed
      const filename =
        metadata.filename || this.generateUniqueFilename(file.name);
      const filePath = this.config.uploadPath + filename;

      console.log("GitHubUploadService: Generated filename:", filename);
      console.log("GitHubUploadService: File path:", filePath);

      // Check if file already exists
      console.log("GitHubUploadService: Checking if file exists...");
      const existingFile = await this.getFileInfo(filePath);
      console.log(
        "GitHubUploadService: Existing file:",
        existingFile ? "exists" : "not found"
      );

      // Prepare commit data
      const commitData = {
        message: `Upload logo: ${filename}`,
        content: base64Content,
        branch: this.config.branch,
      };

      // If file exists, include SHA for update
      if (existingFile) {
        commitData.sha = existingFile.sha;
        commitData.message = `Update logo: ${filename}`;
      }

      // Upload file
      const uploadUrl = `${this.config.apiEndpoint}/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`;
      console.log("GitHubUploadService: Upload URL:", uploadUrl);
      console.log("GitHubUploadService: Commit data:", {
        message: commitData.message,
        branch: commitData.branch,
        contentLength: commitData.content.length,
        sha: commitData.sha || "new file",
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commitData),
      });

      console.log(
        "GitHubUploadService: Upload response status:",
        uploadResponse.status
      );
      console.log(
        "GitHubUploadService: Upload response statusText:",
        uploadResponse.statusText
      );

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({
          message: `HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`,
        }));
        console.error("GitHubUploadService: Upload error response:", errorData);

        // Provide more specific error messages
        if (uploadResponse.status === 404) {
          throw new Error(
            `Repository or path not found. Please check if the repository '${this.config.owner}/${this.config.repo}' exists and you have write access.`
          );
        } else if (uploadResponse.status === 401) {
          throw new Error(
            "Authentication failed. Please check your GitHub token."
          );
        } else if (uploadResponse.status === 403) {
          throw new Error(
            "Access denied. Please check if you have write permissions to the repository."
          );
        } else {
          throw new Error(
            `Upload failed: ${errorData.message || uploadResponse.statusText}`
          );
        }
      }

      const uploadResult = await uploadResponse.json();
      console.log("GitHubUploadService: Upload result:", uploadResult);

      console.log(
        `GitHubUploadService: File uploaded successfully: ${filename}`
      );

      // Return logo metadata for manifest
      const logoMetadata = {
        id: this.generateLogoId(filename),
        name: metadata.name || file.name.replace(/\.[^/.]+$/, ""),
        url: uploadResult.content.download_url,
        filename: filename,
        size: file.size,
        type: file.type,
        checksum: await this.calculateChecksum(file),
        priority: metadata.priority || 1,
        active: metadata.active !== false,
        uploadedAt: new Date().toISOString(),
        githubPath: filePath,
        githubSha: uploadResult.content.sha,
      };

      return logoMetadata;
    } catch (error) {
      console.error("GitHubUploadService: Upload failed:", error);
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

        console.log(
          `GitHubUploadService: Batch upload ${i + 1}/${files.length} completed`
        );
      } catch (error) {
        console.error(
          `GitHubUploadService: Batch upload ${i + 1} failed:`,
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
   * Update manifest file with new logo
   */
  async updateManifest(logoMetadata) {
    try {
      console.log("GitHubUploadService: Updating manifest...");

      // Get current manifest
      const currentManifest = await this.getCurrentManifest();

      // Add or update logo in manifest
      const updatedManifest = this.addLogoToManifest(
        currentManifest,
        logoMetadata
      );

      // Upload updated manifest
      await this.uploadManifest(updatedManifest);

      console.log("GitHubUploadService: Manifest updated successfully");
      return updatedManifest;
    } catch (error) {
      console.error("GitHubUploadService: Manifest update failed:", error);
      throw error;
    }
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

        // Validate and fix manifest structure if needed
        return this.validateAndFixManifest(manifest);
      } else {
        // Return default manifest
        return this.createDefaultManifest();
      }
    } catch (error) {
      console.warn(
        "GitHubUploadService: Could not load manifest, using default:",
        error
      );
      return this.createDefaultManifest();
    }
  }

  /**
   * Validate and fix manifest structure
   */
  validateAndFixManifest(manifest) {
    const fixedManifest = { ...manifest };

    // Ensure required properties exist
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
   * Create default manifest structure
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

    // Ensure logos array exists
    if (!updatedManifest.logos) {
      updatedManifest.logos = [];
    }

    // Remove existing logo with same ID if exists
    updatedManifest.logos = updatedManifest.logos.filter(
      (logo) => logo.id !== logoMetadata.id
    );

    // Add new logo
    updatedManifest.logos.push(logoMetadata);

    // Sort by priority
    updatedManifest.logos.sort((a, b) => a.priority - b.priority);

    // Update manifest metadata
    updatedManifest.version = `1.0.${Date.now()}`;
    updatedManifest.lastUpdated = new Date().toISOString();

    // Ensure metadata object exists before setting properties
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

    // Get existing manifest info for SHA
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
        return null; // File doesn't exist
      } else {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }
    } catch (error) {
      console.error("GitHubUploadService: Error getting file info:", error);
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
        const base64 = reader.result.split(",")[1]; // Remove data:image/png;base64, prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Calculate file checksum
   */
  async calculateChecksum(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("MD5", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex;
    } catch (error) {
      // Fallback to simple hash
      return `${file.name}_${file.size}_${Date.now()}`
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
    }
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
      .replace(/\.[^/.]+$/, "") // Remove extension
      .replace(/[^a-z0-9]/g, "-") // Replace non-alphanumeric with dash
      .replace(/-+/g, "-") // Replace multiple dashes with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
  }

  /**
   * Trigger GitHub Actions workflow
   */
  async triggerWorkflow() {
    try {
      console.log("GitHubUploadService: Triggering deployment workflow...");

      // Try different workflow file names
      const workflowNames = [
        "jekyll-gh-pages.yml",
        "deploy-manifest.yml",
        "pages-build-deployment",
      ];

      for (const workflowName of workflowNames) {
        console.log(`GitHubUploadService: Trying workflow: ${workflowName}`);

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
              inputs: {
                force_rebuild: "true",
              },
            }),
          }
        );

        if (response.ok) {
          console.log(
            `GitHubUploadService: Workflow '${workflowName}' triggered successfully`
          );
          return true;
        } else if (response.status !== 404) {
          console.warn(
            `GitHubUploadService: Workflow '${workflowName}' trigger failed:`,
            response.status,
            response.statusText
          );
        }
      }

      // If all workflows fail, just log warning and continue
      console.warn(
        "GitHubUploadService: No suitable workflow found, GitHub Pages will auto-deploy on push"
      );
      return false;
    } catch (error) {
      console.error("GitHubUploadService: Error triggering workflow:", error);
      return false;
    }
  }

  /**
   * Complete upload workflow: upload files + update manifest + trigger deploy
   */
  async completeUploadWorkflow(files, settings = {}, options = {}) {
    try {
      console.log(
        `GitHubUploadService: Starting complete upload workflow for ${files.length} files...`
      );

      // Upload files
      const { results, errors } = await this.uploadLogoBatch(
        files,
        options.onProgress
      );

      if (results.length === 0) {
        throw new Error("No files were uploaded successfully");
      }

      // Clear all old banners/logos before adding new ones
      let currentManifest = await this.getCurrentManifest();
      currentManifest.logos = [];

      // Update manifest settings with new settings from web-admin
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

      console.log(
        "GitHubUploadService: Updated manifest settings:",
        currentManifest.settings
      );

      for (const logoMetadata of results) {
        currentManifest = this.addLogoToManifest(currentManifest, logoMetadata);
      }

      await this.uploadManifest(currentManifest);

      // Trigger deployment
      await this.triggerWorkflow();

      console.log("GitHubUploadService: Complete upload workflow finished");

      return {
        success: true,
        uploaded: results.length,
        failed: errors.length,
        errors: errors,
        manifest: currentManifest,
      };
    } catch (error) {
      console.error(
        "GitHubUploadService: Complete upload workflow failed:",
        error
      );
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
    };
  }
}

// Create global service instance
window.GitHubUploadService = new GitHubUploadService();

// Global functions for use in HTML
window.initializeGitHubService = async function (token) {
  return await window.GitHubUploadService.initialize(token);
};

window.uploadLogosToGitHub = async function (files, settings = {}, onProgress) {
  return await window.GitHubUploadService.completeUploadWorkflow(
    files,
    settings,
    {
      onProgress,
    }
  );
};

window.getGitHubServiceStatus = function () {
  return window.GitHubUploadService.getStatus();
};
