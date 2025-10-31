/**
 * Update Service - Refactored (Pure Business Logic)
 * 
 * This is the CORE service layer without UI dependencies
 * Handles ONLY:
 * - Version validation
 * - MQTT communication
 * - Status tracking
 * - Event emission
 * 
 * UI handling moved to UpdateUIController
 */

class UpdateService {
  constructor() {
    this.currentUpdateVersion = null;
    this.updateInProgress = false;
    this.updateStartTime = null;
    this.listeners = {};

    console.log("[UpdateService] Initialized (Core Service)");
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Emit event to all listeners
   */
  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[UpdateService] Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Start update with version
   */
  async triggerUpdate(version) {
    // Validation
    if (!version || version.trim() === "") {
      this._emit("error", {
        message: "Vui lòng nhập phiên bản muốn cập nhật",
        code: "INVALID_VERSION",
      });
      return false;
    }

    if (this.updateInProgress) {
      this._emit("error", {
        message: "Đang cập nhật, vui lòng chờ...",
        code: "UPDATE_IN_PROGRESS",
      });
      return false;
    }

    try {
      this.updateInProgress = true;
      this.currentUpdateVersion = version;
      this.updateStartTime = Date.now();

      console.log(`[UpdateService] Initiating update to v${version}`);

      // Emit initializing event
      this._emit("statusChange", {
        status: "initializing",
        version: version,
        message: "Bắt đầu cập nhật...",
      });

      // Validate MQTT connection
      if (!window.MqttClient || !window.MqttClient.connected) {
        throw new Error("MQTT not connected - Cannot send update command");
      }

      // Send force_update command via MQTT
      await window.MqttClient.publish("its/billboard/commands", {
        action: "force_update",
        version: version,
        timestamp: Date.now(),
        source: "admin_web",
      });

      console.log(`[UpdateService] force_update command sent for v${version}`);

      // Emit downloading event
      this._emit("statusChange", {
        status: "downloading",
        version: version,
        message: "Đang tải bản cập nhật...",
      });

      return true;
    } catch (error) {
      console.error("[UpdateService] Error triggering update:", error);
      this._emit("error", {
        message: error.message || "Không thể bắt đầu cập nhật",
        code: "TRIGGER_FAILED",
      });
      this.updateInProgress = false;
      return false;
    }
  }

  /**
   * Handle update status from device
   */
  handleUpdateStatus(status) {
    console.log("[UpdateService] Received update status:", status);

    if (!this.updateInProgress) {
      return; // Ignore if not in update mode
    }

    switch (status.status) {
      case "downloading":
        this._emit("progressChange", {
          percent: Math.round(status.percent || 0),
          bytesPerSecond: status.bytesPerSecond,
          transferred: status.transferred,
          total: status.total,
        });

        this._emit("statusChange", {
          status: "downloading",
          version: this.currentUpdateVersion,
          message: `Đang tải: ${Math.round(status.percent || 0)}%`,
        });
        break;

      case "update_success":
        this._emit("statusChange", {
          status: "verifying",
          version: this.currentUpdateVersion,
          message: "Cập nhật thành công, đang khởi động lại...",
        });

        this._emit("progressChange", {
          percent: 100,
        });

        console.log("[UpdateService] Update download successful");
        break;

      case "error":
        this._emit("error", {
          message: status.error || "Lỗi trong quá trình cập nhật",
          code: "UPDATE_ERROR",
        });
        this.updateInProgress = false;
        break;

      case "no_updates":
        this._emit("error", {
          message: "Phiên bản này hiện không sẵn có",
          code: "NO_UPDATE",
        });
        this.updateInProgress = false;
        break;

      default:
        console.warn("[UpdateService] Unknown status:", status.status);
    }
  }

  /**
   * Handle reset status (signifies update completed)
   */
  handleResetStatus(status) {
    console.log("[UpdateService] Received reset status:", status);

    if (!this.updateInProgress) {
      return;
    }

    if (status.status === "reset_success") {
      const duration = ((Date.now() - this.updateStartTime) / 1000).toFixed(1);

      this._emit("statusChange", {
        status: "completed",
        version: this.currentUpdateVersion,
        message: `Cập nhật hoàn thành! (v${this.currentUpdateVersion}) - Thời gian: ${duration}s`,
      });

      this._emit("success", {
        version: this.currentUpdateVersion,
        duration: duration,
      });

      this.updateInProgress = false;
      this.currentUpdateVersion = null;
    }
  }

  /**
   * Cancel ongoing update
   */
  cancel() {
    this.updateInProgress = false;
    this.currentUpdateVersion = null;
    console.log("[UpdateService] Update cancelled");
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      inProgress: this.updateInProgress,
      currentVersion: this.currentUpdateVersion,
      startTime: this.updateStartTime,
    };
  }
}

// Create global instance
window.UpdateService = new UpdateService();

// Export for modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = UpdateService;
}
