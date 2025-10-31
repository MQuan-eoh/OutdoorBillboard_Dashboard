/**
 * Device Control Service
 * Handles update and reset commands for billboard device
 */

import { MQTT_TOPICS } from "../config/mqtt.js";

export class DeviceControlService {
  constructor(mqttBroker) {
    this.mqtt = mqttBroker;
    this.updateInProgress = false;
    this.currentUpdateVersion = null;
    this.updateStartTime = null;
  }

  /**
   * Trigger device update
   */
  async triggerUpdate(version) {
    if (!this.mqtt || !this.mqtt.connected) {
      throw new Error("MQTT not connected");
    }

    if (this.updateInProgress) {
      throw new Error("Update already in progress");
    }

    try {
      this.updateInProgress = true;
      this.currentUpdateVersion = version;
      this.updateStartTime = Date.now();

      console.log(`[DeviceControl] Triggering update to v${version}`);

      const message = {
        action: "force_update",
        version: version,
        timestamp: Date.now(),
        source: "admin_web",
      };

      await this.mqtt.publish(MQTT_TOPICS.commands, message);
      console.log(`[DeviceControl] Update command sent`);

      return true;
    } catch (error) {
      console.error("[DeviceControl] Update error:", error);
      this.updateInProgress = false;
      throw error;
    }
  }

  /**
   * Trigger device reset
   */
  async triggerReset(reason = "manual") {
    if (!this.mqtt || !this.mqtt.connected) {
      throw new Error("MQTT not connected");
    }

    try {
      console.log("[DeviceControl] Triggering reset...");

      const message = {
        action: "reset_app",
        reason: reason,
        timestamp: Date.now(),
        source: "admin_web",
      };

      await this.mqtt.publish(MQTT_TOPICS.commands, message);
      console.log("[DeviceControl] Reset command sent");

      return true;
    } catch (error) {
      console.error("[DeviceControl] Reset error:", error);
      throw error;
    }
  }

  /**
   * Handle update status from device
   */
  handleUpdateStatus(status) {
    if (!this.updateInProgress) return;

    console.log("[DeviceControl] Update status:", status);

    switch (status.status) {
      case "downloading":
        // Progress update
        break;
      case "update_success":
        // Download completed
        console.log("[DeviceControl] Update download successful");
        break;
      case "error":
        // Update failed
        this.updateInProgress = false;
        this.currentUpdateVersion = null;
        console.error("[DeviceControl] Update failed:", status.error);
        break;
    }
  }

  /**
   * Handle reset status from device
   */
  handleResetStatus(status) {
    console.log("[DeviceControl] Reset status:", status);

    if (status.status === "reset_success") {
      this.updateInProgress = false;
      this.currentUpdateVersion = null;
      console.log("[DeviceControl] Reset completed");
    }
  }

  /**
   * Get update status
   */
  getUpdateStatus() {
    return {
      inProgress: this.updateInProgress,
      version: this.currentUpdateVersion,
      startTime: this.updateStartTime,
      elapsed: this.updateStartTime ? Date.now() - this.updateStartTime : 0,
    };
  }

  /**
   * Cancel update
   */
  cancel() {
    this.updateInProgress = false;
    this.currentUpdateVersion = null;
    console.log("[DeviceControl] Update cancelled");
  }
}
