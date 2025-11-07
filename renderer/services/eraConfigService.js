/**
 * E-Ra Configuration Service - JavaScript version
 * Handles E-Ra chip and datastream configuration API calls
 * Provides dynamic sensor mapping instead of hardcoded config IDs
 */

class EraConfigService {
  constructor(authService) {
    this.baseUrl = "https://backend.eoh.io";
    this.chipsEndpoint = "/api/chip_manager/developer_mode_chips/";
    this.configsEndpoint = "/api/chip_manager/configs/";
    this.unitsEndpoint = "/api/property_manager/iot_dashboard/dev_mode/units/";

    this.authService = authService || null;
    this.cachedChips = [];
    this.cachedDatastreams = [];
    this.cachedUnits = [];
    this.currentMapping = {
      temperature: null,
      humidity: null,
      pm25: null,
      pm10: null,
    };

    // Unit ID for air quality API
    this.unitId = null;

    // Scale factor configuration
    this.scaleConfig = {
      scaleFactor: 0.1,
      decimalPlaces: 1,
      appliedSensors: {
        temperature: false,
        humidity: false,
        pm25: false,
        pm10: false,
      },
    };

    console.log("EraConfigService: Initialized");
  }

  /**
   * Set authentication service
   */
  setAuthService(authService) {
    this.authService = authService;
    console.log("EraConfigService: Auth service set");
  }

  /**
   * Get list of available chips from E-Ra platform
   */
  async getChips() {
    try {
      console.log("EraConfigService: Fetching chips from E-Ra platform");

      if (!this.authService || !this.authService.isAuthenticated()) {
        return {
          success: false,
          error: "Not authenticated",
          message: "Please login to E-Ra platform first",
        };
      }

      const chipsUrl = `${this.baseUrl}${this.chipsEndpoint}`;
      const headers = this.authService.getAuthHeaders();

      console.log("EraConfigService: Making request to:", chipsUrl);

      const response = await fetch(chipsUrl, {
        method: "GET",
        headers: headers,
      });

      const responseData = await response.json();
      console.log(
        "EraConfigService: Chips response:",
        response.status,
        responseData
      );

      if (response.ok && responseData) {
        // Parse chips data based on actual API response structure
        const chips = this.parseChipsResponse(responseData);
        this.cachedChips = chips;

        return {
          success: true,
          chips: chips,
          message: `Found ${chips.length} chips`,
        };
      } else {
        console.error("EraConfigService: Failed to fetch chips:", responseData);
        return {
          success: false,
          error:
            responseData.message ||
            responseData.error ||
            "Failed to fetch chips",
          message: "Could not retrieve chip list from E-Ra platform",
        };
      }
    } catch (error) {
      console.error("EraConfigService: Error fetching chips:", error);
      return {
        success: false,
        error: error.message || "Network error",
        message: "Failed to connect to E-Ra platform",
      };
    }
  }

  /**
   * Get datastreams for a specific chip
   */
  async getDatastreams(chipId) {
    try {
      console.log(
        "EraConfigService: Fetching datastreams",
        chipId ? `for chip ${chipId}` : "for all chips"
      );

      if (!this.authService || !this.authService.isAuthenticated()) {
        return {
          success: false,
          error: "Not authenticated",
          message: "Please login to E-Ra platform first",
        };
      }

      const configsUrl = `${this.baseUrl}${this.configsEndpoint}`;
      const headers = this.authService.getAuthHeaders();

      console.log("EraConfigService: Making request to:", configsUrl);

      const response = await fetch(configsUrl, {
        method: "GET",
        headers: headers,
      });

      const responseData = await response.json();
      console.log(
        "EraConfigService: Datastreams response:",
        response.status,
        responseData
      );

      if (response.ok && responseData) {
        // Parse datastreams data based on actual API response structure
        const datastreams = this.parseDatastreamsResponse(responseData, chipId);
        this.cachedDatastreams = datastreams;

        return {
          success: true,
          datastreams: datastreams,
          message: `Found ${datastreams.length} datastreams`,
        };
      } else {
        console.error(
          "EraConfigService: Failed to fetch datastreams:",
          responseData
        );
        return {
          success: false,
          error:
            responseData.message ||
            responseData.error ||
            "Failed to fetch datastreams",
          message: "Could not retrieve datastream list from E-Ra platform",
        };
      }
    } catch (error) {
      console.error("EraConfigService: Error fetching datastreams:", error);
      return {
        success: false,
        error: error.message || "Network error",
        message: "Failed to connect to E-Ra platform",
      };
    }
  }

  /**
   * Get list of available units from E-Ra platform for air quality API
   * Uses direct units API with pagination support
   */
  async getUnits() {
    try {
      console.log("EraConfigService: Fetching units from IoT dashboard API");

      if (!this.authService || !this.authService.isAuthenticated()) {
        return {
          success: false,
          error: "Not authenticated",
          message: "Please login to E-Ra platform first",
        };
      }

      // Get all units with pagination
      const allUnits = await this.getAllUnitsPaginated();
      this.cachedUnits = allUnits;

      return {
        success: true,
        units: allUnits,
        message: `Found ${allUnits.length} units from IoT dashboard API`,
      };
    } catch (error) {
      console.error("EraConfigService: Error getting units:", error);
      return {
        success: false,
        error: error.message || "Network error",
        message: "Failed to get units from IoT dashboard API",
      };
    }
  }

  /**
   * Get all units with pagination support
   */
  async getAllUnitsPaginated() {
    const allUnits = [];
    let nextUrl = `${this.baseUrl}${this.unitsEndpoint}`;
    let pageCount = 0;
    const maxPages = 50; // Safety limit to prevent infinite loops

    while (nextUrl && pageCount < maxPages) {
      pageCount++;
      console.log(
        `EraConfigService: Fetching units page ${pageCount}: ${nextUrl}`
      );

      try {
        const response = await fetch(nextUrl, {
          method: "GET",
          headers: this.authService.getAuthHeaders(),
        });

        const responseData = await response.json();
        console.log(
          `EraConfigService: Units page ${pageCount} response:`,
          response.status,
          {
            count: responseData.count,
            next: !!responseData.next,
            resultsLength: responseData.results
              ? responseData.results.length
              : 0,
          }
        );

        if (!response.ok || !responseData) {
          console.error(
            `EraConfigService: Failed to fetch units page ${pageCount}:`,
            responseData
          );
          break;
        }

        // Parse units from this page
        const pageUnits = this.parseUnitsResponse(responseData);
        allUnits.push(...pageUnits);

        // Check for next page
        nextUrl = responseData.next;

        console.log(
          `EraConfigService: Page ${pageCount} added ${pageUnits.length} units. Total: ${allUnits.length}`
        );
      } catch (error) {
        console.error(
          `EraConfigService: Error fetching units page ${pageCount}:`,
          error
        );
        break;
      }
    }

    if (pageCount >= maxPages) {
      console.warn(
        `EraConfigService: Reached maximum page limit (${maxPages})`
      );
    }

    console.log(
      `EraConfigService: ✅ Fetched ${allUnits.length} total units across ${pageCount} pages`
    );
    return allUnits;
  }

  /**
   * Get complete configuration (chips + all datastreams + units)
   */
  async getCompleteConfig() {
    try {
      console.log("EraConfigService: Fetching complete E-Ra configuration");

      // First get chips
      const chipsResult = await this.getChips();
      if (!chipsResult.success) {
        return chipsResult;
      }

      // Then get all datastreams
      const datastreamsResult = await this.getDatastreams();
      if (!datastreamsResult.success) {
        return datastreamsResult;
      }

      // Finally get units for air quality API
      const unitsResult = await this.getUnits();
      if (!unitsResult.success) {
        console.warn(
          "EraConfigService: Failed to fetch units, continuing without units"
        );
      }

      // Return combined results
      return {
        success: true,
        chips: chipsResult.chips,
        datastreams: datastreamsResult.datastreams,
        units: unitsResult.success ? unitsResult.units : [],
        mapping: this.currentMapping,
        unitId: this.unitId,
        message: `Found ${chipsResult.chips?.length || 0} chips, ${
          datastreamsResult.datastreams?.length || 0
        } datastreams, and ${
          unitsResult.success ? unitsResult.units?.length || 0 : 0
        } units`,
      };
    } catch (error) {
      console.error("EraConfigService: Error fetching complete config:", error);
      return {
        success: false,
        error: error.message || "Unknown error",
        message: "Failed to fetch complete configuration",
      };
    }
  }

  /**
   * Parse chips response from E-Ra API
   */
  parseChipsResponse(responseData) {
    const chips = [];

    try {
      // Handle different possible response structures
      let chipData = responseData;

      // If response has a results array
      if (responseData.results && Array.isArray(responseData.results)) {
        chipData = responseData.results;
      }
      // If response is directly an array
      else if (Array.isArray(responseData)) {
        chipData = responseData;
      }
      // If response has data property
      else if (responseData.data && Array.isArray(responseData.data)) {
        chipData = responseData.data;
      }

      if (Array.isArray(chipData)) {
        chipData.forEach((chip) => {
          chips.push({
            id: chip.id || chip.chip_id || 0,
            name: chip.name || chip.chip_name || `Chip ${chip.id}`,
            description: chip.description || chip.desc || undefined,
            isOnline:
              chip.is_online ||
              chip.online ||
              chip.status === "online" ||
              false,
            lastSeen: chip.last_seen ? new Date(chip.last_seen) : undefined,
            deviceType: chip.device_type || chip.type || undefined,
          });
        });
      }

      console.log(
        `EraConfigService: Parsed ${chips.length} chips from response`
      );
    } catch (error) {
      console.error("EraConfigService: Error parsing chips response:", error);
    }

    return chips;
  }

  /**
   * Parse datastreams response from E-Ra API
   */
  parseDatastreamsResponse(responseData, chipId) {
    const datastreams = [];

    try {
      // Handle different possible response structures
      let streamData = responseData;

      // If response has a results array
      if (responseData.results && Array.isArray(responseData.results)) {
        streamData = responseData.results;
      }
      // If response is directly an array
      else if (Array.isArray(responseData)) {
        streamData = responseData;
      }
      // If response has data property
      else if (responseData.data && Array.isArray(responseData.data)) {
        streamData = responseData.data;
      }

      if (Array.isArray(streamData)) {
        streamData.forEach((stream) => {
          // Filter by chipId if specified
          const streamChipId =
            stream.chip_id || stream.chipId || stream.device_id;
          if (chipId && streamChipId !== chipId) {
            return;
          }

          datastreams.push({
            id: stream.id || stream.config_id || 0,
            chipId: streamChipId || 0,
            name: stream.name || stream.config_name || `Config ${stream.id}`,
            description: stream.description || stream.desc || undefined,
            dataType: stream.data_type || stream.type || "number",
            unit: stream.unit || this.inferUnit(stream.name),
            currentValue: stream.current_value || stream.value || undefined,
            lastUpdated: stream.last_updated
              ? new Date(stream.last_updated)
              : undefined,
            isVirtual: stream.is_virtual || stream.virtual || false,
          });
        });
      }

      console.log(
        `EraConfigService: Parsed ${datastreams.length} datastreams from response`
      );
    } catch (error) {
      console.error(
        "EraConfigService: Error parsing datastreams response:",
        error
      );
    }

    return datastreams;
  }

  /**
   * Extract unique units from datastreams configs data
   */
  /**
   * Convert chips to units format for dropdown selection
   * Each chip represents a potential unit/location for air quality monitoring
   */
  convertChipsToUnits(chips) {
    const units = [];

    try {
      chips.forEach((chip) => {
        units.push({
          id: chip.id.toString(), // Use chip ID as unit ID
          name: chip.name, // Chip name as display name
          description: chip.description || `Chip ${chip.id}`,
          isOnline: chip.isOnline,
          lastSeen: chip.lastSeen,
          deviceType: chip.deviceType,
        });
      });

      // Sort units by name
      units.sort((a, b) => a.name.localeCompare(b.name));

      console.log(
        `EraConfigService: Converted ${units.length} chips to units:`,
        units.map((u) => `${u.name} (ID: ${u.id})`)
      );

      return units;
    } catch (error) {
      console.error(
        "EraConfigService: Error converting chips to units:",
        error
      );
      return [];
    }
  }

  /**
   * Parse units response from E-Ra IoT Dashboard API
   */
  parseUnitsResponse(responseData) {
    const units = [];

    try {
      let unitData = null;

      // Handle different response structures
      if (responseData.units && Array.isArray(responseData.units)) {
        unitData = responseData.units;
      }
      // If response has results property (pagination format)
      else if (responseData.results && Array.isArray(responseData.results)) {
        unitData = responseData.results;
      }
      // If response is directly an array
      else if (Array.isArray(responseData)) {
        unitData = responseData;
      }
      // If response has data property
      else if (responseData.data && Array.isArray(responseData.data)) {
        unitData = responseData.data;
      }

      if (Array.isArray(unitData)) {
        unitData.forEach((unit) => {
          units.push({
            id: unit.id || unit.unit_id || unit.unitId || 0,
            name:
              unit.name || unit.unit_name || unit.unitName || `Unit ${unit.id}`,
            description: unit.description || unit.desc || undefined,
            address: unit.address || undefined,
            type: unit.type || unit.unit_type || undefined,
            status: unit.status || (unit.is_active ? "active" : "inactive"),
            // Additional IoT dashboard specific fields
            location: unit.location || undefined,
            building: unit.building || unit.building_name || undefined,
            floor: unit.floor || unit.floor_name || undefined,
            room: unit.room || unit.room_name || undefined,
            category: unit.category || undefined,
            tags: unit.tags || [],
          });
        });
      }

      console.log(
        `EraConfigService: Parsed ${units.length} units from IoT dashboard response`
      );
    } catch (error) {
      console.error("EraConfigService: Error parsing units response:", error);
    }

    return units;
  }

  /**
   * Infer unit from datastream name
   */
  inferUnit(name) {
    const lowerName = name.toLowerCase();

    if (lowerName.includes("temp") || lowerName.includes("nhiệt")) {
      return "°C";
    } else if (lowerName.includes("hum") || lowerName.includes("ẩm")) {
      return "%";
    } else if (lowerName.includes("pm2.5") || lowerName.includes("pm25")) {
      return "μg/m³";
    } else if (lowerName.includes("pm10")) {
      return "μg/m³";
    } else if (
      lowerName.includes("pressure") ||
      lowerName.includes("áp suất")
    ) {
      return "hPa";
    } else if (lowerName.includes("light") || lowerName.includes("ánh sáng")) {
      return "lux";
    }

    return undefined;
  }

  /**
   * Update sensor mapping configuration
   */
  updateMapping(sensorType, datastreamId) {
    this.currentMapping[sensorType] = datastreamId;
    console.log(
      `EraConfigService: Updated mapping for ${sensorType}:`,
      datastreamId
    );
  }

  /**
   * Get current sensor mapping
   */
  getCurrentMapping() {
    return { ...this.currentMapping };
  }

  /**
   * Set Unit ID for air quality API
   */
  setUnitId(unitId) {
    this.unitId = unitId;
    console.log(`EraConfigService: Updated Unit ID to: ${unitId}`);
  }

  /**
   * Get current Unit ID
   */
  getUnitId() {
    return this.unitId;
  }

  /**
   * Update scale factor configuration
   */
  updateScaleFactor(scaleFactor) {
    this.scaleConfig.scaleFactor = scaleFactor;
    console.log(`EraConfigService: Updated scale factor to: ${scaleFactor}`);
  }

  /**
   * Update decimal places configuration
   */
  updateDecimalPlaces(decimalPlaces) {
    this.scaleConfig.decimalPlaces = decimalPlaces;
    console.log(
      `EraConfigService: Updated decimal places to: ${decimalPlaces}`
    );
  }

  /**
   * Update scale factor applied sensors
   */
  updateScaleAppliedSensors(sensorType, isApplied) {
    this.scaleConfig.appliedSensors[sensorType] = isApplied;
    console.log(
      `EraConfigService: Scale factor ${
        isApplied ? "applied" : "removed"
      } for ${sensorType}`
    );
  }

  /**
   * Get current scale configuration
   */
  getCurrentScaleConfig() {
    return { ...this.scaleConfig };
  }

  /**
   * Auto-detect sensor mappings based on datastream names
   */
  autoDetectMapping() {
    const autoMapping = {
      temperature: null,
      humidity: null,
      pm25: null,
      pm10: null,
    };

    this.cachedDatastreams.forEach((stream) => {
      const lowerName = stream.name.toLowerCase();
      const lowerDesc = (stream.description || "").toLowerCase();

      // Enhanced temperature detection
      if (
        (lowerName.includes("temp") ||
          lowerName.includes("nhiệt") ||
          lowerName.includes("°c") ||
          lowerName.includes("celsius") ||
          lowerDesc.includes("temperature") ||
          lowerDesc.includes("nhiệt độ")) &&
        !autoMapping.temperature
      ) {
        autoMapping.temperature = stream.id;
        console.log(
          `EraConfigService: Auto-detected temperature sensor: ${stream.name} (ID: ${stream.id})`
        );
      }
      // Enhanced humidity detection
      else if (
        (lowerName.includes("hum") ||
          lowerName.includes("ẩm") ||
          lowerName.includes("rh") ||
          lowerName.includes("%") ||
          lowerDesc.includes("humidity") ||
          lowerDesc.includes("độ ẩm")) &&
        !autoMapping.humidity
      ) {
        autoMapping.humidity = stream.id;
        console.log(
          `EraConfigService: Auto-detected humidity sensor: ${stream.name} (ID: ${stream.id})`
        );
      }
      // Enhanced PM2.5 detection
      else if (
        (lowerName.includes("pm2.5") ||
          lowerName.includes("pm25") ||
          lowerName.includes("pm 2.5") ||
          lowerDesc.includes("pm2.5") ||
          lowerDesc.includes("pm 2.5")) &&
        !autoMapping.pm25
      ) {
        autoMapping.pm25 = stream.id;
        console.log(
          `EraConfigService: Auto-detected PM2.5 sensor: ${stream.name} (ID: ${stream.id})`
        );
      }
      // Enhanced PM10 detection
      else if (
        (lowerName.includes("pm10") ||
          lowerName.includes("pm 10") ||
          lowerDesc.includes("pm10") ||
          lowerDesc.includes("pm 10")) &&
        !autoMapping.pm10
      ) {
        autoMapping.pm10 = stream.id;
        console.log(
          `EraConfigService: Auto-detected PM10 sensor: ${stream.name} (ID: ${stream.id})`
        );
      }
    });

    console.log(
      "EraConfigService: Auto-detected mapping complete:",
      autoMapping
    );

    // Apply the detected mapping immediately
    Object.entries(autoMapping).forEach(([sensorType, datastreamId]) => {
      if (datastreamId !== null) {
        this.updateMapping(sensorType, datastreamId);
      }
    });

    return autoMapping;
  }

  /**
   * Auto-detect sensor mappings based on custom keywords
   */
  autoDetectMappingWithKeywords(keywordsString) {
    const autoMapping = {
      temperature: null,
      humidity: null,
      pm25: null,
      pm10: null,
    };

    // Parse keywords from input string (separated by dash)
    const keywords = keywordsString
      .split("-")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    console.log(`EraConfigService: Using keywords for detection:`, keywords);

    this.cachedDatastreams.forEach((stream) => {
      const lowerName = stream.name.toLowerCase();
      const lowerDesc = (stream.description || "").toLowerCase();

      // Check if stream name or description contains any of the keywords
      const nameContainsKeyword = keywords.some(
        (keyword) => lowerName.includes(keyword) || lowerDesc.includes(keyword)
      );

      if (!nameContainsKeyword) {
        return; // Skip if no keywords match
      }

      // Enhanced temperature detection with keywords
      if (
        (lowerName.includes("temp") ||
          lowerName.includes("nhiệt") ||
          lowerName.includes("°c") ||
          lowerName.includes("celsius") ||
          lowerDesc.includes("temperature") ||
          lowerDesc.includes("nhiệt độ") ||
          keywords.some((k) => k.includes("nhiệt") || k.includes("temp"))) &&
        !autoMapping.temperature
      ) {
        autoMapping.temperature = stream.id;
        console.log(
          `EraConfigService: Auto-detected temperature sensor with keywords: ${stream.name} (ID: ${stream.id})`
        );
      }
      // Enhanced humidity detection with keywords
      else if (
        (lowerName.includes("hum") ||
          lowerName.includes("ẩm") ||
          lowerName.includes("rh") ||
          lowerName.includes("%") ||
          lowerDesc.includes("humidity") ||
          lowerDesc.includes("độ ẩm") ||
          keywords.some((k) => k.includes("ẩm") || k.includes("hum"))) &&
        !autoMapping.humidity
      ) {
        autoMapping.humidity = stream.id;
        console.log(
          `EraConfigService: Auto-detected humidity sensor with keywords: ${stream.name} (ID: ${stream.id})`
        );
      }
      // Enhanced PM2.5 detection with keywords
      else if (
        (lowerName.includes("pm2.5") ||
          lowerName.includes("pm25") ||
          lowerName.includes("pm 2.5") ||
          lowerDesc.includes("pm2.5") ||
          lowerDesc.includes("pm 2.5") ||
          keywords.some((k) => k.includes("pm2.5") || k.includes("pm25"))) &&
        !autoMapping.pm25
      ) {
        autoMapping.pm25 = stream.id;
        console.log(
          `EraConfigService: Auto-detected PM2.5 sensor with keywords: ${stream.name} (ID: ${stream.id})`
        );
      }
      // Enhanced PM10 detection with keywords
      else if (
        (lowerName.includes("pm10") ||
          lowerName.includes("pm 10") ||
          lowerDesc.includes("pm10") ||
          lowerDesc.includes("pm 10") ||
          keywords.some((k) => k.includes("pm10"))) &&
        !autoMapping.pm10
      ) {
        autoMapping.pm10 = stream.id;
        console.log(
          `EraConfigService: Auto-detected PM10 sensor with keywords: ${stream.name} (ID: ${stream.id})`
        );
      }
    });

    console.log(
      "EraConfigService: Auto-detected mapping with keywords complete:",
      autoMapping
    );

    // Apply the detected mapping immediately
    Object.entries(autoMapping).forEach(([sensorType, datastreamId]) => {
      if (datastreamId !== null) {
        this.updateMapping(sensorType, datastreamId);
      }
    });

    return autoMapping;
  }

  /**
   * Apply mapping to system configuration
   */
  applyMapping(mapping) {
    this.currentMapping = { ...mapping };
    console.log("EraConfigService: Applied new mapping:", this.currentMapping);
  }

  /**
   * Get cached chips
   */
  getCachedChips() {
    return [...this.cachedChips];
  }

  /**
   * Get cached datastreams
   */
  getCachedDatastreams() {
    return [...this.cachedDatastreams];
  }

  /**
   * Clear cached data (only use when user logs out)
   */
  clearCache() {
    this.cachedChips = [];
    this.cachedDatastreams = [];
    this.currentMapping = {
      temperature: null,
      humidity: null,
      pm25: null,
      pm10: null,
    };
    // Reset scale config to default
    this.scaleConfig = {
      scaleFactor: 0.1,
      decimalPlaces: 1,
      appliedSensors: {
        temperature: false,
        humidity: false,
        pm25: false,
        pm10: false,
      },
    };
    console.log("EraConfigService: Cache cleared");
  }

  /**
   * Clear cache for logout - public method to be called explicitly on logout
   */
  clearCacheOnLogout() {
    this.clearCache();
    console.log("EraConfigService: Cache cleared due to user logout");
  }

  /**
   * Destroy service and cleanup (does NOT clear cache automatically)
   */
  destroy() {
    // DO NOT auto-clear cache on destroy - preserve for tab switching
    this.authService = null;
    console.log("EraConfigService: Destroyed (cache preserved)");
  }
}

// Make available in global scope
if (typeof module !== "undefined" && module.exports) {
  module.exports = EraConfigService;
} else if (typeof window !== "undefined") {
  window.EraConfigService = EraConfigService;
}
