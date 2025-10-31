/**
 * Device Reset Module
 * Handles billboard reset operations
 */

import * as uiCore from "./ui-core.js";

export class DeviceResetService {
  constructor() {
    this.resetInProgress = false;
    console.log("[DeviceResetService] Initialized");
  }

  /**
   * Reset billboard app
   */
  async resetApp(buttonSelector = 'button[onclick="resetApp()"]') {
    const resetBtn = document.querySelector(buttonSelector);

    if (!resetBtn) {
      console.error("[DeviceResetService] Reset button not found");
      return;
    }

    // Show confirmation
    const confirmed = await uiCore.showConfirmation(
      "XÁC NHẬN RESET APP",
      "Hành động này sẽ:\n" +
        "- Khởi động lại billboard display\n" +
        "- Tải lại tất cả settings và manifest\n" +
        "- Ngắt kết nối MQTT tạm thời\n\n" +
        "Bạn có chắc chắn muốn tiếp tục?"
    );

    if (!confirmed) {
      console.log("[DeviceResetService] Reset cancelled by user");
      return;
    }

    try {
      this.resetInProgress = true;
      this.setButtonLoading(resetBtn, true);

      uiCore.showToast("🔄 Sending reset command to billboard...", "info");

      console.log("[DeviceResetService] Sending reset command");

      // Check MQTT connection
      if (!window.MqttClient || !window.MqttClient.connected) {
        throw new Error("MQTT not connected");
      }

      // Send MQTT reset command
      if (window.MqttClient.publishAppReset) {
        await window.MqttClient.publishAppReset();
      } else {
        // Fallback: publish directly
        await window.MqttClient.publish("its/billboard/commands", {
          action: "reset_app",
          timestamp: Date.now(),
          source: "admin_web",
        });
      }

      uiCore.showToast("✅ Reset command sent successfully", "success");

      // Simulate waiting for reset
      setTimeout(() => {
        uiCore.showToast("🔄 Billboard is restarting...", "info");
        console.log("[DeviceResetService] Billboard restarting");
      }, 2000);

      console.log("[DeviceResetService] Reset initiated successfully");
    } catch (error) {
      console.error("[DeviceResetService] Reset failed:", error);
      uiCore.showToast("❌ Reset failed: " + error.message, "error");
    } finally {
      this.setButtonLoading(resetBtn, false);
      this.resetInProgress = false;
    }
  }

  /**
   * Handle reset status from MQTT
   */
  handleResetStatus(status) {
    console.log("[DeviceResetService] Status received:", status);

    const resetStatus = document.getElementById("resetStatus");
    const resetStatusText = document.getElementById("resetStatusText");

    if (!resetStatus) {
      console.warn("[DeviceResetService] Reset status element not found");
      return;
    }

    resetStatus.style.display = "block";

    const statusMap = {
      resetting: {
        message: "🔄 Billboard is resetting...",
        type: "info",
      },
      completed: {
        message: "✅ Reset completed successfully",
        type: "success",
      },
      failed: {
        message: `❌ Reset failed: ${status.error || "Unknown error"}`,
        type: "error",
      },
      timeout: {
        message: "⏱️ Reset timeout",
        type: "warning",
      },
    };

    const statusInfo = statusMap[status.state] || statusMap.resetting;

    if (resetStatusText) {
      resetStatusText.textContent = statusInfo.message;
    }

    uiCore.showToast(statusInfo.message, statusInfo.type);

    console.log(`[DeviceResetService] Status: ${status.state}`);
  }

  /**
   * Force reset without confirmation
   */
  async forceReset() {
    try {
      this.resetInProgress = true;

      uiCore.showToast("🔄 Sending force reset...", "info");

      if (!window.MqttClient || !window.MqttClient.connected) {
        throw new Error("MQTT not connected");
      }

      // Send force reset command
      await window.MqttClient.publish("its/billboard/commands", {
        action: "reset_app",
        force: true,
        timestamp: Date.now(),
        source: "admin_web",
      });

      uiCore.showToast("✅ Force reset sent", "success");
      console.log("[DeviceResetService] Force reset sent");
    } catch (error) {
      console.error("[DeviceResetService] Force reset failed:", error);
      uiCore.showToast("Force reset failed: " + error.message, "error");
    } finally {
      this.resetInProgress = false;
    }
  }

  /**
   * Check if reset is in progress
   */
  isResetInProgress() {
    return this.resetInProgress;
  }

  /**
   * Set button loading state
   */
  setButtonLoading(button, loading) {
    if (!button) return;

    button.disabled = loading;

    const btnText = button.querySelector(".btn-text");
    const btnLoading = button.querySelector(".btn-loading");

    if (btnText) btnText.style.display = loading ? "none" : "inline";
    if (btnLoading) btnLoading.style.display = loading ? "inline" : "none";

    console.log("[DeviceResetService] Button", loading ? "loading" : "ready");
  }

  /**
   * Reset all UI elements
   */
  resetUI() {
    const resetStatus = document.getElementById("resetStatus");
    const resetStatusText = document.getElementById("resetStatusText");

    if (resetStatus) resetStatus.style.display = "none";
    if (resetStatusText) resetStatusText.textContent = "";

    console.log("[DeviceResetService] UI reset");
  }
}
