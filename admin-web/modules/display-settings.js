/**
 * Display Settings Module
 * Manages billboard display settings and configuration
 */

import * as uiCore from "./ui-core.js";

const STORAGE_KEY = "billboard-settings";

const DEFAULT_SETTINGS = {
  displayMode: "loop",
  loopDuration: 10,
  fixedBannerIndex: 0,
  scheduledStart: "08:00",
  scheduledEnd: "22:00",
};

export class DisplaySettingsService {
  constructor() {
    this.currentSettings = { ...DEFAULT_SETTINGS };
    this.initialized = false;

    console.log("[DisplaySettings] Initialized");
  }

  /**
   * Load settings from local storage
   */
  async loadSettings() {
    try {
      console.log("[DisplaySettings] Loading settings...");

      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        this.currentSettings = {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(saved),
        };
      }

      this.applySettingsToUI();
      this.initialized = true;

      console.log("[DisplaySettings] Settings loaded:", this.currentSettings);
    } catch (error) {
      console.error("[DisplaySettings] Failed to load settings:", error);
      uiCore.showToast("Error loading settings: " + error.message, "error");
    }
  }

  /**
   * Apply settings to UI elements
   */
  applySettingsToUI() {
    const displayModeEl = document.getElementById("displayMode");
    const loopDurationEl = document.getElementById("loopDuration");
    const fixedBannerEl = document.getElementById("fixedBannerIndex");
    const scheduledStartEl = document.getElementById("scheduledStart");
    const scheduledEndEl = document.getElementById("scheduledEnd");

    if (displayModeEl) displayModeEl.value = this.currentSettings.displayMode;
    if (loopDurationEl)
      loopDurationEl.value = this.currentSettings.loopDuration;
    if (fixedBannerEl)
      fixedBannerEl.value = this.currentSettings.fixedBannerIndex;
    if (scheduledStartEl)
      scheduledStartEl.value = this.currentSettings.scheduledStart;
    if (scheduledEndEl)
      scheduledEndEl.value = this.currentSettings.scheduledEnd;

    console.log("[DisplaySettings] UI updated");
  }

  /**
   * Sync settings to storage and MQTT
   */
  async syncSettings() {
    try {
      console.log("[DisplaySettings] Syncing settings...");

      // Get current values from UI
      const displayModeEl = document.getElementById("displayMode");
      const loopDurationEl = document.getElementById("loopDuration");
      const fixedBannerEl = document.getElementById("fixedBannerIndex");
      const scheduledStartEl = document.getElementById("scheduledStart");
      const scheduledEndEl = document.getElementById("scheduledEnd");

      this.currentSettings = {
        displayMode: displayModeEl?.value || "loop",
        loopDuration: parseInt(loopDurationEl?.value || 10),
        fixedBannerIndex: parseInt(fixedBannerEl?.value || 0),
        scheduledStart: scheduledStartEl?.value || "08:00",
        scheduledEnd: scheduledEndEl?.value || "22:00",
        lastUpdated: new Date().toISOString(),
      };

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSettings));

      // Send MQTT notification
      try {
        if (window.MqttClient && window.MqttClient.publishSettingsSync) {
          await window.MqttClient.publishSettingsSync(this.currentSettings);
          console.log("[DisplaySettings] MQTT sync sent");
        }
      } catch (error) {
        console.warn("[DisplaySettings] Failed to publish MQTT sync:", error);
      }

      uiCore.showToast("Settings synced successfully", "success");
      console.log("[DisplaySettings] Settings synced:", this.currentSettings);
    } catch (error) {
      console.error("[DisplaySettings] Failed to sync settings:", error);
      uiCore.showToast("Error syncing settings: " + error.message, "error");
    }
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.currentSettings };
  }

  /**
   * Update single setting
   */
  updateSetting(key, value) {
    if (key in this.currentSettings) {
      this.currentSettings[key] = value;
      console.log(`[DisplaySettings] Setting updated: ${key} = ${value}`);
    }
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults() {
    const confirmed = await uiCore.showConfirmation(
      "Reset Settings",
      "Are you sure you want to reset all settings to defaults?"
    );

    if (!confirmed) return;

    try {
      this.currentSettings = { ...DEFAULT_SETTINGS };
      localStorage.removeItem(STORAGE_KEY);

      this.applySettingsToUI();
      await this.syncSettings();

      uiCore.showToast("Settings reset to defaults", "success");
      console.log("[DisplaySettings] Reset to defaults");
    } catch (error) {
      console.error("[DisplaySettings] Failed to reset settings:", error);
      uiCore.showToast("Error resetting settings: " + error.message, "error");
    }
  }

  /**
   * Export settings as JSON
   */
  exportSettings() {
    try {
      const dataStr = JSON.stringify(this.currentSettings, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `billboard-settings-${Date.now()}.json`;
      link.click();

      URL.revokeObjectURL(url);

      uiCore.showToast("Settings exported successfully", "success");
      console.log("[DisplaySettings] Settings exported");
    } catch (error) {
      console.error("[DisplaySettings] Failed to export settings:", error);
      uiCore.showToast("Error exporting settings: " + error.message, "error");
    }
  }

  /**
   * Import settings from JSON
   */
  async importSettings(file) {
    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      // Validate imported settings
      const validated = {
        ...DEFAULT_SETTINGS,
        ...imported,
      };

      this.currentSettings = validated;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));

      this.applySettingsToUI();
      await this.syncSettings();

      uiCore.showToast("Settings imported successfully", "success");
      console.log("[DisplaySettings] Settings imported");
    } catch (error) {
      console.error("[DisplaySettings] Failed to import settings:", error);
      uiCore.showToast("Error importing settings: " + error.message, "error");
    }
  }

  /**
   * Get display mode
   */
  getDisplayMode() {
    return this.currentSettings.displayMode;
  }

  /**
   * Set display mode
   */
  setDisplayMode(mode) {
    const validModes = ["loop", "fixed", "scheduled"];
    if (validModes.includes(mode)) {
      this.currentSettings.displayMode = mode;
      console.log("[DisplaySettings] Display mode changed:", mode);
    }
  }

  /**
   * Get loop duration
   */
  getLoopDuration() {
    return this.currentSettings.loopDuration;
  }

  /**
   * Set loop duration
   */
  setLoopDuration(duration) {
    const numDuration = parseInt(duration);
    if (numDuration > 0) {
      this.currentSettings.loopDuration = numDuration;
      console.log("[DisplaySettings] Loop duration changed:", numDuration);
    }
  }

  /**
   * Get scheduled time range
   */
  getScheduledTimeRange() {
    return {
      start: this.currentSettings.scheduledStart,
      end: this.currentSettings.scheduledEnd,
    };
  }

  /**
   * Set scheduled time range
   */
  setScheduledTimeRange(start, end) {
    this.currentSettings.scheduledStart = start;
    this.currentSettings.scheduledEnd = end;
    console.log("[DisplaySettings] Scheduled time range changed:", {
      start,
      end,
    });
  }

  /**
   * Is initialized
   */
  isInitialized() {
    return this.initialized;
  }
}
