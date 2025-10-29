/**
 * GitHub Repository Configuration
 * Centralized configuration for GitHub CDN integration
 */

window.GitHubConfig = {
  // Repository configuration
  repository: {
    owner: "MQuan-eoh",
    repo: "billboard-logos-cdn",
    branch: "main",
    uploadPath: "logos/",
  },

  // API configuration
  api: {
    endpoint: "https://api.github.com",
    cdnEndpoint: "https://mquan-eoh.github.io/billboard-logos-cdn",
  },

  // Alternative repositories (fallback)
  alternatives: [
    {
      owner: "MinhQuan7",
      repo: "billboard-logos-cdn",
      branch: "main",
      uploadPath: "logos/",
    },
  ],

  // Validation and auto-detection
  autoDetectRepo: true,
  createRepoIfNotFound: true,

  // GitHub Pages settings
  enableGitHubPages: true,
  pagesSource: "main",

  // Helper methods
  getCurrentRepoUrl() {
    return `https://github.com/${this.repository.owner}/${this.repository.repo}`;
  },

  getManifestUrl() {
    return `${this.api.cdnEndpoint}/manifest.json`;
  },

  getRepoApiUrl() {
    return `${this.api.endpoint}/repos/${this.repository.owner}/${this.repository.repo}`;
  },

  // Switch to alternative repository
  switchToAlternative(index = 0) {
    if (this.alternatives[index]) {
      this.repository = { ...this.alternatives[index] };
      this.api.cdnEndpoint = `https://${this.repository.owner}.github.io/${this.repository.repo}`;
      console.log(
        "GitHubConfig: Switched to alternative repository:",
        this.repository
      );
      return true;
    }
    return false;
  },

  // Validate repository configuration
  validate() {
    const required = ["owner", "repo", "branch", "uploadPath"];
    for (const field of required) {
      if (!this.repository[field]) {
        throw new Error(`GitHubConfig: Missing required field: ${field}`);
      }
    }
    return true;
  },
};

// Auto-validate on load
try {
  window.GitHubConfig.validate();
  console.log("GitHubConfig: Configuration loaded and validated");
} catch (error) {
  console.error("GitHubConfig: Configuration validation failed:", error);
}
