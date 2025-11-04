/**
 * E-Ra Configuration Service
 * Handles E-Ra chip and datastream configuration API calls
 * Provides dynamic sensor mapping instead of hardcoded config IDs
 */

import EraAuthService, { EraAuthState } from "./eraAuthService";

export interface EraChip {
  id: number;
  name: string;
  description?: string;
  isOnline: boolean;
  lastSeen?: Date;
  deviceType?: string;
}

export interface EraDatastream {
  id: number;
  chipId: number;
  name: string;
  description?: string;
  dataType: string;
  unit?: string;
  currentValue?: number;
  lastUpdated?: Date;
  isVirtual?: boolean;
}

export interface EraConfigMapping {
  temperature: number | null;
  humidity: number | null;
  pm25: number | null;
  pm10: number | null;
}

export interface EraConfigResponse {
  success: boolean;
  chips?: EraChip[];
  datastreams?: EraDatastream[];
  error?: string;
  message?: string;
}

class EraConfigService {
  private readonly baseUrl: string = "https://backend.eoh.io";
  private readonly chipsEndpoint: string =
    "/api/chip_manager/developer_mode_chips/";
  private readonly configsEndpoint: string = "/api/chip_manager/configs/";

  private authService: EraAuthService | null = null;
  private cachedChips: EraChip[] = [];
  private cachedDatastreams: EraDatastream[] = [];
  private currentMapping: EraConfigMapping = {
    temperature: null,
    humidity: null,
    pm25: null,
    pm10: null,
  };

  constructor(authService?: EraAuthService) {
    this.authService = authService || null;
    console.log("EraConfigService: Initialized");
  }

  /**
   * Set authentication service
   */
  public setAuthService(authService: EraAuthService): void {
    this.authService = authService;
    console.log("EraConfigService: Auth service set");
  }

  /**
   * Get list of available chips from E-Ra platform
   */
  public async getChips(): Promise<EraConfigResponse> {
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
        error: error instanceof Error ? error.message : "Network error",
        message: "Failed to connect to E-Ra platform",
      };
    }
  }

  /**
   * Get datastreams for a specific chip
   */
  public async getDatastreams(chipId?: number): Promise<EraConfigResponse> {
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
        error: error instanceof Error ? error.message : "Network error",
        message: "Failed to connect to E-Ra platform",
      };
    }
  }

  /**
   * Get complete configuration (chips + all datastreams)
   */
  public async getCompleteConfig(): Promise<
    EraConfigResponse & { mapping?: EraConfigMapping }
  > {
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

      // Return combined results
      return {
        success: true,
        chips: chipsResult.chips,
        datastreams: datastreamsResult.datastreams,
        mapping: this.currentMapping,
        message: `Found ${chipsResult.chips?.length || 0} chips and ${
          datastreamsResult.datastreams?.length || 0
        } datastreams`,
      };
    } catch (error) {
      console.error("EraConfigService: Error fetching complete config:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to fetch complete configuration",
      };
    }
  }

  /**
   * Parse chips response from E-Ra API
   */
  private parseChipsResponse(responseData: any): EraChip[] {
    const chips: EraChip[] = [];

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
        chipData.forEach((chip: any) => {
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
  private parseDatastreamsResponse(
    responseData: any,
    chipId?: number
  ): EraDatastream[] {
    const datastreams: EraDatastream[] = [];

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
        streamData.forEach((stream: any) => {
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
   * Infer unit from datastream name
   */
  private inferUnit(name: string): string | undefined {
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
  public updateMapping(
    sensorType: keyof EraConfigMapping,
    datastreamId: number | null
  ): void {
    this.currentMapping[sensorType] = datastreamId;
    console.log(
      `EraConfigService: Updated mapping for ${sensorType}:`,
      datastreamId
    );
  }

  /**
   * Get current sensor mapping
   */
  public getCurrentMapping(): EraConfigMapping {
    return { ...this.currentMapping };
  }

  /**
   * Auto-detect sensor mappings based on datastream names
   */
  public autoDetectMapping(): EraConfigMapping {
    const autoMapping: EraConfigMapping = {
      temperature: null,
      humidity: null,
      pm25: null,
      pm10: null,
    };

    this.cachedDatastreams.forEach((stream) => {
      const lowerName = stream.name.toLowerCase();

      if (
        (lowerName.includes("temp") || lowerName.includes("nhiệt")) &&
        !autoMapping.temperature
      ) {
        autoMapping.temperature = stream.id;
      } else if (
        (lowerName.includes("hum") || lowerName.includes("ẩm")) &&
        !autoMapping.humidity
      ) {
        autoMapping.humidity = stream.id;
      } else if (
        (lowerName.includes("pm2.5") || lowerName.includes("pm25")) &&
        !autoMapping.pm25
      ) {
        autoMapping.pm25 = stream.id;
      } else if (lowerName.includes("pm10") && !autoMapping.pm10) {
        autoMapping.pm10 = stream.id;
      }
    });

    console.log("EraConfigService: Auto-detected mapping:", autoMapping);
    return autoMapping;
  }

  /**
   * Apply mapping to system configuration
   */
  public applyMapping(mapping: EraConfigMapping): void {
    this.currentMapping = { ...mapping };
    console.log("EraConfigService: Applied new mapping:", this.currentMapping);
  }

  /**
   * Get cached chips
   */
  public getCachedChips(): EraChip[] {
    return [...this.cachedChips];
  }

  /**
   * Get cached datastreams
   */
  public getCachedDatastreams(): EraDatastream[] {
    return [...this.cachedDatastreams];
  }

  /**
   * Clear cached data
   */
  public clearCache(): void {
    this.cachedChips = [];
    this.cachedDatastreams = [];
    console.log("EraConfigService: Cache cleared");
  }

  /**
   * Destroy service and cleanup
   */
  public destroy(): void {
    this.clearCache();
    this.authService = null;
    console.log("EraConfigService: Destroyed");
  }
}

export default EraConfigService;
