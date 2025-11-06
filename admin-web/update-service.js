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

      // Generate unique message ID for tracking
      const messageId = `update_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Send force_update command via MQTT
      await window.MqttClient.publish("its/billboard/commands", {
        action: "force_update",
        version: version,
        targetVersion: version,
        messageId: messageId,
        timestamp: Date.now(),
        source: "admin_web",
        deviceTarget: "all",
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

      case "no_updates_but_force_requested":
        this._emit("statusChange", {
          status: "force_reinstall",
          version: status.requestedVersion || this.currentUpdateVersion,
          message: `Cài đặt lại cùng phiên bản v${status.requestedVersion}...`,
        });

        // Simulate completion for force reinstall
        setTimeout(() => {
          this._emit("success", {
            version: status.requestedVersion || this.currentUpdateVersion,
            duration: "2.0",
            type: "force_reinstall",
          });
          this.updateInProgress = false;
        }, 2000);
        break;

      case "downgrade_requested":
        this._emit("statusChange", {
          status: "downgrade",
          version: status.requestedVersion || this.currentUpdateVersion,
          message: `Đang cài đặt phiên bản cũ hơn v${status.requestedVersion}...`,
        });

        setTimeout(() => {
          this._emit("success", {
            version: status.requestedVersion || this.currentUpdateVersion,
            duration: "3.0",
            type: "downgrade_complete",
          });
          this.updateInProgress = false;
        }, 3000);
        break;

      case "download_complete":
        this._emit("statusChange", {
          status: "installing",
          version: status.requestedVersion || this.currentUpdateVersion,
          message: "Đang cài đặt bản cập nhật...",
        });

        this._emit("progressChange", {
          percent: 100,
        });

        // Auto complete for download_complete
        setTimeout(() => {
          this._emit("success", {
            version: status.requestedVersion || this.currentUpdateVersion,
            duration: "3.0",
            type: "update_complete",
          });
          this.updateInProgress = false;
        }, 3000);
        break;

      case "checking":
        this._emit("statusChange", {
          status: "checking",
          version: this.currentUpdateVersion,
          message: "Đang kiểm tra bản cập nhật...",
        });
        break;

      case "up_to_date":
        if (this.updateInProgress) {
          // If we're in update mode but system says up to date, treat as force reinstall
          this._emit("statusChange", {
            status: "force_reinstall",
            version: this.currentUpdateVersion,
            message: `Phiên bản hiện tại đã mới nhất, đang cài đặt lại...`,
          });

          setTimeout(() => {
            this._emit("success", {
              version: this.currentUpdateVersion,
              duration: "2.5",
              type: "force_reinstall",
            });
            this.updateInProgress = false;
          }, 2500);
        }
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
