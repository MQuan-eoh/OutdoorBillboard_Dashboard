/**
 * E-Ra IoT MQTT Service
 * Replaces REST API with MQTT.js integration for real-time data
 *
 * Based on E-Ra IoT MQTT documentation:
 * - Broker: mqtt1.eoh.io
 * - Port: 1883
 * - Topic pattern: eoh/chip/{token}/config/+/value
 * - Authentication: username = {token}, password = {token}
 * - Payload format: {"key": value}
 * - QoS: 1 (At least once delivery)
 * - Retained: true (Last message saved by broker)
 */

import * as mqtt from "mqtt";

export interface MqttSensorData {
  temperature: number | null;
  humidity: number | null;
  pm25: number | null;
  pm10: number | null;
  timestamp: Date;
}

export interface MqttConfig {
  enabled?: boolean;
  gatewayToken: string; // E-RA Gateway token (both username and password)
  authToken?: string; // Full auth token with "Token " prefix (for compatibility)
  sensorConfigs: {
    temperature: number | null;
    humidity: number | null;
    pm25: number | null;
    pm10: number | null;
  };
  options: {
    keepalive: number;
    connectTimeout: number;
    reconnectPeriod: number;
    clean: boolean;
  };
}

export interface MqttConnectionStatus {
  connected: boolean;
  lastConnected: Date | null;
  lastMessage: Date | null;
  reconnectAttempts: number;
  error?: string;
}

class MqttService {
  private client: mqtt.MqttClient | null = null;
  private config: MqttConfig;
  private currentData: MqttSensorData;
  private status: MqttConnectionStatus;
  private dataCallbacks: ((data: MqttSensorData) => void)[] = [];
  private statusCallbacks: ((status: MqttConnectionStatus) => void)[] = [];
  private periodicUpdateInterval: NodeJS.Timeout | null = null;

  constructor(config: MqttConfig) {
    this.config = config;
    this.currentData = {
      temperature: null,
      humidity: null,
      pm25: null,
      pm10: null,
      timestamp: new Date(),
    };
    this.status = {
      connected: false,
      lastConnected: null,
      lastMessage: null,
      reconnectAttempts: 0,
    };

    // Extract gateway token from authToken if available
    this.updateGatewayTokenFromAuth();

    console.log("MqttService: Initialized with config", {
      gatewayToken: this.config.gatewayToken.substring(0, 10) + "...",
      hasAuthToken: !!this.config.authToken,
      sensorConfigs: this.config.sensorConfigs,
    });
  }

  /**
   * Extract gateway token from authToken if available
   */
  private updateGatewayTokenFromAuth(): void {
    if (this.config.authToken && this.config.authToken.startsWith("Token ")) {
      this.config.gatewayToken = this.config.authToken.substring(6);
      console.log("MqttService: Updated gateway token from auth token");
    }
  }

  /**
   * Connect to MQTT broker
   */
  public async connect(): Promise<void> {
    if (this.client) {
      console.warn("MqttService: Already connected or connecting");
      return;
    }

    try {
      // E-RA MQTT Configuration
      const brokerUrl = "mqtt://mqtt1.eoh.io:1883";

      const clientOptions: mqtt.IClientOptions = {
        username: this.config.gatewayToken, // E-RA Gateway token as username
        password: this.config.gatewayToken, // E-RA Gateway token as password
        keepalive: this.config.options.keepalive,
        connectTimeout: this.config.options.connectTimeout,
        reconnectPeriod: this.config.options.reconnectPeriod,
        clean: this.config.options.clean,
        clientId: `billboard_${this.config.gatewayToken}_${Date.now()}`,
        will: {
          topic: `eoh/chip/${this.config.gatewayToken}/lwt`,
          payload: '{"ol":0}', // Gateway offline
          qos: 1,
          retain: true,
        },
      };

      console.log("MqttService: Connecting to E-RA MQTT broker...", {
        url: brokerUrl,
        username: this.config.gatewayToken.substring(0, 10) + "...",
        clientId: clientOptions.clientId,
      });

      console.log("MqttService: Creating MQTT client...");
      this.client = mqtt.connect(brokerUrl, clientOptions);
      console.log(
        "MqttService: MQTT client created, setting up event handlers..."
      );

      this.client.on("connect", () => {
        console.log("MqttService: Connected to MQTT broker");
        this.status.connected = true;
        this.status.lastConnected = new Date();
        this.status.reconnectAttempts = 0;
        this.status.error = undefined;
        this.notifyStatusCallbacks();
        this.subscribeToTopics();
        this.startPeriodicUpdates();
      });

      this.client.on("message", (topic: string, message: Buffer) => {
        this.handleMessage(topic, message);
      });

      this.client.on("error", (error) => {
        console.error("MqttService: Connection error:", error);
        this.status.error = error.message;
        this.notifyStatusCallbacks();
      });

      this.client.on("disconnect", () => {
        console.log("MqttService: Disconnected from MQTT broker");
        this.status.connected = false;
        this.notifyStatusCallbacks();
      });

      this.client.on("reconnect", () => {
        this.status.reconnectAttempts++;
        console.log(
          `MqttService: Reconnecting... (attempt ${this.status.reconnectAttempts})`
        );
        this.notifyStatusCallbacks();
      });

      this.client.on("close", () => {
        console.log("MqttService: Connection closed");
        this.status.connected = false;
        this.stopPeriodicUpdates();
        this.notifyStatusCallbacks();
      });
    } catch (error) {
      console.error("MqttService: Failed to connect:", error);
      this.status.error =
        error instanceof Error ? error.message : "Unknown connection error";
      this.notifyStatusCallbacks();
      throw error;
    }
  }

  /**
   * Start periodic updates every second to ensure components always receive fresh data
   */
  private startPeriodicUpdates(): void {
    if (this.periodicUpdateInterval) {
      clearInterval(this.periodicUpdateInterval);
    }

    // Emit data updates every 1000ms (1 second) to ensure real-time responsiveness
    this.periodicUpdateInterval = setInterval(() => {
      if (this.status.connected) {
        // Update timestamp to show the data is being actively monitored
        this.currentData.timestamp = new Date();
        this.notifyDataCallbacks();
        console.log(
          "MqttService: Periodic update triggered - data pushed to components"
        );
      }
    }, 1000);

    console.log("MqttService: Started periodic updates every 1 second");
  }

  /**
   * Stop periodic updates
   */
  private stopPeriodicUpdates(): void {
    if (this.periodicUpdateInterval) {
      clearInterval(this.periodicUpdateInterval);
      this.periodicUpdateInterval = null;
      console.log("MqttService: Stopped periodic updates");
    }
  }

  /**
   * Subscribe to sensor data topics
   */
  private subscribeToTopics(): void {
    if (!this.client || !this.status.connected) {
      console.warn("MqttService: Cannot subscribe - client not connected");
      return;
    }

    // E-RA Topic pattern: eoh/chip/{token}/config/+/value
    // Subscribe to config updates for all sensor IDs
    const configTopic = `eoh/chip/${this.config.gatewayToken}/config/+/value`;

    console.log(`MqttService: Subscribing to E-RA topic: ${configTopic}`);

    this.client.subscribe(configTopic, { qos: 1 }, (err) => {
      if (err) {
        console.error(
          `MqttService: Failed to subscribe to ${configTopic}:`,
          err
        );
      } else {
        console.log(`MqttService: Successfully subscribed to ${configTopic}`);
      }
    });

    // Also subscribe to LWT (Last Will and Testament) topic to monitor gateway status
    const lwtTopic = `eoh/chip/${this.config.gatewayToken}/lwt`;
    this.client.subscribe(lwtTopic, { qos: 1 }, (err) => {
      if (err) {
        console.error(
          `MqttService: Failed to subscribe to LWT ${lwtTopic}:`,
          err
        );
      } else {
        console.log(`MqttService: Subscribed to LWT topic ${lwtTopic}`);
      }
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  private handleMessage(topic: string, message: Buffer): void {
    try {
      const messageStr = message.toString();
      console.log(`MqttService: Received message on ${topic}: ${messageStr}`);

      this.status.lastMessage = new Date();

      // Handle LWT (Last Will and Testament) messages for gateway status
      if (topic.endsWith("/lwt")) {
        this.handleLwtMessage(messageStr);
        return;
      }

      // Parse E-RA message format: {"key": value}
      let data: any;
      try {
        data = JSON.parse(messageStr);
      } catch {
        console.warn("MqttService: Received non-JSON message:", messageStr);
        return;
      }

      // Extract config ID from topic: eoh/chip/{token}/config/{configId}/value
      const configIdMatch = topic.match(/\/config\/(\d+)\/value$/);
      if (!configIdMatch) {
        console.warn(
          "MqttService: Could not extract config ID from topic:",
          topic
        );
        return;
      }

      const configId = parseInt(configIdMatch[1]);

      // Update sensor data based on config ID
      this.updateSensorDataByConfigId(configId, data);

      // Notify data callbacks
      this.notifyDataCallbacks();
      this.notifyStatusCallbacks();
    } catch (error) {
      console.error("MqttService: Error processing message:", error);
    }
  }

  /**
   * Handle Last Will and Testament (LWT) messages
   */
  private handleLwtMessage(messageStr: string): void {
    try {
      const lwtData = JSON.parse(messageStr);
      if (lwtData.ol === 1) {
        console.log("MqttService: Gateway is online");
      } else if (lwtData.ol === 0) {
        console.log("MqttService: Gateway is offline");
      }
    } catch (error) {
      console.warn("MqttService: Could not parse LWT message:", messageStr);
    }
  }

  /**
   * Update sensor data based on E-RA config ID and value
   */
  private updateSensorDataByConfigId(configId: number, data: any): void {
    // Extract value from E-RA message format: {"key": value}
    // The value could be a direct number or nested in the object
    let value: number | null = null;

    // Handle different E-RA message formats
    if (typeof data === "object" && data !== null) {
      // Try to extract the value from different possible keys
      const possibleKeys = Object.keys(data);

      // For E-RA, the value might be directly in the object
      if (possibleKeys.length === 1) {
        const singleKey = possibleKeys[0];
        const potentialValue = data[singleKey];

        // Handle string values that might contain "+"
        if (typeof potentialValue === "string") {
          value = this.parseEraValue(potentialValue);
        } else if (
          typeof potentialValue === "number" &&
          !isNaN(potentialValue)
        ) {
          value = potentialValue;
        }
      }

      // If no direct key-value found, try common field names
      if (value === null) {
        const commonValue =
          data.value ?? data.current_value ?? data.data ?? null;
        if (commonValue !== null) {
          if (typeof commonValue === "string") {
            value = this.parseEraValue(commonValue);
          } else if (typeof commonValue === "number" && !isNaN(commonValue)) {
            value = commonValue;
          }
        }
      }
    } else if (typeof data === "number" && !isNaN(data)) {
      value = data;
    } else if (typeof data === "string") {
      value = this.parseEraValue(data);
    }

    if (value === null || isNaN(value)) {
      console.warn(
        `MqttService: Could not extract numeric value from config ID ${configId}:`,
        data
      );
      return;
    }

    // Map config ID to sensor type
    const sensorType = this.mapConfigIdToSensorType(configId);
    if (sensorType) {
      console.log(
        `MqttService: Updating ${sensorType} (ID: ${configId}) = ${value}`
      );
      this.currentData[sensorType] = value;
      this.currentData.timestamp = new Date();
    } else {
      console.warn(`MqttService: Unknown config ID: ${configId}`);
    }
  }

  /**
   * Parse E-RA value that might contain "+" or other formatting
   */
  private parseEraValue(valueStr: string): number | null {
    try {
      // E-RA might send values with "+" prefix or other formatting
      // Try different parsing strategies

      // Strategy 1: Remove "+" prefix if present
      if (valueStr.startsWith("+")) {
        const withoutPlus = valueStr.substring(1);
        const parsed = parseFloat(withoutPlus);
        if (!isNaN(parsed)) {
          console.log(
            `MqttService: Parsed E-RA value "${valueStr}" as ${parsed} (removed + prefix)`
          );
          return parsed;
        }
      }

      // Strategy 2: Direct parse (handles most cases)
      const directParse = parseFloat(valueStr);
      if (!isNaN(directParse)) {
        console.log(
          `MqttService: Parsed E-RA value "${valueStr}" as ${directParse} (direct parse)`
        );
        return directParse;
      }

      // Strategy 3: Handle comma decimal separator (if E-RA uses European format)
      if (valueStr.includes(",")) {
        const withDot = valueStr.replace(",", ".");
        const parsed = parseFloat(withDot);
        if (!isNaN(parsed)) {
          console.log(
            `MqttService: Parsed E-RA value "${valueStr}" as ${parsed} (comma to dot)`
          );
          return parsed;
        }
      }

      // Strategy 4: Extract first numeric part
      const numericMatch = valueStr.match(/[-+]?\d*\.?\d+/);
      if (numericMatch) {
        const parsed = parseFloat(numericMatch[0]);
        if (!isNaN(parsed)) {
          console.log(
            `MqttService: Parsed E-RA value "${valueStr}" as ${parsed} (regex extract)`
          );
          return parsed;
        }
      }

      console.warn(`MqttService: Could not parse E-RA value: "${valueStr}"`);
      return null;
    } catch (error) {
      console.error(
        `MqttService: Error parsing E-RA value "${valueStr}":`,
        error
      );
      return null;
    }
  }

  /**
   * Map E-RA config ID to sensor type
   */
  private mapConfigIdToSensorType(
    configId: number
  ): keyof Omit<MqttSensorData, "timestamp"> | null {
    // Check against configured sensor IDs
    if (this.config.sensorConfigs.temperature === configId) {
      return "temperature";
    }
    if (this.config.sensorConfigs.humidity === configId) {
      return "humidity";
    }
    if (this.config.sensorConfigs.pm25 === configId) {
      return "pm25";
    }
    if (this.config.sensorConfigs.pm10 === configId) {
      return "pm10";
    }

    return null;
  }

  /**
   * Disconnect from MQTT broker
   */
  public async disconnect(): Promise<void> {
    this.stopPeriodicUpdates();
    if (this.client) {
      console.log("MqttService: Disconnecting from MQTT broker");
      await new Promise<void>((resolve) => {
        this.client!.end(false, {}, () => {
          this.client = null;
          this.status.connected = false;
          this.notifyStatusCallbacks();
          resolve();
        });
      });
    }
  }

  /**
   * Get current sensor data
   */
  public getCurrentData(): MqttSensorData {
    return { ...this.currentData };
  }

  /**
   * Get connection status
   */
  public getStatus(): MqttConnectionStatus {
    return { ...this.status };
  }

  /**
   * Subscribe to data updates
   */
  public onDataUpdate(callback: (data: MqttSensorData) => void): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      const index = this.dataCallbacks.indexOf(callback);
      if (index > -1) {
        this.dataCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to status updates
   */
  public onStatusUpdate(
    callback: (status: MqttConnectionStatus) => void
  ): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<MqttConfig>): void {
    const wasConnected = this.status.connected;

    // Disconnect if connection parameters changed
    if (
      wasConnected &&
      (newConfig.gatewayToken !== undefined ||
        newConfig.authToken !== undefined)
    ) {
      this.disconnect();
    }

    this.config = { ...this.config, ...newConfig };

    // Update gateway token if auth token changed
    this.updateGatewayTokenFromAuth();

    console.log("MqttService: Configuration updated");

    // Reconnect if it was connected before
    if (wasConnected) {
      setTimeout(() => this.connect(), 1000);
    }
  }

  /**
   * Test MQTT connection
   */
  public async testConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      console.log("MqttService: Testing E-RA MQTT connection...");

      // Validate configuration
      if (!this.config.gatewayToken) {
        return {
          success: false,
          message: "Gateway token is required",
        };
      }

      // Try to connect
      await this.connect();

      // Wait a bit for connection to stabilize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (this.status.connected) {
        return {
          success: true,
          message: "E-RA MQTT connection successful",
        };
      } else {
        return {
          success: false,
          message: this.status.error || "Connection failed for unknown reason",
        };
      }
    } catch (error) {
      console.error("MqttService: Connection test failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Notify data callbacks
   */
  private notifyDataCallbacks(): void {
    this.dataCallbacks.forEach((callback) => {
      try {
        callback(this.getCurrentData());
      } catch (error) {
        console.error("MqttService: Error in data callback:", error);
      }
    });
  }

  /**
   * Notify status callbacks
   */
  private notifyStatusCallbacks(): void {
    this.statusCallbacks.forEach((callback) => {
      try {
        callback(this.getStatus());
      } catch (error) {
        console.error("MqttService: Error in status callback:", error);
      }
    });
  }

  /**
   * Destroy service and cleanup resources
   */
  public destroy(): void {
    this.stopPeriodicUpdates();
    this.disconnect();
    this.dataCallbacks = [];
    this.statusCallbacks = [];
    console.log("MqttService: Destroyed");
  }
}

export default MqttService;
