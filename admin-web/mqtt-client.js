// MQTT Client for Real-time Banner Sync
class MqttClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.connectionStatus = "disconnected";
    this.statusCallbacks = [];
    this.messageCallbacks = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Initialize and connect to MQTT broker
  async connect() {
    try {
      console.log("Connecting to MQTT broker...");
      this.updateStatus("connecting");

      const config = window.BannerConfig.mqtt;

      // Connect to MQTT broker
      this.client = mqtt.connect(config.broker, {
        ...config.options,
        will: {
          topic: config.topic.status,
          payload: JSON.stringify({
            clientId: config.options.clientId,
            status: "offline",
            timestamp: Date.now(),
          }),
          qos: 1,
          retain: false,
        },
      });

      // Setup event handlers
      this.setupEventHandlers();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, config.options.connectTimeout);

        this.client.on("connect", () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.updateStatus("connected");

          // Send online status
          this.publishStatus("online");

          // Subscribe to status topics for updates and reset
          this.subscribeToStatusTopics();

          console.log("MQTT connected successfully");
          resolve(true);
        });

        this.client.on("error", (error) => {
          clearTimeout(timeout);
          console.error("MQTT connection error:", error);
          this.updateStatus("error", error.message);
          reject(error);
        });
      });
    } catch (error) {
      console.error("MQTT connect error:", error);
      this.updateStatus("error", error.message);
      throw error;
    }
  }

  // Setup MQTT event handlers
  setupEventHandlers() {
    if (!this.client) return;

    this.client.on("connect", () => {
      console.log("MQTT Client connected");
      this.connected = true;
      this.reconnectAttempts = 0;
      this.updateStatus("connected");
      this.publishStatus("online");
      // Subscribe to status topics
      this.subscribeToStatusTopics();
    });

    this.client.on("disconnect", () => {
      console.log("MQTT Client disconnected");
      this.connected = false;
      this.updateStatus("disconnected");
    });

    this.client.on("reconnect", () => {
      this.reconnectAttempts++;
      console.log(
        `MQTT Client reconnecting... (attempt ${this.reconnectAttempts})`
      );

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("Max reconnection attempts reached");
        this.disconnect();
        this.updateStatus("error", "Max reconnection attempts reached");
      } else {
        this.updateStatus("reconnecting");
      }
    });

    this.client.on("error", (error) => {
      console.error("MQTT Client error:", error);
      this.updateStatus("error", error.message);
    });

    this.client.on("message", (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("MQTT message received:", { topic, data });
        this.notifyMessageCallbacks(topic, data);
      } catch (error) {
        console.error("Error parsing MQTT message:", error);
      }
    });

    this.client.on("close", () => {
      console.log("MQTT Client connection closed");
      this.connected = false;
      this.updateStatus("disconnected");
    });
  }

  // Publish banner update notification
  async publishBannerUpdate(bannerData) {
    if (!this.connected || !this.client) {
      throw new Error("MQTT not connected");
    }

    try {
      const message = {
        type: "banner_update",
        data: bannerData,
        timestamp: Date.now(),
        source: "admin_web",
      };

      await this.publish(window.BannerConfig.mqtt.topic.bannerUpdate, message);
      console.log("Banner update published via MQTT:", message);
      return true;
    } catch (error) {
      console.error("Error publishing banner update:", error);
      throw error;
    }
  }

  // Publish banner deletion notification
  async publishBannerDelete(bannerId) {
    if (!this.connected || !this.client) {
      throw new Error("MQTT not connected");
    }

    try {
      const message = {
        type: "banner_delete",
        bannerId: bannerId,
        timestamp: Date.now(),
        source: "admin_web",
      };

      await this.publish(window.BannerConfig.mqtt.topic.bannerDelete, message);
      console.log("Banner delete published via MQTT:", message);
      return true;
    } catch (error) {
      console.error("Error publishing banner delete:", error);
      throw error;
    }
  }

  // Publish settings sync notification
  async publishSettingsSync(settings) {
    if (!this.connected || !this.client) {
      throw new Error("MQTT not connected");
    }

    try {
      const message = {
        type: "settings_sync",
        settings: settings,
        timestamp: Date.now(),
        source: "admin_web",
      };

      await this.publish(window.BannerConfig.mqtt.topic.bannerSync, message);
      console.log("Settings sync published via MQTT:", message);
      return true;
    } catch (error) {
      console.error("Error publishing settings sync:", error);
      throw error;
    }
  }

  // Publish app reset command
  async publishAppReset() {
    if (!this.connected || !this.client) {
      throw new Error("MQTT not connected");
    }

    try {
      const message = {
        action: "reset_app",
        timestamp: Date.now(),
        source: "admin_web",
        reason: "Manual reset from admin interface",
      };

      await this.publish("its/billboard/commands", message);
      console.log("App reset command published via MQTT:", message);
      return true;
    } catch (error) {
      console.error("Error publishing app reset:", error);
      throw error;
    }
  }

  // Publish manifest refresh signal with auto-reconnect
  async publishManifestRefresh(manifestData) {
    // Try to ensure connection before publishing
    if (!this.connected || !this.client) {
      console.warn("MQTT not connected, attempting to reconnect...");
      try {
        await this.connect();
        console.log("MQTT reconnected successfully");
      } catch (error) {
        console.error("Failed to reconnect MQTT:", error);
        // Continue without MQTT - not critical for manifest updates
        console.warn("Continuing without MQTT refresh signal...");
        return false;
      }
    }

    try {
      console.log("Publishing manifest refresh signal:", manifestData);

      const message = {
        type: "manifest_refresh",
        action: manifestData.action,
        manifest: manifestData.manifest,
        source: manifestData.source,
        timestamp: manifestData.timestamp,
      };

      // Use dedicated topic for manifest refresh
      const manifestTopic = "its/billboard/manifest/refresh";
      await this.publish(manifestTopic, message, 1); // QoS 1 for reliable delivery

      console.log("Manifest refresh signal published via MQTT:", message);
      return true;
    } catch (error) {
      console.error("Error publishing manifest refresh:", error);
      // Don't throw - allow manifest update to continue without MQTT
      return false;
    }
  }

  // Publish status message
  async publishStatus(status) {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      const message = {
        clientId: window.BannerConfig.mqtt.options.clientId,
        status: status,
        timestamp: Date.now(),
        type: "admin_web",
      };

      await this.publish(window.BannerConfig.mqtt.topic.status, message);
      return true;
    } catch (error) {
      console.error("Error publishing status:", error);
      return false;
    }
  }

  // Generic publish method
  publish(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error("MQTT client not available"));
        return;
      }

      const payload =
        typeof message === "string" ? message : JSON.stringify(message);

      this.client.publish(topic, payload, { qos: 1, ...options }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  subscribeToStatusTopics() {
    if (!this.client || !this.client.connected) {
      return;
    }

    // Subscribe to update status
    this.client.subscribe("its/billboard/update/status", { qos: 1 }, (err) => {
      if (err) {
        console.error("Failed to subscribe to update status:", err.message);
      } else {
        console.log("Subscribed to update status topic");
      }
    });

    // Subscribe to reset status
    this.client.subscribe("its/billboard/reset/status", { qos: 1 }, (err) => {
      if (err) {
        console.error("Failed to subscribe to reset status:", err.message);
      } else {
        console.log("Subscribed to reset status topic");
      }
    });
  }

  // Subscribe to topic
  subscribe(topic) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error("MQTT client not available"));
        return;
      }

      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Subscribed to MQTT topic: ${topic}`);
          resolve(true);
        }
      });
    });
  }

  // Disconnect from MQTT broker
  async disconnect() {
    if (this.client) {
      console.log("Disconnecting from MQTT broker...");
      this.publishStatus("offline");
      this.client.end();
      this.client = null;
      this.connected = false;
      this.updateStatus("disconnected");
    }
  }

  // Update connection status
  updateStatus(status, error = null) {
    this.connectionStatus = status;

    const statusData = {
      status: status,
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      error: error,
      timestamp: Date.now(),
    };

    console.log("MQTT status updated:", statusData);
    this.notifyStatusCallbacks(statusData);
  }

  // Add status change callback
  onStatusChange(callback) {
    this.statusCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  // Add message callback
  onMessage(callback) {
    this.messageCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index > -1) {
        this.messageCallbacks.splice(index, 1);
      }
    };
  }

  // Notify status callbacks
  notifyStatusCallbacks(statusData) {
    this.statusCallbacks.forEach((callback) => {
      try {
        callback(statusData);
      } catch (error) {
        console.error("Error in status callback:", error);
      }
    });
  }

  // Notify message callbacks
  notifyMessageCallbacks(topic, data) {
    this.messageCallbacks.forEach((callback) => {
      try {
        callback(topic, data);
      } catch (error) {
        console.error("Error in message callback:", error);
      }
    });
  }

  // Get current status
  getStatus() {
    return {
      status: this.connectionStatus,
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // Test connection
  async testConnection() {
    try {
      await this.connect();
      await this.publishStatus("test");
      return true;
    } catch (error) {
      console.error("MQTT connection test failed:", error);
      throw error;
    }
  }
}

// Create global MQTT client instance
window.MqttClient = new MqttClient();
