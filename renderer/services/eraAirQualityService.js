/**
 * E-Ra Air Quality API Service
 * Calls E-Ra API endpoint to get air quality data instead of calculation
 * API: GET /property_manager/units/{unit_id}/summary/
 */

class EraAirQualityService {
  constructor(config) {
    this.config = config;
    this.currentData = null;
    this.isUpdating = false;
    this.retryCount = 0;
    this.dataUpdateCallbacks = [];
    this.updateInterval = null;

    console.log("EraAirQualityService: Initialized with config:", {
      baseUrl: config.baseUrl,
      unitId: config.unitId,
      hasAuthToken: !!config.authToken,
    });
  }

  /**
   * Fetch air quality data from E-Ra API
   */
  async fetchAirQualityData() {
    if (this.isUpdating) {
      console.log("EraAirQualityService: Update in progress, skipping");
      return;
    }

    if (!this.config.unitId) {
      console.log(
        "EraAirQualityService: No unit ID configured, skipping API call"
      );
      return;
    }

    this.isUpdating = true;

    try {
      const url = `${this.config.baseUrl}/property_manager/units/${this.config.unitId}/summary/`;

      console.log("EraAirQualityService: Fetching from API:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: this.config.authToken,
          "Content-Type": "application/json",
          "User-Agent": "ITS-Billboard/1.0",
        },
        timeout: this.config.timeout || 15000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data) {
        throw new Error("No air quality data received");
      }

      // Extract air quality information from API response - simplified to Good/Bad only
      this.currentData = {
        status: this.extractSimpleAirQualityStatus(data), // Good or Bad only
        lastUpdated: new Date(),
        source: "era_api",
        rawData: data, // Keep raw data for debugging
      };

      this.retryCount = 0;
      console.log("EraAirQualityService: Data updated successfully", {
        status: this.currentData.status,
        source: this.currentData.source,
      });

      // Notify subscribers
      this.notifyDataUpdateCallbacks();
    } catch (error) {
      console.error("EraAirQualityService: API failed", error);
      this.handleFetchFailure(error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Extract simple air quality status from API response - Good or Bad only
   */
  extractSimpleAirQualityStatus(data) {
    // Check if API provides direct air quality status
    if (data.air_quality?.status) {
      const status = data.air_quality.status.toLowerCase();
      if (
        status.includes("good") ||
        status.includes("tốt") ||
        status.includes("excellent")
      ) {
        return "Good";
      } else {
        return "Bad";
      }
    }

    // Fallback: check PM values if available
    const pm25 = this.extractPM25(data);
    const pm10 = this.extractPM10(data);

    if (pm25 !== null || pm10 !== null) {
      // Simple threshold: if PM2.5 > 25 or PM10 > 50, it's Bad
      if ((pm25 !== null && pm25 > 25) || (pm10 !== null && pm10 > 50)) {
        return "Bad";
      } else {
        return "Good";
      }
    }

    return "Good"; // Default fallback
  }

  /**
   * Extract PM2.5 value from API response (for fallback calculation only)
   */
  extractPM25(data) {
    if (data.air_quality?.pm25 !== undefined) {
      return parseFloat(data.air_quality.pm25);
    }

    if (data.sensors?.pm25 !== undefined) {
      return parseFloat(data.sensors.pm25);
    }

    return null;
  }

  /**
   * Extract PM10 value from API response (for fallback calculation only)
   */
  extractPM10(data) {
    if (data.air_quality?.pm10 !== undefined) {
      return parseFloat(data.air_quality.pm10);
    }

    if (data.sensors?.pm10 !== undefined) {
      return parseFloat(data.sensors.pm10);
    }

    return null;
  }

  /**
   * Handle API fetch failure
   */
  handleFetchFailure(error) {
    this.retryCount++;
    console.error(
      `EraAirQualityService: Failed (${this.retryCount}/${
        this.config.maxRetries || 3
      })`
    );

    if (this.retryCount >= (this.config.maxRetries || 3)) {
      console.error(
        "EraAirQualityService: Max retries reached, using fallback data"
      );
      this.useFallbackData(error);
      this.retryCount = 0;
    }
  }

  /**
   * Use fallback data when API fails
   */
  useFallbackData(error) {
    this.currentData = {
      status: "Good", // Default to Good when API fails
      lastUpdated: new Date(),
      source: "fallback",
      error: error.message,
    };

    console.log("EraAirQualityService: Using fallback air quality data");

    // Notify subscribers about fallback data
    this.notifyDataUpdateCallbacks();
  }

  /**
   * Get current air quality data
   */
  getCurrentData() {
    return this.currentData;
  }

  /**
   * Subscribe to data updates
   */
  onDataUpdate(callback) {
    this.dataUpdateCallbacks.push(callback);

    // Immediately call with current data if available
    if (this.currentData) {
      callback(this.currentData);
    }

    return () => {
      const index = this.dataUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.dataUpdateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all data update callbacks
   */
  notifyDataUpdateCallbacks() {
    this.dataUpdateCallbacks.forEach((callback) => {
      try {
        callback(this.currentData);
      } catch (error) {
        console.error(
          "EraAirQualityService: Error in data update callback:",
          error
        );
      }
    });
  }

  /**
   * Start periodic updates
   */
  startPeriodicUpdates() {
    // Fetch initial data
    this.fetchAirQualityData();

    // Set up interval for periodic updates (every 5 minutes)
    this.updateInterval = setInterval(() => {
      this.fetchAirQualityData();
    }, 5 * 60 * 1000); // 5 minutes

    console.log(
      "EraAirQualityService: Started periodic updates (5 minutes interval)"
    );
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.currentData = null;
    this.dataUpdateCallbacks = [];
    console.log("EraAirQualityService: Stopped periodic updates");
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log("EraAirQualityService: Configuration updated");

    // Restart updates if unit ID changed
    if (newConfig.unitId !== undefined) {
      this.stopPeriodicUpdates();
      if (newConfig.unitId) {
        this.startPeriodicUpdates();
      }
    }
  }

  /**
   * Manual refresh of air quality data
   */
  async refreshData() {
    await this.fetchAirQualityData();
  }
}

// Make available globally
if (typeof window !== "undefined") {
  window.EraAirQualityService = EraAirQualityService;
}

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = EraAirQualityService;
}
