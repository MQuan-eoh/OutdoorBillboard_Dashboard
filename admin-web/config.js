// Simplified Configuration for Banner Management System
// GitHub CDN + MQTT Only - Removed Legacy Upload Settings

const CONFIG = {
  // GitHub CDN Configuration (Primary upload system)
  github: {
    enabled: true,
    owner: "MQuan-eoh", // Will be auto-updated with authenticated user
    repo: "billboard-logos-cdn",
    branch: "main",
    apiEndpoint: "https://api.github.com",
    cdnEndpoint: "https://MQuan-eoh.github.io/billboard-logos-cdn",
    uploadPath: "logos/",
    maxFileSize: 10 * 1024 * 1024, // 10MB for GitHub
  },

  // MQTT Configuration
  mqtt: {
    broker: "wss://broker.hivemq.com:8884/mqtt", // Free HiveMQ broker
    topic: {
      bannerUpdate: "its/billboard/banner/update",
      bannerDelete: "its/billboard/banner/delete",
      bannerSync: "its/billboard/banner/sync",
      manifestRefresh: "its/billboard/manifest/refresh",
      status: "its/billboard/status",
    },
    options: {
      connectTimeout: 4000,
      reconnectPeriod: 1000,
      clean: true,
      clientId: null, // Will be generated
    },
  },

  // App Settings
  app: {
    version: "2.0.0-simplified",
    name: "ITS Billboard Management - GitHub CDN",
    workflow: "GitHub CDN Only",
    defaultLoopDuration: 10,
  },

  // Allowed file types
  allowedTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif"],
};

// Generate unique client ID for MQTT
CONFIG.mqtt.options.clientId = `banner_admin_${Math.random()
  .toString(16)
  .substr(2, 8)}_${Date.now()}`;

// Export config
window.BannerConfig = CONFIG;
