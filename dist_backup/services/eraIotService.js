"use strict";
/**
 * E-Ra IoT Platform Service
 * Uses MQTT for real-time sensor data (temperature, humidity, pm25, pm10)
 * Maintains API-based authentication and config management
 *
 * Based on E-Ra MQTT documentation:
 * - MQTT broker: mqtt1.eoh.io:1883
 * - Topic pattern: eoh/chip/{token}/config/+
 * - Authentication: username={token}, password={token}
 * - Real-time data streaming instead of polling API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mqttService_1 = __importDefault(require("./mqttService"));
class EraIotService {
    constructor(config) {
        this.mqttService = null;
        this.currentData = null;
        this.mqttDataUnsubscribe = null;
        this.mqttStatusUnsubscribe = null;
        this.dataUpdateCallbacks = [];
        this.statusUpdateCallbacks = [];
        this.config = config;
        this.initializeMqttService();
        console.log("EraIotService: Initialized with config", config);
    }
    /**
     * Update authentication token dynamically
     * This method is called when user successfully logs in
     */
    updateAuthToken(newAuthToken) {
        console.log("EraIotService: Updating auth token");
        this.config.authToken = newAuthToken;
        // Reinitialize MQTT service with new token
        this.destroy();
        this.initializeMqttService();
        // Automatically start connection with new token
        this.startPeriodicUpdates().catch((error) => {
            console.error("EraIotService: Failed to start with new token:", error);
        });
    }
    initializeMqttService() {
        try {
            console.log("EraIotService: Successfully extracted gateway token");
            const mqttConfig = {
                enabled: this.config.enabled,
                gatewayToken,
                authToken: this.config.authToken, // Keep for compatibility
                sensorConfigs: this.config.sensorConfigs,
                options: {
                    keepalive: 60,
                    connectTimeout: this.config.timeout,
                    reconnectPeriod: this.config.retryDelay,
                    clean: true,
                },
            };
            console.log("EraIotService: Creating MQTT service with config", {
                enabled: mqttConfig.enabled,
                gatewayToken: gatewayToken.substring(0, 10) + "...",
                sensorConfigs: mqttConfig.sensorConfigs,
            });
            this.mqttService = new mqttService_1.default(mqttConfig);
            // Subscribe to MQTT data updates
            this.mqttDataUnsubscribe = this.mqttService.onDataUpdate((mqttData) => {
                this.handleMqttData(mqttData);
            });
            // Subscribe to MQTT status updates
            this.mqttStatusUnsubscribe = this.mqttService.onStatusUpdate((status) => {
                console.log("EraIotService: MQTT status update:", status);
                this.notifyStatusUpdateCallbacks();
            });
        }
        catch (error) {
            console.error("EraIotService: Failed to initialize MQTT service:", error);
        }
    }
    /**
     * Handle MQTT data and convert to EraIotData format
     */
    handleMqttData(mqttData) {
        this.currentData = {
            temperature: mqttData.temperature,
            humidity: mqttData.humidity,
            pm25: mqttData.pm25,
            pm10: mqttData.pm10,
            lastUpdated: mqttData.timestamp,
            status: this.determineMqttDataStatus(mqttData),
            errorMessage: undefined,
        };
        console.log("EraIotService: Updated data from MQTT:", {
            temperature: this.currentData.temperature,
            humidity: this.currentData.humidity,
            pm25: this.currentData.pm25,
            pm10: this.currentData.pm10,
            status: this.currentData.status,
        });
        // Immediately notify all subscribed components of data updates
        this.notifyDataUpdateCallbacks();
    }
    /**
     * Determine data status based on MQTT data completeness
     */
    determineMqttDataStatus(mqttData) {
        const validValues = [
            mqttData.temperature,
            mqttData.humidity,
            mqttData.pm25,
            mqttData.pm10,
        ].filter((value) => value !== null).length;
        if (validValues === 4)
            return "success";
        if (validValues > 0)
            return "partial";
        return "error";
    }
    /**
     * Notify all data update callbacks with current data
     */
    notifyDataUpdateCallbacks() {
        if (!this.currentData)
            return;
        this.dataUpdateCallbacks.forEach((callback) => {
            try {
                callback(this.currentData);
            }
            catch (error) {
                console.error("EraIotService: Error in data update callback:", error);
            }
        });
    }
    /**
     * Notify all status update callbacks
     */
    notifyStatusUpdateCallbacks() {
        const status = this.getStatus();
        this.statusUpdateCallbacks.forEach((callback) => {
            try {
                callback(status);
            }
            catch (error) {
                console.error("EraIotService: Error in status update callback:", error);
            }
        });
    }
    /**
     * Start MQTT connection and data streaming
     */
    async startPeriodicUpdates() {
        if (!this.mqttService) {
            console.error("EraIotService: MQTT service not initialized");
            return;
        }
        try {
            console.log("EraIotService: Starting MQTT connection...");
            await this.mqttService.connect();
            console.log("EraIotService: Started MQTT-based sensor data service");
            console.log("EraIotService: Started MQTT callback updates every 1 second for real-time UI responsiveness");
        }
        catch (error) {
            console.error("EraIotService: Failed to start MQTT connection:", error);
        }
    }
    /**
     * Stop MQTT connection
     */
    async stopPeriodicUpdates() {
        if (this.mqttService) {
            await this.mqttService.disconnect();
            console.log("EraIotService: Stopped MQTT connection");
        }
    }
    /**
     * Get fallback data when MQTT connection fails
     */
    getFallbackData() {
        return {
            temperature: null,
            humidity: null,
            pm25: 15.0, // Fallback PM2.5 value
            pm10: 25.0, // Fallback PM10 value
            lastUpdated: new Date(),
            status: "error",
            errorMessage: "MQTT connection failed - using fallback data",
        };
    }
    /**
     * Get current sensor data
     */
    getCurrentData() {
        return this.currentData;
    }
    /**
     * Manual refresh of sensor data (forces MQTT reconnection)
     */
    async refreshData() {
        console.log("EraIotService: Manual refresh requested - reconnecting MQTT");
        if (this.mqttService) {
            await this.mqttService.disconnect();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await this.mqttService.connect();
        }
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.authToken || newConfig.baseUrl) {
            // Reinitialize MQTT service with new config
            this.destroy();
            this.initializeMqttService();
        }
        console.log("EraIotService: Configuration updated");
    }
    /**
     * Get service status
     */
    getStatus() {
        const mqttStatus = this.mqttService?.getStatus();
        return {
            isRunning: mqttStatus?.connected || false,
            lastUpdate: this.currentData?.lastUpdated || null,
            retryCount: mqttStatus?.reconnectAttempts || 0,
            currentStatus: this.currentData?.status || "inactive",
        };
    }
    /**
     * Subscribe to real-time data updates (called every second)
     * @param callback Function to call when data is updated
     * @returns Unsubscribe function
     */
    onDataUpdate(callback) {
        this.dataUpdateCallbacks.push(callback);
        // Immediately call with current data if available
        if (this.currentData) {
            try {
                callback(this.currentData);
            }
            catch (error) {
                console.error("EraIotService: Error in initial data callback:", error);
            }
        }
        return () => {
            const index = this.dataUpdateCallbacks.indexOf(callback);
            if (index > -1) {
                this.dataUpdateCallbacks.splice(index, 1);
            }
        };
    }
    /**
     * Subscribe to service status updates
     * @param callback Function to call when status changes
     * @returns Unsubscribe function
     */
    onStatusUpdate(callback) {
        this.statusUpdateCallbacks.push(callback);
        // Immediately call with current status
        try {
            callback(this.getStatus());
        }
        catch (error) {
            console.error("EraIotService: Error in initial status callback:", error);
        }
        return () => {
            const index = this.statusUpdateCallbacks.indexOf(callback);
            if (index > -1) {
                this.statusUpdateCallbacks.splice(index, 1);
            }
        };
    }
    /**
     * Test MQTT connection
     */
    async testConnection() {
        try {
            console.log("EraIotService: Testing E-RA MQTT connection...");
            // Validate AUTHTOKEN format
            if (!this.config.authToken ||
                this.config.authToken.includes("1234272955")) {
                return {
                    success: false,
                    message: "Invalid AUTHTOKEN - please use your real AUTHTOKEN from E-Ra platform",
                };
            }
            if (!this.mqttService) {
                return {
                    success: false,
                    message: "MQTT service not initialized",
                };
            }
            // Test MQTT connection
            const result = await this.mqttService.testConnection();
            return result;
        }
        catch (error) {
            console.error("EraIotService: MQTT connection test failed:", error);
            return {
                success: false,
                message: `MQTT connection failed: ${error.message}`,
            };
        }
    }
    /**
     * Clean up resources
     */
    destroy() {
        if (this.mqttDataUnsubscribe) {
            this.mqttDataUnsubscribe();
            this.mqttDataUnsubscribe = null;
        }
        if (this.mqttStatusUnsubscribe) {
            this.mqttStatusUnsubscribe();
            this.mqttStatusUnsubscribe = null;
        }
        if (this.mqttService) {
            this.mqttService.destroy();
            this.mqttService = null;
        }
        // Clear all component callbacks
        this.dataUpdateCallbacks = [];
        this.statusUpdateCallbacks = [];
        this.currentData = null;
        console.log("EraIotService: Destroyed");
    }
}
exports.default = EraIotService;
