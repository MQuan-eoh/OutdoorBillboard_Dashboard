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

/**
 * E-Ra IoT Platform Service
 * Uses IPC to communicate with Main Process for real-time sensor data
 *
 * This service acts as a bridge between the React components and the
 * Electron Main Process which handles the actual MQTT connection.
 */

export interface EraIotData {
  temperature: number | null;
  humidity: number | null;
  pm25: number | null;
  pm10: number | null;
  lastUpdated: Date;
  status: "success" | "partial" | "error";
  errorMessage?: string;
}

export interface EraIotConfig {
  enabled?: boolean;
  authToken: string; // E-RA authentication token for API calls
  gatewayToken: string; // E-RA gateway token for MQTT authentication
  baseUrl: string; // E-RA API base URL
  sensorConfigs: {
    temperature: number | null;
    humidity: number | null;
    pm25: number | null;
    pm10: number | null;
  };
  scaleConfig?: {
    scaleFactor: number;
    appliedSensors: {
      temperature: boolean;
      humidity: boolean;
      pm25: boolean;
      pm10: boolean;
    };
  };
  updateInterval: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  unitId?: string; // Add unitId for type compatibility
}

class EraIotService {
  private config: EraIotConfig;
  private currentData: EraIotData | null = null;
  private isInitialized: boolean = false;
  private dataUpdateCallbacks: ((data: EraIotData) => void)[] = [];
  private statusUpdateCallbacks: ((status: any) => void)[] = [];

  constructor(config: EraIotConfig) {
    this.config = config;
    
    console.log("EraIotService: Initializing with IPC-based communication");
    console.log("EraIotService: Config:", {
      enabled: config.enabled,
      authToken: config.authToken ? config.authToken.substring(0, 20) + "..." : "none",
      // sensorConfigs: config.sensorConfigs,
    });
  }

  /**
   * Start listening for updates from the Main Process
   */
  public async startPeriodicUpdates(): Promise<void> {
    console.log("EraIotService: Starting IPC-based connection...");
    
    try {
      // Set up IPC listeners for data from main process
      this.setupIpcListeners();
      
      // Get initial data from main process
      await this.fetchInitialData();
      
      console.log("EraIotService: Started IPC-based sensor data service");
      console.log("EraIotService: Listening for updates from Main Process");
      this.isInitialized = true;
      
    } catch (error: any) {
      console.error("EraIotService: Failed to start IPC connection:", error);
      this.useFallbackData(error);
    }
  }

  private setupIpcListeners(): void {
    if (!window.electronAPI) {
      console.error("EraIotService: electronAPI not available");
      return;
    }

    // Listen for data updates from main process
    window.electronAPI.onEraIotDataUpdate((_event: any, data: any) => {
      // console.log("EraIotService: Received data update from main process:", data);
      
      // Convert raw data to EraIotData if needed, or use as is
      this.handleIncomingData(data);
    });

    // Listen for status updates from main process
    window.electronAPI.onEraIotStatusUpdate((_event: any, status: any) => {
      console.log("EraIotService: Received status update from main process:", status);
      this.notifyStatusUpdateCallbacks(status);
    });

    console.log("EraIotService: IPC listeners established");
  }
  
  private handleIncomingData(data: any): void {
      // Ensure dates are parsed back to Date objects if they come as strings
      const processedData: EraIotData = {
          ...data,
          lastUpdated: new Date(data.lastUpdated)
      };
      
      this.currentData = processedData;
      this.notifyDataUpdateCallbacks();
  }

  private async fetchInitialData(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error("electronAPI not available");
    }

    try {
      // Currently getEraIotData returns any, assuming it matches the structure
      const data = await window.electronAPI.getEraIotData();
      if (data) {
        console.log("EraIotService: Retrieved initial data from main process");
        this.handleIncomingData(data);
      } else {
        console.log("EraIotService: No initial data available from main process");
      }
    } catch (error) {
      console.error("EraIotService: Failed to fetch initial data:", error);
      throw error;
    }
  }

  public stopPeriodicUpdates(): void {
    // Remove IPC listeners
    if (window.electronAPI) {
      window.electronAPI.removeEraIotDataListener();
      window.electronAPI.removeEraIotStatusListener();
    }
    
    this.isInitialized = false;
    console.log("EraIotService: Stopped IPC-based updates");
  }

  private useFallbackData(error: Error): void {
    this.currentData = {
      temperature: null,
      humidity: null,
      pm25: 15.0, // Default safe value
      pm10: 25.0, // Default safe value
      lastUpdated: new Date(),
      status: "error",
      errorMessage: `IPC Connection failed: ${error.message || "Unknown error"}`,
    };
    
    // Notify callbacks about fallback data
    this.notifyDataUpdateCallbacks();
    
    console.log("EraIotService: Using fallback sensor data");
  }

  public getCurrentData(): EraIotData | null {
    return this.currentData;
  }

  public async refreshData(): Promise<void> {
    console.log("EraIotService: Manual refresh requested - triggering main process refresh");
    
    if (!window.electronAPI) {
      console.error("EraIotService: electronAPI not available for refresh");
      return;
    }

    try {
      const result = await window.electronAPI.refreshEraIotConnection();
      if (result.success) {
        console.log("EraIotService: Main process refresh command sent successfully");
        // Data will come through IPC listeners
      } else {
        console.error("EraIotService: Main process refresh failed:", result.message);
      }
    } catch (error) {
      console.error("EraIotService: Failed to trigger main process refresh:", error);
    }
  }

  public destroy(): void {
    this.stopPeriodicUpdates();
    this.currentData = null;
    this.dataUpdateCallbacks = [];
    this.statusUpdateCallbacks = [];
    console.log("EraIotService: Destroyed");
  }

  // Notify all data update callbacks with current data
  private notifyDataUpdateCallbacks(): void {
    if (!this.currentData) return;

    this.dataUpdateCallbacks.forEach((callback) => {
      try {
        callback(this.currentData!);
      } catch (error) {
        console.error("EraIotService: Error in data update callback:", error);
      }
    });
  }

  // Notify all status update callbacks
  private notifyStatusUpdateCallbacks(status: any): void {
    this.statusUpdateCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error("EraIotService: Error in status update callback:", error);
      }
    });
  }

  // Subscribe to real-time data updates
  public onDataUpdate(callback: (data: EraIotData) => void): () => void {
    this.dataUpdateCallbacks.push(callback);

    // Immediately call with current data if available
    if (this.currentData) {
      try {
        callback(this.currentData);
      } catch (error) {
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

  // Subscribe to service status updates
  public onStatusUpdate(callback: (status: any) => void): () => void {
    this.statusUpdateCallbacks.push(callback);

    // Immediately call with current status
    try {
      callback(this.getStatus());
    } catch (error) {
      console.error("EraIotService: Error in initial status callback:", error);
    }

    return () => {
      const index = this.statusUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusUpdateCallbacks.splice(index, 1);
      }
    };
  }

  public getStatus(): {
    isRunning: boolean;
    lastUpdate: Date | null;
    retryCount: number;
    currentStatus: EraIotData["status"] | "inactive";
  } {
    return {
      isRunning: this.isInitialized,
      lastUpdate: this.currentData?.lastUpdated || null,
      retryCount: 0,
      currentStatus: this.currentData?.status || "inactive",
    };
  }

  public async testConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    console.log("EraIotService: Testing connection via IPC");
    
    if (!window.electronAPI) {
      return {
        success: false,
        message: "Electron API not available",
      };
    }

    try {
      const result = await window.electronAPI.refreshEraIotConnection();
      return {
        success: result.success,
        message: result.message || (result.success ? "Connected successfully" : "Connection failed"),
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
      };
    }
  }

  // Compatibility method for existing code
  public updateAuthToken(newAuthToken: string): void {
      console.log("EraIotService: updateAuthToken called (IPC mode handles this via Main process config)");
      this.config.authToken = newAuthToken;
      // In IPC mode, we expect the main process to be updated separately or re-init happens
      // No manual MQTT reconnection needed here as it's handled by Main
  }
}

export default EraIotService;
