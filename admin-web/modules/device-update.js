/**
 * Device Update Module
 * Handles billboard update operations
 */

import * as uiCore from "./ui-core.js";

export class DeviceUpdateService {
  constructor() {
    this.lastDetectedVersion = null;
    this.updateInProgress = false;
    this.progressInterval = null;
    this.progressTimeout = null;

    console.log("[DeviceUpdateService] Initialized");
  }

  /**
   * Check for updates on billboard
   */
  async checkForUpdates() {
    const checkBtn = document.getElementById("checkUpdateBtn");
    const updateStatus = document.getElementById("updateStatus");
    const statusText = document.getElementById("updateStatusText");

    if (!checkBtn) {
      console.error("[DeviceUpdateService] Check button not found");
      return;
    }

    try {
      this.setButtonLoading(checkBtn, true);
      uiCore.showToast("🔍 Checking for updates...", "info");

      if (!window.MqttClient || !window.MqttClient.connected) {
        throw new Error("MQTT not connected");
      }

      console.log("[DeviceUpdateService] Sending check_update command");

      // Publish check update command
      await window.MqttClient.publish("its/billboard/commands", {
        action: "check_update",
        timestamp: Date.now(),
        source: "admin_web",
      });

      uiCore.showToast("📤 Update check command sent", "info");

      if (updateStatus) updateStatus.style.display = "block";
      if (statusText) statusText.textContent = "Waiting for response...";

      // Timeout after 10 seconds
      setTimeout(() => {
        if (statusText?.textContent === "Waiting for response...") {
          statusText.textContent = "Timeout - No response from billboard";
          console.warn("[DeviceUpdateService] Check update timeout");
        }
      }, 10000);
    } catch (error) {
      console.error("[DeviceUpdateService] Check update failed:", error);
      uiCore.showToast("❌ Check update failed: " + error.message, "error");
      if (updateStatus) updateStatus.style.display = "block";
      if (statusText) statusText.textContent = "Error: " + error.message;
    } finally {
      this.setButtonLoading(checkBtn, false);
    }
  }

  /**
   * Force update on billboard
   */
  async forceUpdate() {
    const forceBtn = document.getElementById("forceUpdateBtn");
    const updateStatus = document.getElementById("updateStatus");
    const statusText = document.getElementById("updateStatusText");
    const updateProgress = document.getElementById("updateProgress");

    if (!forceBtn) {
      console.error("[DeviceUpdateService] Force button not found");
      return;
    }

    // Verify update version is detected
    if (!this.lastDetectedVersion) {
      uiCore.showToast(
        "Please click 'Check Updates' first to verify an update is available",
        "warning"
      );
      if (statusText) {
        statusText.textContent =
          "Error: Please check for updates first before forcing update";
      }
      if (updateStatus) updateStatus.style.display = "block";
      return;
    }

    // Show confirmation
    const confirmed = await uiCore.showConfirmation(
      "XÁC NHẬN CẬP NHẬT",
      "Hành động này sẽ:\n" +
        "- Tải phiên bản mới nhất\n" +
        "- Cài đặt bản cập nhật\n" +
        "- Khởi động lại ứng dụng\n\n" +
        "Bạn có chắc chắn muốn tiếp tục?"
    );

    if (!confirmed) {
      console.log("[DeviceUpdateService] Update cancelled by user");
      return;
    }

    try {
      this.updateInProgress = true;
      this.setButtonLoading(forceBtn, true);

      uiCore.showToast(
        `Initiating update to v${this.lastDetectedVersion}...`,
        "info"
      );

      if (!window.MqttClient || !window.MqttClient.connected) {
        throw new Error("MQTT not connected - cannot send update command");
      }

      console.log(
        "[DeviceUpdateService] Sending force_update for version:",
        this.lastDetectedVersion
      );

      // Publish force update command
      await window.MqttClient.publish("its/billboard/commands", {
        action: "force_update",
        timestamp: Date.now(),
        source: "admin_web",
        detectedVersion: this.lastDetectedVersion,
      });

      uiCore.showToast("Update command sent to billboard", "info");

      if (updateStatus) updateStatus.style.display = "block";
      if (updateProgress) updateProgress.style.display = "block";
      if (statusText)
        statusText.textContent = "Waiting for download to start...";

      // Simulate progress
      this.startProgressSimulation();

      // Timeout after 120 seconds
      this.progressTimeout = setTimeout(() => {
        if (statusText?.textContent.includes("progress")) {
          statusText.textContent =
            "Update in progress - app will restart when download completes";
          console.log(
            "[DeviceUpdateService] Update timeout, monitoring in background"
          );
        }
      }, 120000);
    } catch (error) {
      console.error("[DeviceUpdateService] Force update failed:", error);
      uiCore.showToast("Force update failed: " + error.message, "error");
      if (updateStatus) updateStatus.style.display = "block";
      if (statusText) statusText.textContent = "Error: " + error.message;
      this.clearProgress();
    } finally {
      this.setButtonLoading(forceBtn, false);
      this.updateInProgress = false;
    }
  }

  /**
   * Start progress simulation
   */
  startProgressSimulation() {
    let progress = 0;

    this.progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;

        const progressFill = document.getElementById("updateProgressFill");
        const progressText = document.getElementById("updateProgressText");

        if (progressFill) progressFill.style.width = progress + "%";
        if (progressText) progressText.textContent = Math.round(progress) + "%";
      }
    }, 1000);

    console.log("[DeviceUpdateService] Progress simulation started");
  }

  /**
   * Clear progress timers and displays
   */
  clearProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.progressTimeout) {
      clearTimeout(this.progressTimeout);
      this.progressTimeout = null;
    }
    console.log("[DeviceUpdateService] Progress cleared");
  }

  /**
   * Complete update (called from MQTT listener)
   */
  completeUpdate() {
    this.clearProgress();

    const updateProgress = document.getElementById("updateProgress");
    const statusText = document.getElementById("updateStatusText");

    if (updateProgress) updateProgress.style.display = "none";
    if (statusText) {
      statusText.textContent = "✓ Update completed successfully!";
      statusText.style.color = "green";
    }

    uiCore.showToast("✓ Update completed successfully!", "success");
    console.log("[DeviceUpdateService] Update completed");
  }

  /**
   * Update failed (called from MQTT listener)
   */
  updateFailed(error) {
    this.clearProgress();

    const updateProgress = document.getElementById("updateProgress");
    const statusText = document.getElementById("updateStatusText");

    if (updateProgress) updateProgress.style.display = "none";
    if (statusText) {
      statusText.textContent = `Error: ${error}`;
      statusText.style.color = "red";
    }

    uiCore.showToast("Update failed: " + error, "error");
    console.error("[DeviceUpdateService] Update failed:", error);
  }

  /**
   * Set detected version
   */
  setDetectedVersion(version) {
    this.lastDetectedVersion = version;
    console.log("[DeviceUpdateService] Version detected:", version);
  }

  /**
   * Get detected version
   */
  getDetectedVersion() {
    return this.lastDetectedVersion;
  }

  /**
   * Check if update is in progress
   */
  isUpdateInProgress() {
    return this.updateInProgress;
  }

  /**
   * Update status from MQTT
   */
  handleUpdateStatus(status) {
    const statusText = document.getElementById("updateStatusText");
    const progressText = document.getElementById("updateProgressText");

    console.log("[DeviceUpdateService] Status received:", status);

    if (status.progress !== undefined) {
      if (progressText) {
        progressText.textContent = status.progress + "%";
      }
    }

    if (status.message) {
      if (statusText) {
        statusText.textContent = status.message;
      }
    }

    if (status.state === "completed") {
      this.completeUpdate();
    } else if (status.state === "failed") {
      this.updateFailed(status.error);
    }
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

    console.log("[DeviceUpdateService] Button", loading ? "loading" : "ready");
  }
}
