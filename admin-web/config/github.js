/**
 * GitHub Configuration
 * Centralized settings for GitHub API & CDN integration
 */

export const GITHUB_CONFIG = {
  // Primary repository
  repository: {
    owner: "MinhQuan7",
    repo: "ITS_OurdoorBillboard-",
    branch: "main",
    uploadPath: "logos/",
  },

  // API endpoints
  api: {
    endpoint: "https://api.github.com",
    cdnEndpoint: "https://mquan-eoh.github.io/ITS_OurdoorBillboard-/logos-cdn",
  },

  // Fallback repositories
  fallback: [
    {
      owner: "MQuan-eoh",
      repo: "ITS_OurdoorBillboard-",
      branch: "main",
      uploadPath: "logos/",
    },
  ],

  // File settings
  files: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif"],
  },

  // Helpers
  getRepoUrl() {
    const { owner, repo } = this.repository;
    return `https://github.com/${owner}/${repo}`;
  },

  getManifestUrl() {
    return `${this.api.cdnEndpoint}/manifest.json`;
  },

  getApiUrl() {
    const { owner, repo } = this.repository;
    return `${this.api.endpoint}/repos/${owner}/${repo}`;
  },

  validate() {
    const required = ["owner", "repo", "branch", "uploadPath"];
    for (const field of required) {
      if (!this.repository[field]) {
        throw new Error(`GitHub config missing: ${field}`);
      }
    }
    return true;
  },
};
