/**
 * Banner Sync Service for real-time banner management
 * Extends existing MQTT infrastructure to support remote banner updates
 */

import MqttService from "./mqttService";

export interface BannerData {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: Date;
  active: boolean;
}

export interface BannerSyncConfig {
  enabled: boolean;
  mqttBroker: string;
  topics: {
    bannerUpdate: string;
    bannerDelete: string;
    bannerSync: string;
  };
  downloadPath: string;
  maxCacheSize: number;
}

class BannerSyncService {
  private mqttClient: any = null;
  private config: BannerSyncConfig;
  private bannerCache: Map<string, string> = new Map();
  private updateCallbacks: ((banners: BannerData[]) => void)[] = [];
  private isConnected: boolean = false;

  constructor(config: BannerSyncConfig) {
    this.config = config;
    console.log("BannerSyncService: Initialized with config", {
      enabled: config.enabled,
      mqttBroker: config.mqttBroker,
      topics: config.topics,
    });
  }

  /**
   * Initialize banner sync service
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      console.log("BannerSyncService: Service disabled in config");
      return false;
    }

    try {
      console.log("BannerSyncService: Initializing MQTT connection...");

      // Import MQTT library
      const mqtt = require("mqtt");

      // Connect to MQTT broker
      this.mqttClient = mqtt.connect(this.config.mqttBroker, {
        clientId: `billboard_desktop_${Math.random()
          .toString(16)
          .substr(2, 8)}_${Date.now()}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      });

      // Setup event handlers
      this.setupMqttHandlers();

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error("BannerSyncService: Connection timeout");
          resolve(false);
        }, 5000);

        this.mqttClient.on("connect", () => {
          clearTimeout(timeout);
          this.isConnected = true;
          console.log("BannerSyncService: MQTT connected successfully");
          this.subscribeToTopics();
          resolve(true);
        });

        this.mqttClient.on("error", (error: any) => {
          clearTimeout(timeout);
          console.error("BannerSyncService: MQTT connection error:", error);
          resolve(false);
        });
      });
    } catch (error) {
      console.error("BannerSyncService: Initialization error:", error);
      return false;
    }
  }

  /**
   * Setup MQTT event handlers
   */
  private setupMqttHandlers(): void {
    if (!this.mqttClient) return;

    this.mqttClient.on("connect", () => {
      console.log("BannerSyncService: MQTT connected");
      this.isConnected = true;
      this.subscribeToTopics();
    });

    this.mqttClient.on("disconnect", () => {
      console.log("BannerSyncService: MQTT disconnected");
      this.isConnected = false;
    });

    this.mqttClient.on("message", (topic: string, message: Buffer) => {
      this.handleMqttMessage(topic, message);
    });

    this.mqttClient.on("error", (error: any) => {
      console.error("BannerSyncService: MQTT error:", error);
      this.isConnected = false;
    });
  }

  /**
   * Subscribe to banner topics
   */
  private subscribeToTopics(): void {
    if (!this.mqttClient || !this.isConnected) return;

    const topics = [
      this.config.topics.bannerUpdate,
      this.config.topics.bannerDelete,
      this.config.topics.bannerSync,
    ];

    topics.forEach((topic) => {
      this.mqttClient.subscribe(topic, { qos: 1 }, (err: any) => {
        if (err) {
          console.error(
            `BannerSyncService: Failed to subscribe to ${topic}:`,
            err
          );
        } else {
          console.log(`BannerSyncService: Subscribed to ${topic}`);
        }
      });
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  private async handleMqttMessage(
    topic: string,
    message: Buffer
  ): Promise<void> {
    try {
      const data = JSON.parse(message.toString());
      console.log("BannerSyncService: Received message", { topic, data });

      if (topic === this.config.topics.bannerUpdate) {
        await this.handleBannerUpdate(data);
      } else if (topic === this.config.topics.bannerDelete) {
        await this.handleBannerDelete(data);
      } else if (topic === this.config.topics.bannerSync) {
        await this.handleBannerSync(data);
      }
    } catch (error) {
      console.error("BannerSyncService: Error handling MQTT message:", error);
    }
  }

  /**
   * Handle banner update message
   */
  private async handleBannerUpdate(data: any): Promise<void> {
    try {
      console.log("BannerSyncService: Processing banner update:", data);

      if (data.type === "banner_update" && data.data) {
        const bannerData = data.data;

        // Download and cache banner
        const localPath = await this.downloadBanner(
          bannerData.url,
          bannerData.id
        );

        if (localPath) {
          // Update local cache
          this.bannerCache.set(bannerData.id, localPath);

          // Update config with new banner
          await this.updateLocalBannerConfig(bannerData, localPath);

          console.log(
            "BannerSyncService: Banner updated successfully:",
            bannerData.id
          );
        }
      }
    } catch (error) {
      console.error("BannerSyncService: Error handling banner update:", error);
    }
  }

  /**
   * Handle banner delete message
   */
  private async handleBannerDelete(data: any): Promise<void> {
    try {
      console.log("BannerSyncService: Processing banner delete:", data);

      if (data.type === "banner_delete" && data.bannerId) {
        const bannerId = data.bannerId;

        // Remove from cache
        this.bannerCache.delete(bannerId);

        // Update local config
        await this.removeBannerFromConfig(bannerId);

        console.log(
          "BannerSyncService: Banner deleted successfully:",
          bannerId
        );
      }
    } catch (error) {
      console.error("BannerSyncService: Error handling banner delete:", error);
    }
  }

  /**
   * Handle banner settings sync
   */
  private async handleBannerSync(data: any): Promise<void> {
    try {
      console.log("BannerSyncService: Processing settings sync:", data);

      if (data.type === "settings_sync" && data.settings) {
        const settings = data.settings;

        // Update local settings
        await this.updateLocalSettings(settings);

        console.log(
          "BannerSyncService: Settings synced successfully:",
          settings
        );
      }
    } catch (error) {
      console.error("BannerSyncService: Error handling settings sync:", error);
    }
  }

  /**
   * Download banner from URL and save locally
   */
  private async downloadBanner(
    url: string,
    bannerId: string
  ): Promise<string | null> {
    try {
      console.log("BannerSyncService: Downloading banner:", { url, bannerId });

      const path = require("path");
      const fs = require("fs");
      const axios = require("axios");

      // Create downloads directory if not exists
      const downloadDir = path.join(this.config.downloadPath, "banners");
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      // Generate local filename
      const fileExtension = path.extname(new URL(url).pathname) || ".jpg";
      const localFilename = `banner_${bannerId}${fileExtension}`;
      const localPath = path.join(downloadDir, localFilename);

      // Download file
      const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",
        timeout: 30000,
      });

      // Save to local file
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log(
            "BannerSyncService: Banner downloaded successfully:",
            localPath
          );
          resolve(localPath);
        });
        writer.on("error", (error: any) => {
          console.error("BannerSyncService: Download error:", error);
          reject(error);
        });
      });
    } catch (error) {
      console.error("BannerSyncService: Error downloading banner:", error);
      return null;
    }
  }

  /**
   * Update local banner configuration
   */
  private async updateLocalBannerConfig(
    bannerData: any,
    localPath: string
  ): Promise<void> {
    try {
      // Get current config via electron API
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const currentConfig = await (window as any).electronAPI.getConfig();

        // Add new banner to logoImages array
        const newBanner = {
          name: bannerData.name,
          path: localPath,
          size: bannerData.size || 0,
          type: bannerData.type || "image/*",
          id: bannerData.id, // Add ID for tracking
          source: "web_sync", // Mark as web-synced
        };

        // Remove existing banner with same ID if exists
        const filteredBanners = (currentConfig.logoImages || []).filter(
          (img: any) => img.id !== bannerData.id
        );

        // Add new banner
        const updatedLogoImages = [...filteredBanners, newBanner];

        // Update config
        const updatedConfig = {
          ...currentConfig,
          logoImages: updatedLogoImages,
          logoMode: currentConfig.logoMode || "loop", // Ensure loop mode for multiple banners
        };

        // Save updated config
        await (window as any).electronAPI.saveConfig(updatedConfig);

        console.log("BannerSyncService: Local config updated with new banner");
      }
    } catch (error) {
      console.error("BannerSyncService: Error updating local config:", error);
    }
  }

  /**
   * Remove banner from local configuration
   */
  private async removeBannerFromConfig(bannerId: string): Promise<void> {
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const currentConfig = await (window as any).electronAPI.getConfig();

        // Remove banner with matching ID
        const filteredBanners = (currentConfig.logoImages || []).filter(
          (img: any) => img.id !== bannerId
        );

        // Update config
        const updatedConfig = {
          ...currentConfig,
          logoImages: filteredBanners,
        };

        // Save updated config
        await (window as any).electronAPI.saveConfig(updatedConfig);

        console.log(
          "BannerSyncService: Banner removed from local config:",
          bannerId
        );
      }
    } catch (error) {
      console.error(
        "BannerSyncService: Error removing banner from config:",
        error
      );
    }
  }

  /**
   * Update local settings
   */
  private async updateLocalSettings(settings: any): Promise<void> {
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const currentConfig = await (window as any).electronAPI.getConfig();

        // Update logo settings
        const updatedConfig = {
          ...currentConfig,
          logoMode: settings.displayMode || currentConfig.logoMode,
          logoLoopDuration:
            settings.loopDuration || currentConfig.logoLoopDuration,
        };

        // Save updated config
        await (window as any).electronAPI.saveConfig(updatedConfig);

        console.log("BannerSyncService: Local settings updated:", settings);
      }
    } catch (error) {
      console.error("BannerSyncService: Error updating local settings:", error);
    }
  }

  /**
   * Add update callback
   */
  onBannerUpdate(callback: (banners: BannerData[]) => void): () => void {
    this.updateCallbacks.push(callback);

    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; enabled: boolean } {
    return {
      connected: this.isConnected,
      enabled: this.config.enabled,
    };
  }

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }
    this.isConnected = false;
    this.updateCallbacks = [];
    this.bannerCache.clear();
    console.log("BannerSyncService: Destroyed");
  }
}

export default BannerSyncService;
