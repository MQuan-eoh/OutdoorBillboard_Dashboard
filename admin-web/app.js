// Simplified Banner Management System - GitHub CDN Only
// Removed duplicate upload logic, only GitHub CDN workflow

// ====================================
// SIMPLIFIED CORE FUNCTIONS
// ====================================

// Show toast notification
function showToast(message, type = "info", duration = 5000) {
  const toastContainer = document.getElementById("toastContainer");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const emoji = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  toast.innerHTML = `
        <span class="toast-emoji">${emoji[type] || emoji.info}</span>
        <span class="toast-message">${message}</span>
    `;

  toastContainer.appendChild(toast);

  // Auto remove toast
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);

  console.log(`[${type.toUpperCase()}] ${message}`);
}

// Track device information
let currentDeviceInfo = {
  deviceId: null,
  deviceVersion: null,
  mqttStatus: "disconnected",
  lastUpdateTime: null,
};

// Show modal
function showModal(title, content) {
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  modal.style.display = "block";
}

// Close modal
function closeModal() {
  const modal = document.getElementById("modal");
  modal.style.display = "none";
}

// Update connection status in UI
function updateConnectionStatus(status) {
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");

  if (!statusIndicator || !statusText) return;

  statusIndicator.className = "status-indicator";

  switch (status.status) {
    case "connected":
      statusIndicator.classList.add("online");
      statusText.textContent = "Đã kết nối";
      break;
    case "connecting":
    case "reconnecting":
      statusIndicator.classList.add("connecting");
      statusText.textContent = "Đang kết nối...";
      break;
    case "disconnected":
      statusIndicator.classList.add("offline");
      statusText.textContent = "Mất kết nối";
      break;
    case "error":
      statusIndicator.classList.add("offline");
      statusText.textContent = "Lỗi kết nối";
      break;
    default:
      statusIndicator.classList.add("offline");
      statusText.textContent = "Không xác định";
  }
}

// Load settings (local storage only)
async function loadSettings() {
  try {
    console.log("Loading settings from local storage...");

    const savedSettings = localStorage.getItem("billboard-settings");
    let settings = { displayMode: "loop", loopDuration: 10 };

    if (savedSettings) {
      settings = JSON.parse(savedSettings);
    }

    const displayModeEl = document.getElementById("displayMode");
    const loopDurationEl = document.getElementById("loopDuration");

    if (displayModeEl) displayModeEl.value = settings.displayMode || "loop";
    if (loopDurationEl) loopDurationEl.value = settings.loopDuration || 10;

    console.log("Settings loaded:", settings);
  } catch (error) {
    console.error("Error loading settings:", error);
    showToast("Error loading settings: " + error.message, "error");
  }
}

// Sync settings (local storage + MQTT)
async function syncSettings() {
  try {
    const displayModeEl = document.getElementById("displayMode");
    const loopDurationEl = document.getElementById("loopDuration");

    const displayMode = displayModeEl ? displayModeEl.value : "loop";
    const loopDuration = loopDurationEl ? parseInt(loopDurationEl.value) : 10;

    const settings = {
      displayMode: displayMode,
      loopDuration: loopDuration,
      lastUpdated: new Date().toISOString(),
    };

    console.log("Syncing settings:", settings);

    // Save to localStorage
    localStorage.setItem("billboard-settings", JSON.stringify(settings));

    // Send MQTT notification
    try {
      if (window.MqttClient) {
        await window.MqttClient.publishSettingsSync(settings);
      }
    } catch (error) {
      console.warn("Failed to publish MQTT settings sync:", error);
    }

    showToast("Settings synced successfully", "success");
  } catch (error) {
    console.error("Error syncing settings:", error);
    showToast("Error syncing settings: " + error.message, "error");
  }
}

// Check for updates on billboard
async function checkForUpdates() {
  const checkBtn = document.getElementById("checkUpdateBtn");
  const btnText = checkBtn.querySelector(".btn-text");
  const btnLoading = checkBtn.querySelector(".btn-loading");
  const updateStatus = document.getElementById("updateStatus");
  const statusText = document.getElementById("updateStatusText");

  try {
    checkBtn.disabled = true;
    btnText.style.display = "none";
    btnLoading.style.display = "inline";

    showToast("🔍 Checking for updates...", "info");

    if (!window.MqttClient || !window.MqttClient.connected) {
      throw new Error("MQTT not connected");
    }

    // Publish check update command
    await window.MqttClient.publish("its/billboard/commands", {
      action: "check_update",
      timestamp: Date.now(),
      source: "admin_web",
    });

    showToast("📤 Update check command sent", "info");

    updateStatus.style.display = "block";
    statusText.textContent = "Waiting for response...";

    // Wait for response (timeout after 10 seconds)
    setTimeout(() => {
      if (statusText.textContent === "Waiting for response...") {
        statusText.textContent = "Timeout - No response from billboard";
        updateStatus.style.display = "block";
      }
    }, 10000);
  } catch (error) {
    console.error("Check update failed:", error);
    showToast("❌ Check update failed: " + error.message, "error");
    updateStatus.style.display = "block";
    statusText.textContent = "Error: " + error.message;
  } finally {
    checkBtn.disabled = false;
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
  }
}

// Force update on billboard using UpdateService
async function forceUpdate() {
  const forceBtn = document.getElementById("forceUpdateBtn");
  const btnText = forceBtn.querySelector(".btn-text");
  const btnLoading = forceBtn.querySelector(".btn-loading");
  const updateStatus = document.getElementById("updateStatus");
  const statusText = document.getElementById("updateStatusText");

  if (!lastDetectedUpdateVersion) {
    showToast(
      "Please click 'Check Updates' first to verify an update is available",
      "warning"
    );
    statusText.textContent =
      "Error: Please check for updates first before forcing update";
    updateStatus.style.display = "block";
    return;
  }

  // ✅ NEW: Check MQTT connection first
  if (!window.MqttClient || !window.MqttClient.connected) {
    showToast(
      "❌ MQTT not connected to billboard. Cannot send update.",
      "error"
    );
    statusText.textContent = "Error: Not connected to billboard display";
    updateStatus.style.display = "block";
    return;
  }

  const confirmed = confirm(
    "⚠️ XÁC NHẬN CẬP NHẬT\n\n" +
      "Hành động này sẽ:\n" +
      "- Tải phiên bản mới nhất\n" +
      "- Cài đặt bản cập nhật\n" +
      "- Khởi động lại ứng dụng\n\n" +
      "Bạn có chắc chắn muốn tiếp tục?"
  );

  if (!confirmed) {
    return;
  }

  try {
    forceBtn.disabled = true;
    btnText.style.display = "none";
    btnLoading.style.display = "inline";

    showToast(`Initiating update to v${lastDetectedUpdateVersion}...`, "info");

    updateStatus.style.display = "block";
    statusText.textContent = "Preparing update...";

    // ✅ NEW: Generate unique message ID for tracking
    const messageId = `update_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // ✅ IMPROVED: Send command with all required fields
    const updateCommand = {
      action: "force_update",
      version: lastDetectedUpdateVersion,
      targetVersion: lastDetectedUpdateVersion,
      messageId: messageId,
      timestamp: Date.now(),
      source: "admin_web",
      deviceTarget: "all",
    };

    console.log("[Admin-Web OTA] Sending force_update command:", updateCommand);

    // Send via MQTT
    await window.MqttClient.publish("its/billboard/commands", updateCommand);

    console.log("[Admin-Web OTA] Command sent, waiting for acknowledgment...");
    showToast("📤 Update command sent to billboard", "info");

    statusText.textContent = "Waiting for billboard acknowledgment...";

    // ✅ NEW: Wait for acknowledgment or timeout
    const ackTimeout = new Promise((resolve) => {
      setTimeout(() => {
        resolve(false); // Timeout - no ack received
      }, 5000); // 5 second timeout
    });

    const ackReceived = await Promise.race([
      window.MqttClient.waitForAcknowledgment
        ? window.MqttClient.waitForAcknowledgment(messageId)
        : Promise.reject(new Error("ACK support not available")),
      ackTimeout,
    ]).catch(() => false);

    if (ackReceived) {
      statusText.textContent =
        "✅ Billboard acknowledged! Downloading update...";
      showToast("✅ Billboard acknowledged update command", "success");
    } else {
      statusText.textContent =
        "⚠️ No acknowledgment yet, update may still be in progress...";
      showToast("⚠️ No immediate response from billboard", "warning");
    }

    // Setup UpdateService listeners before triggering
    setupUpdateServiceListeners();

    // Trigger update using UpdateService
    const success = await window.UpdateService.triggerUpdate(
      lastDetectedUpdateVersion
    );

    if (!success) {
      throw new Error("Update service failed to initialize update");
    }

    statusText.textContent = "Waiting for download to start...";
  } catch (error) {
    console.error("Force update failed:", error);
    showToast("Force update failed: " + error.message, "error");
    updateStatus.style.display = "block";
    statusText.textContent = "Error: " + error.message;
  } finally {
    forceBtn.disabled = false;
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
  }
}

// Setup UpdateService event listeners
function setupUpdateServiceListeners() {
  if (!window.UpdateService) {
    console.error("UpdateService not available");
    return;
  }

  // Listen for status changes
  window.UpdateService.on("statusChange", (data) => {
    const statusText = document.getElementById("updateStatusText");
    if (statusText) {
      statusText.textContent = data.message;
    }
  });

  // Listen for progress updates
  window.UpdateService.on("progressChange", (data) => {
    const progressFill = document.getElementById("updateProgressFill");
    const progressText = document.getElementById("updateProgressText");
    const updateProgress = document.getElementById("updateProgress");

    if (progressFill && progressText) {
      updateProgress.style.display = "block";
      progressFill.style.width = Math.min(data.percent, 100) + "%";
      progressText.textContent = Math.round(data.percent) + "%";
    }
  });

  // Listen for success
  window.UpdateService.on("success", (result) => {
    showToast(`Update completed: v${result.version}`, "success");
    const statusText = document.getElementById("updateStatusText");
    if (statusText) {
      statusText.textContent = `Update successful! Restarting app...`;
    }
  });

  // Listen for errors
  window.UpdateService.on("error", (error) => {
    showToast(`Update error: ${error.message}`, "error");
    const statusText = document.getElementById("updateStatusText");
    if (statusText) {
      statusText.textContent = `Error: ${error.message}`;
    }
  });
}

// Reset App function
async function resetApp() {
  const resetBtn = document.querySelector('button[onclick="resetApp()"]');
  const btnText = resetBtn.querySelector(".btn-text");
  const btnLoading = resetBtn.querySelector(".btn-loading");

  // Show confirmation dialog
  const confirmed = confirm(
    "⚠️ XÁC NHẬN RESET APP\n\n" +
      "Hành động này sẽ:\n" +
      "- Khởi động lại billboard display\n" +
      "- Tải lại tất cả settings và manifest\n" +
      "- Ngắt kết nối MQTT tạm thời\n\n" +
      "Bạn có chắc chắn muốn tiếp tục?"
  );

  if (!confirmed) {
    return;
  }

  try {
    console.log("Resetting app...");

    // Update button state
    resetBtn.disabled = true;
    btnText.style.display = "none";
    btnLoading.style.display = "inline";

    showToast("🔄 Sending reset command to billboard...", "info");

    // Send MQTT reset command
    if (window.MqttClient && window.MqttClient.connected) {
      await window.MqttClient.publishAppReset();

      showToast("✅ Reset command sent successfully", "success");

      // Simulate waiting for reset
      setTimeout(() => {
        showToast("🔄 Billboard is restarting...", "info");
      }, 2000);
    } else {
      throw new Error("MQTT not connected");
    }
  } catch (error) {
    console.error("Reset app failed:", error);
    showToast("❌ Reset failed: " + error.message, "error");
  } finally {
    // Reset button state
    resetBtn.disabled = false;
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
  }
}

// ====================================
// MQTT INITIALIZATION
// ====================================

// Initialize MQTT connection
async function initializeMQTT() {
  try {
    console.log("Initializing MQTT client...");

    if (window.MqttClient) {
      try {
        await window.MqttClient.connect();

        // Setup MQTT status monitoring
        window.MqttClient.onStatusChange((status) => {
          updateConnectionStatus(status);
          updateMqttStatusDisplay(); // Update device info display
        });

        // Setup MQTT message handlers for update status
        window.MqttClient.onMessage((topic, message) => {
          handleMqttStatusMessage(topic, message);
        });

        showToast("MQTT connected successfully", "success");
      } catch (error) {
        console.warn("MQTT connection failed:", error);
        showToast(
          "MQTT connection failed, continuing in offline mode",
          "warning"
        );
        updateMqttStatusDisplay(); // Update even on failure
      }
    } else {
      console.warn("MQTT client not available");
      showToast("MQTT client not available", "warning");
      updateMqttStatusDisplay(); // Update when not available
    }
  } catch (error) {
    console.error("MQTT initialization error:", error);
    showToast("MQTT initialization failed: " + error.message, "error");
    updateMqttStatusDisplay(); // Update on error
  }
}

// Handle MQTT status messages from billboard
function handleMqttStatusMessage(topic, message) {
  if (!topic) return;

  // Parse message if it's JSON
  let data = message;
  if (typeof message === "string") {
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }
  }

  // Handle update status messages
  if (topic === "its/billboard/update/status") {
    handleUpdateStatus(data);
  }

  // Handle reset status messages
  if (topic === "its/billboard/reset/status") {
    handleResetStatus(data);
  }

  // Handle acknowledgment messages
  if (topic === "its/billboard/update/ack") {
    handleUpdateAcknowledgment(data);
  }
}

// Handle update status from billboard - forward to UpdateService
function handleUpdateStatus(status) {
  const updateStatus = document.getElementById("updateStatus");
  const statusText = document.getElementById("updateStatusText");

  if (!updateStatus) return;

  updateStatus.style.display = "block";

  // Forward to UpdateService if available
  if (window.UpdateService) {
    window.UpdateService.handleUpdateStatus(status);
  }

  // Also handle UI updates for compatibility
  switch (status.status) {
    case "update_available":
      statusText.textContent = `Update available: v${status.version}`;
      lastDetectedUpdateVersion = status.version;

      const forceUpdateBtn = document.getElementById("forceUpdateBtn");
      if (forceUpdateBtn) {
        forceUpdateBtn.disabled = false;
      }
      showToast(`Update available: v${status.version}`, "success");
      break;

    case "no_updates":
      statusText.textContent = "Already up to date";
      showToast("Already up to date", "info");
      break;

    case "error":
      statusText.textContent = `Error: ${status.error}`;
      showToast(`Update error: ${status.error}`, "error");
      break;

    default:
      statusText.textContent = status.message || `Status: ${status.status}`;
  }
}

// Handle reset status from billboard - forward to UpdateService
function handleResetStatus(status) {
  // Forward to UpdateService if available
  if (window.UpdateService) {
    window.UpdateService.handleResetStatus(status);
  }

  // Also handle UI updates for compatibility
  switch (status.status) {
    case "reset_started":
      showToast("Billboard starting reset...", "info");
      break;

    case "restarting":
      showToast("Billboard restarting...", "success");
      break;

    case "reset_success":
      showToast("Billboard reset completed", "success");
      break;

    case "error":
      showToast(`Reset error: ${status.error}`, "error");
      break;
  }
}

// Handle update acknowledgment from billboard
function handleUpdateAcknowledgment(ack) {
  console.log("[Admin-Web] Received update acknowledgment:", ack);

  // Update device information
  if (ack.deviceId) {
    currentDeviceInfo.deviceId = ack.deviceId;
    updateDeviceInfoDisplay();
  }

  if (ack.deviceVersion) {
    currentDeviceInfo.deviceVersion = ack.deviceVersion;
    updateDeviceInfoDisplay();
  }

  // Update last update time
  currentDeviceInfo.lastUpdateTime = new Date().toLocaleString("vi-VN");
  updateDeviceInfoDisplay();

  // Show acknowledgment toast
  showToast(
    `✅ Billboard acknowledged: ${ack.message || "Ready for update"}`,
    "success"
  );
}

// Update MQTT status display
function updateMqttStatusDisplay() {
  const statusEl = document.getElementById("deviceMqttStatus");
  if (!statusEl) return;

  const isConnected = window.MqttClient?.connected;
  currentDeviceInfo.mqttStatus = isConnected ? "connected" : "disconnected";

  const statusIndicator = statusEl.querySelector(".status-indicator");
  const statusText = statusEl.querySelector(".status-text");

  if (statusIndicator && statusText) {
    if (isConnected) {
      statusIndicator.className = "status-indicator online";
      statusText.textContent = "Đã kết nối";
    } else {
      statusIndicator.className = "status-indicator offline";
      statusText.textContent = "Chưa kết nối";
    }
  } else {
    // Fallback if structure is different
    statusEl.innerHTML = `
      <span class="status-indicator ${
        isConnected ? "online" : "offline"
      }"></span>
      ${isConnected ? "Đã kết nối" : "Chưa kết nối"}
    `;
  }
}

// Refresh device info
function refreshDeviceInfo() {
  console.log("[Admin-Web] Refreshing device info...");

  // Reset device info
  currentDeviceInfo = {
    deviceId: null,
    deviceVersion: null,
    mqttStatus: window.MqttClient?.connected ? "connected" : "disconnected",
    lastUpdateTime: null,
  };

  updateDeviceInfoDisplay();
  updateMqttStatusDisplay();

  showToast("Đã làm mới thông tin thiết bị", "info");
}

// ====================================
// LOGO MANIFEST SERVICE (GitHub CDN Sync) - Simplified
// ====================================

class LogoManifestManager {
  constructor() {
    this.manifestUrl =
      "https://mquan-eoh.github.io/billboard-logos-cdn/manifest.json";
    this.currentManifest = null;

    this.initializeManifestUI();
  }

  initializeManifestUI() {
    console.log("Initializing Logo Manifest UI...");
    this.fetchCurrentManifest();
    this.updateManifestStatus();
  }

  async fetchCurrentManifest() {
    try {
      console.log("Fetching current manifest from GitHub...");

      const response = await fetch(this.manifestUrl, {
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        this.currentManifest = await response.json();
        console.log("Manifest fetched successfully:", this.currentManifest);
        this.updateManifestDisplay();
        this.displayLogos();
        this.updateManifestStatus("online");
        return this.currentManifest;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to fetch manifest:", error);
      this.updateManifestStatus("error");
      showToast("Không thể tải manifest từ GitHub", "error");
      return null;
    }
  }

  updateManifestDisplay() {
    if (!this.currentManifest) return;

    const manifestUrl = document.getElementById("manifestUrl");
    const manifestVersion = document.getElementById("manifestVersion");
    const activeLogos = document.getElementById("activeLogos");
    const lastUpdated = document.getElementById("lastUpdated");

    if (manifestUrl) manifestUrl.textContent = this.manifestUrl;
    if (manifestVersion)
      manifestVersion.textContent = this.currentManifest.version || "Unknown";
    if (activeLogos) {
      const active =
        this.currentManifest.logos?.filter((logo) => logo.active).length || 0;
      activeLogos.textContent = `${active}/${
        this.currentManifest.logos?.length || 0
      }`;
    }
    if (lastUpdated) {
      const date = new Date(this.currentManifest.lastUpdated);
      lastUpdated.textContent = date.toLocaleString("vi-VN");
    }
  }

  updateManifestStatus(status) {
    const statusBadge = document.getElementById("manifestStatus");
    if (statusBadge) {
      statusBadge.className = "status-badge";
      switch (status) {
        case "online":
          statusBadge.classList.add("online");
          statusBadge.textContent = "Online";
          break;
        case "error":
          statusBadge.classList.add("error");
          statusBadge.textContent = "Error";
          break;
        default:
          statusBadge.textContent = "Checking...";
      }
    }
  }

  displayLogos() {
    const logosGrid = document.getElementById("logosGrid");
    if (!logosGrid || !this.currentManifest?.logos) return;

    logosGrid.innerHTML = "";

    this.currentManifest.logos.forEach((logo, index) => {
      const logoCard = document.createElement("div");
      logoCard.className = `logo-card ${logo.active ? "active" : "inactive"}`;

      logoCard.innerHTML = `
        <img src="${logo.url}" alt="${logo.name}" class="logo-preview" 
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjYwIiB2aWV3Qm94PSIwIDAgMTAwIDYwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNjAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='">
        <div class="logo-info">
          <h4>${logo.name}</h4>
          <p>Priority: ${logo.priority}</p>
          <p>Size: ${(logo.size / 1024).toFixed(1)}KB</p>
          <p>Status: ${logo.active ? "Active" : "Inactive"}</p>
        </div>
        <div class="logo-actions">
          <button class="btn btn-small ${
            logo.active ? "btn-warning" : "btn-success"
          }" 
                  onclick="window.logoManifest.toggleLogoStatus(${index})">
            ${logo.active ? "Disable" : "Enable"}
          </button>
          <button class="btn btn-small btn-danger" onclick="window.logoManifest.deleteLogo(${index})">Delete</button>
        </div>
      `;

      logosGrid.appendChild(logoCard);
    });
  }

  async forceRefreshBillboard() {
    try {
      console.log("Sending force refresh signal to billboard...");

      const manifestUpdateData = {
        action: "force-refresh-manifest",
        manifest: this.currentManifest,
        timestamp: Date.now(),
        source: "admin-web",
      };

      // Send MQTT message to trigger billboard refresh
      try {
        await window.MqttClient.publishManifestRefresh(manifestUpdateData);
        console.log("MQTT manifest refresh signal sent:", manifestUpdateData);
        showToast("Force refresh signal sent to billboard", "info");

        // Simulate billboard response
        setTimeout(() => {
          showToast("Billboard refreshed successfully", "success");
        }, 2000);
      } catch (error) {
        console.warn("Failed to send MQTT refresh signal:", error);
        showToast(
          "Failed to send refresh signal, but manifest is updated",
          "warning"
        );
      }
    } catch (error) {
      console.error("Failed to refresh billboard:", error);
      showToast("Error sending refresh signal to billboard", "error");
    }
  }

  toggleLogoStatus(index) {
    if (!this.currentManifest?.logos?.[index]) return;

    this.currentManifest.logos[index].active =
      !this.currentManifest.logos[index].active;
    this.updateManifestDisplay();
    this.displayLogos();

    const status = this.currentManifest.logos[index].active
      ? "enabled"
      : "disabled";
    showToast(`Logo ${status} successfully`, "success");
  }

  deleteLogo(index) {
    if (!this.currentManifest?.logos?.[index]) return;

    const logoName = this.currentManifest.logos[index].name;
    if (confirm(`Bạn có chắc muốn xóa logo "${logoName}"?`)) {
      this.currentManifest.logos.splice(index, 1);
      this.updateManifestDisplay();
      this.displayLogos();
      showToast(`Logo "${logoName}" đã được xóa`, "success");
    }
  }
}

// ====================================
// GLOBAL FUNCTIONS FOR HTML HANDLERS
// ====================================

// Global functions for Logo Manifest
function selectLogoFile() {
  const fileInput = document.getElementById("githubFileInput");
  if (fileInput) {
    fileInput.click();
  }
}

function fetchCurrentManifest() {
  if (window.logoManifest) {
    window.logoManifest.fetchCurrentManifest();
  }
}

function forceRefreshBillboard() {
  if (window.logoManifest) {
    window.logoManifest.forceRefreshBillboard();
  }
}

// Cleanup manifest function
async function cleanupBrokenLogos() {
  try {
    showToast("🧹 Starting manifest cleanup...", "info");

    const cleanedManifest = await window.cleanupAndUploadManifest();

    if (cleanedManifest) {
      showToast(
        `✅ Manifest cleaned! Removed ${
          cleanedManifest.metadata?.removedLogos?.length || 0
        } broken logos`,
        "success"
      );

      // Refresh manifest display
      if (window.logoManifest) {
        window.logoManifest.currentManifest = cleanedManifest;
        window.logoManifest.updateManifestDisplay();
        window.logoManifest.displayLogos();
      }

      // Force refresh billboard
      setTimeout(() => forceRefreshBillboard(), 1000);
    }
  } catch (error) {
    console.error("Manifest cleanup failed:", error);
    showToast("❌ Manifest cleanup failed: " + error.message, "error");
  }
}

// Enhanced: Test banner sync with desktop apps
async function testBannerSync() {
  console.log("Testing banner sync with desktop displays...");

  try {
    if (window.MqttClient && window.MqttClient.connected) {
      const testPayload = {
        type: "banner-sync-test",
        action: "test-remote-sync",
        timestamp: new Date().toISOString(),
        message: "Testing remote banner synchronization from admin-web",
      };

      await window.MqttClient.publish(
        "iot/billboard/banner-sync",
        JSON.stringify(testPayload)
      );
      console.log("Banner sync test command sent via MQTT");
      showToast("🧪 Banner sync test sent to displays", "info");
    } else {
      console.warn("MQTT not connected, skipping banner sync test");
      showToast("⚠️ MQTT not connected, cannot test sync", "warning");
    }
  } catch (error) {
    console.error("Error testing banner sync:", error);
    showToast("❌ Failed to test banner sync", "error");
  }
}

function showHelp() {
  showModal(
    "Hướng dẫn sử dụng",
    `
        <h4>Cách sử dụng Banner Management System:</h4>
        <ul>
            <li><strong>GitHub Authentication:</strong> Nhập GitHub token để upload banner</li>
            <li><strong>Upload Banner:</strong> Chọn files và click "Upload Banner"</li>
            <li><strong>Quản lý Banner:</strong> Enable/Disable hoặc xóa banner trong CDN</li>
            <li><strong>Cài đặt:</strong> Thay đổi chế độ hiển thị và sync settings</li>
        </ul>
        <p><strong>Lưu ý:</strong> Chỉ sử dụng GitHub CDN workflow - đơn giản và hiệu quả</p>
    `
  );
}

function showAbout() {
  showModal(
    "Về chúng tôi",
    `
        <h4>ITS Billboard Management System</h4>
        <p><strong>Version:</strong> ${window.BannerConfig.app.version}</p>
        <p><strong>Công ty:</strong> ITS Company</p>
        <p><strong>Mô tả:</strong> Hệ thống quản lý banner quảng cáo đơn giản với GitHub CDN</p>
        <br>
        <p><strong>Workflow:</strong> GitHub CDN → MQTT → Billboard Display</p>
    `
  );
}

// ====================================
// GITHUB UPLOAD INTEGRATION - Simplified
// ====================================

let githubSelectedFiles = [];

async function authenticateGitHub() {
  const tokenInput = document.getElementById("githubToken");
  const token = tokenInput.value.trim();

  if (!token) {
    showToast("Vui lòng nhập GitHub token", "error");
    return;
  }

  try {
    const success = await window.initializeGitHubService(token);

    if (success) {
      document.getElementById("githubAuthCard").style.display = "none";
      document.getElementById("githubUploadSection").style.display = "block";

      // Show repository information
      const status = window.getGitHubServiceStatus();
      showToast(
        `✅ GitHub authentication successful - Using repository: ${status.repository}`,
        "success"
      );

      // Update the UI to show which repository is being used
      updateRepositoryDisplay(status);
    } else {
      showToast("❌ GitHub authentication failed", "error");
    }
  } catch (error) {
    console.error("GitHub auth error:", error);
    showToast("GitHub auth error: " + error.message, "error");
  }
}

function handleGitHubFileSelection(files) {
  console.log("GitHub files selected:", files.length);

  githubSelectedFiles = files.filter((file) => {
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
    if (!validTypes.includes(file.type)) {
      showToast(`File ${file.name}: Loại file không hỗ trợ`, "error");
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showToast(`File ${file.name}: Quá lớn (max 10MB)`, "error");
      return false;
    }

    return true;
  });

  // Update upload button
  const uploadBtn = document.getElementById("githubUploadBtn");
  if (uploadBtn) {
    if (githubSelectedFiles.length > 0) {
      uploadBtn.disabled = false;
      uploadBtn.querySelector(
        ".btn-text"
      ).textContent = `📤 Upload ${githubSelectedFiles.length} banner(s)`;
    } else {
      uploadBtn.disabled = true;
      uploadBtn.querySelector(".btn-text").textContent = "📤 Upload Banner";
    }
  }

  showToast(
    `Selected ${githubSelectedFiles.length} valid banner files`,
    "info"
  );
}

async function testGitHubConnection() {
  const testBtn = document.getElementById("githubTestBtn");
  const btnText = testBtn.querySelector(".btn-text");
  const btnLoading = testBtn.querySelector(".btn-loading");

  testBtn.disabled = true;
  btnText.style.display = "none";
  btnLoading.style.display = "inline";

  try {
    if (!window.GitHubUploadService?.isAuthenticated) {
      throw new Error(
        "GitHub service not authenticated. Please authenticate first."
      );
    }

    const isAuthenticated =
      await window.GitHubUploadService.testAuthentication();

    if (isAuthenticated) {
      showToast("✅ GitHub connection successful!", "success");
    } else {
      throw new Error("Authentication failed or repository not accessible");
    }
  } catch (error) {
    console.error("GitHub connection test failed:", error);
    showToast("❌ GitHub connection failed: " + error.message, "error");
  } finally {
    testBtn.disabled = false;
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
  }
}

async function uploadLogoToGithub() {
  if (githubSelectedFiles.length === 0) {
    showToast("Chưa chọn file nào", "warning");
    return;
  }

  const uploadBtn = document.getElementById("githubUploadBtn");
  const btnText = uploadBtn.querySelector(".btn-text");
  const btnLoading = uploadBtn.querySelector(".btn-loading");
  const progressDiv = document.getElementById("githubProgress");
  const progressFill = document.getElementById("githubProgressFill");
  const progressText = document.getElementById("githubProgressText");
  const progressStatus = document.getElementById("githubProgressStatus");

  try {
    progressDiv.style.display = "block";
    btnText.style.display = "none";
    btnLoading.style.display = "inline";
    uploadBtn.disabled = true;

    showToast(
      `Starting GitHub upload of ${githubSelectedFiles.length} files...`,
      "info"
    );

    // Get current settings from UI before upload
    const displayModeEl = document.getElementById("displayMode");
    const loopDurationEl = document.getElementById("loopDuration");

    const displayMode = displayModeEl ? displayModeEl.value : "loop";
    const loopDuration = loopDurationEl ? parseInt(loopDurationEl.value) : 10;

    // Map displayMode to logoMode for manifest
    const logoMode =
      displayMode === "loop"
        ? "loop"
        : displayMode === "fixed"
        ? "fixed"
        : "scheduled";

    console.log("Uploading with settings:", { logoMode, loopDuration });

    const result = await window.uploadLogosToGitHub(
      githubSelectedFiles,
      { logoMode, logoLoopDuration: loopDuration }, // Pass settings to upload function
      (current, total, status) => {
        const percentage = Math.round((current / total) * 100);
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
        progressStatus.textContent = status || `Uploading ${current}/${total}`;
      }
    );

    if (result.success) {
      showToast(
        `✅ Upload completed: ${result.uploaded} successful, ${result.failed} failed`,
        "success"
      );

      githubSelectedFiles = [];
      document.getElementById("githubFileInput").value = "";

      // Refresh manifest display
      if (window.logoManifest) {
        window.logoManifest.currentManifest = result.manifest;
        window.logoManifest.updateManifestDisplay();
        window.logoManifest.displayLogos();
      }

      // Enhanced: Trigger remote banner sync notification via MQTT
      try {
        if (window.MqttClient && window.MqttClient.connected) {
          const bannerUpdatePayload = {
            type: "banner-update",
            action: "upload-complete",
            bannerCount: result.uploaded,
            timestamp: new Date().toISOString(),
            manifest: result.manifest,
          };

          await window.MqttClient.publish(
            "iot/billboard/banner-sync",
            JSON.stringify(bannerUpdatePayload)
          );

          console.log(
            "Admin-web: Sent banner sync notification to desktop apps"
          );
          showToast(" Remote sync notification sent to displays", "info");
        }
      } catch (mqttError) {
        console.warn(
          "Admin-web: Failed to send MQTT sync notification:",
          mqttError
        );
      }

      setTimeout(() => forceRefreshBillboard(), 2000);
    } else {
      showToast("❌ GitHub upload failed", "error");
    }
  } catch (error) {
    console.error("GitHub upload error:", error);
    showToast("GitHub upload error: " + error.message, "error");
  } finally {
    progressDiv.style.display = "none";
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
    uploadBtn.disabled = false;
    btnText.textContent = "📤 Upload Banner";
  }
}

// ====================================
// APPLICATION INITIALIZATION
// ====================================

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM loaded, initializing simplified banner management app...");

  // Setup GitHub file input handler
  const githubFileInput = document.getElementById("githubFileInput");
  if (githubFileInput) {
    githubFileInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      handleGitHubFileSelection(files);
    });
  }

  // Initialize Logo Manifest Manager
  console.log("Initializing Logo Manifest Manager...");
  window.logoManifest = new LogoManifestManager();

  // Initialize device info display
  updateDeviceInfoDisplay();
  updateMqttStatusDisplay();

  // Initialize MQTT
  await initializeMQTT();

  // Load settings
  await loadSettings();

  console.log("Simplified app initialized successfully!");
});

// Repository display update function
function updateRepositoryDisplay(status) {
  // Create or update repository info display
  let repoInfo = document.getElementById("repoInfo");
  if (!repoInfo) {
    repoInfo = document.createElement("div");
    repoInfo.id = "repoInfo";
    repoInfo.className = "repo-info";

    const uploadSection = document.getElementById("githubUploadSection");
    if (uploadSection) {
      uploadSection.insertBefore(repoInfo, uploadSection.firstChild);
    }
  }

  repoInfo.innerHTML = `
    <div class="repo-info-content">
      <h4>📂 Repository Information</h4>
      <p><strong>Repository:</strong> <a href="https://github.com/${
        status.repository
      }" target="_blank">${status.repository}</a></p>
      <p><strong>Branch:</strong> ${status.branch}</p>
      <p><strong>Upload Path:</strong> ${status.uploadPath}</p>
      <p><strong>CDN URL:</strong> <a href="${
        window.GitHubConfig?.api?.cdnEndpoint ||
        `https://${status.repository.split("/")[0]}.github.io/${
          status.repository.split("/")[1]
        }`
      }" target="_blank">View CDN</a></p>
    </div>
  `;
}
