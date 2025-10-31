/**
 * MQTT Broker Service
 * Handles connection and messaging with MQTT broker
 */

import { MQTT_BROKERS, MQTT_TOPICS, MQTT_OPTIONS } from "../config/mqtt.js";

export class MqttBroker {
  constructor() {
    this.client = null;
    this.connected = false;
    this.connectionStatus = "disconnected";
    this.statusCallbacks = [];
    this.messageCallbacks = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isReconnecting = false;
  }

  /**
   * Connect to MQTT broker
   */
  async connect() {
    try {
      console.log("[MqttBroker] Connecting...");
      this.updateStatus("connecting");

      const broker = MQTT_BROKERS.command;
      const mqttOptions = {
        ...MQTT_OPTIONS,
        reconnectPeriod: Math.min(
          1000 * Math.pow(1.5, this.reconnectAttempts),
          30000
        ),
        will: {
          topic: MQTT_TOPICS.status,
          payload: JSON.stringify({
            clientId: MQTT_OPTIONS.clientId,
            status: "offline",
            timestamp: Date.now(),
          }),
          qos: 1,
          retain: false,
        },
      };

      console.log("[MqttBroker] Options:", {
        url: broker.url,
        reconnectPeriod: mqttOptions.reconnectPeriod,
      });

      this.client = mqtt.connect(broker.url, mqttOptions);
      this.setupEventHandlers();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, MQTT_OPTIONS.connectTimeout);

        this.client.on("connect", () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.updateStatus("connected");
          this.publishStatus("online");
          this.subscribeToDefaultTopics();

          console.log("[MqttBroker] Connected successfully");
          resolve(true);
        });

        this.client.on("error", (error) => {
          clearTimeout(timeout);
          console.error("[MqttBroker] Connection error:", error);
          this.updateStatus("error", error.message);
          reject(error);
        });
      });
    } catch (error) {
      console.error("[MqttBroker] Connect error:", error);
      this.updateStatus("error", error.message);
      throw error;
    }
  }

  /**
   * Setup MQTT event handlers
   */
  setupEventHandlers() {
    if (!this.client) return;

    this.client.on("connect", () => {
      console.log("[MqttBroker] Connected");
      this.connected = true;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.updateStatus("connected");
      this.publishStatus("online");
      this.subscribeToDefaultTopics();
    });

    this.client.on("disconnect", () => {
      console.log("[MqttBroker] Disconnected");
      this.connected = false;
      this.updateStatus("disconnected");
    });

    this.client.on("reconnect", () => {
      this.reconnectAttempts++;
      this.isReconnecting = true;

      const backoffDelay = Math.min(
        1000 * Math.pow(1.5, this.reconnectAttempts - 1),
        30000
      );

      console.log(
        `[MqttBroker] Reconnecting (${this.reconnectAttempts}/${
          this.maxReconnectAttempts
        }), wait ${(backoffDelay / 1000).toFixed(1)}s`
      );

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("[MqttBroker] Max reconnection attempts reached");
        this.disconnect();
        this.updateStatus("error", "Max reconnection attempts reached");
      } else {
        this.updateStatus("reconnecting");
      }
    });

    this.client.on("error", (error) => {
      console.error("[MqttBroker] Error:", error);
      this.updateStatus("error", error.message);
    });

    this.client.on("message", (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("[MqttBroker] Received:", { topic, data });
        this.notifyMessageCallbacks(topic, data);
      } catch (error) {
        console.error("[MqttBroker] Parse error:", error);
      }
    });

    this.client.on("close", () => {
      console.log("[MqttBroker] Connection closed");
      this.connected = false;
      this.updateStatus("disconnected");
    });
  }

  /**
   * Publish message to topic
   */
  publish(topic, message, qos = 1) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error("MQTT client not available"));
        return;
      }

      const payload =
        typeof message === "string" ? message : JSON.stringify(message);

      this.client.publish(topic, payload, { qos }, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log("[MqttBroker] Published to", topic);
          resolve(true);
        }
      });
    });
  }

  /**
   * Subscribe to default topics
   */
  subscribeToDefaultTopics() {
    if (!this.client || !this.client.connected) return;

    [
      MQTT_TOPICS.updateStatus,
      MQTT_TOPICS.resetStatus,
      MQTT_TOPICS.status,
    ].forEach((topic) => {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MqttBroker] Failed to subscribe ${topic}:`, err);
        } else {
          console.log(`[MqttBroker] Subscribed to ${topic}`);
        }
      });
    });
  }

  /**
   * Subscribe to specific topic
   */
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
          console.log(`[MqttBroker] Subscribed to ${topic}`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Publish status message
   */
  async publishStatus(status) {
    if (!this.connected || !this.client) return false;

    try {
      const message = {
        clientId: MQTT_OPTIONS.clientId,
        status: status,
        timestamp: Date.now(),
      };

      await this.publish(MQTT_TOPICS.status, message);
      return true;
    } catch (error) {
      console.error("[MqttBroker] Publish status error:", error);
      return false;
    }
  }

  /**
   * Disconnect from broker
   */
  async disconnect() {
    if (this.client) {
      console.log("[MqttBroker] Disconnecting...");
      this.publishStatus("offline");
      this.client.end();
      this.client = null;
      this.connected = false;
      this.updateStatus("disconnected");
    }
  }

  /**
   * Update status
   */
  updateStatus(status, error = null) {
    this.connectionStatus = status;
    const statusData = {
      status: status,
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      error: error,
      timestamp: Date.now(),
    };

    console.log("[MqttBroker] Status:", statusData);
    this.notifyStatusCallbacks(statusData);
  }

  /**
   * Register status change callback
   */
  onStatusChange(callback) {
    this.statusCallbacks.push(callback);
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) this.statusCallbacks.splice(index, 1);
    };
  }

  /**
   * Register message callback
   */
  onMessage(callback) {
    this.messageCallbacks.push(callback);
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index > -1) this.messageCallbacks.splice(index, 1);
    };
  }

  /**
   * Notify status callbacks
   */
  notifyStatusCallbacks(statusData) {
    this.statusCallbacks.forEach((callback) => {
      try {
        callback(statusData);
      } catch (error) {
        console.error("[MqttBroker] Callback error:", error);
      }
    });
  }

  /**
   * Notify message callbacks
   */
  notifyMessageCallbacks(topic, data) {
    this.messageCallbacks.forEach((callback) => {
      try {
        callback(topic, data);
      } catch (error) {
        console.error("[MqttBroker] Callback error:", error);
      }
    });
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      status: this.connectionStatus,
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      await this.connect();
      await this.publishStatus("test");
      return true;
    } catch (error) {
      console.error("[MqttBroker] Test failed:", error);
      throw error;
    }
  }
}
