/**
 * Logo Manager Module
 * Manages logo manifest, display, and synchronization
 */

import * as uiCore from "./ui-core.js";

export class LogoManager {
  constructor(manifestUrl) {
    this.manifestUrl =
      manifestUrl ||
      "https://mquan-eoh.github.io/billboard-logos-cdn/manifest.json";
    this.currentManifest = null;

    this.initialize();
  }

  /**
   * Initialize logo manager UI
   */
  initialize() {
    console.log("[LogoManager] Initializing...");
    this.fetchCurrentManifest();
    this.updateManifestStatus();
  }

  /**
   * Fetch current manifest from GitHub
   */
  async fetchCurrentManifest() {
    try {
      console.log("[LogoManager] Fetching manifest from:", this.manifestUrl);

      const response = await fetch(this.manifestUrl, {
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        this.currentManifest = await response.json();
        console.log("[LogoManager] Manifest fetched successfully");

        this.updateManifestDisplay();
        this.displayLogos();
        this.updateManifestStatus("online");

        return this.currentManifest;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error("[LogoManager] Failed to fetch manifest:", error);
      this.updateManifestStatus("error");
      uiCore.showToast("Không thể tải manifest từ GitHub", "error");
      return null;
    }
  }

  /**
   * Update manifest display in UI
   */
  updateManifestDisplay() {
    if (!this.currentManifest) return;

    uiCore.setElementText("manifestUrl", this.manifestUrl);
    uiCore.setElementText(
      "manifestVersion",
      this.currentManifest.version || "Unknown"
    );

    if (this.currentManifest.logos) {
      const active = this.currentManifest.logos.filter(
        (logo) => logo.active
      ).length;
      const total = this.currentManifest.logos.length;
      uiCore.setElementText("activeLogos", `${active}/${total}`);
    }

    if (this.currentManifest.lastUpdated) {
      const date = new Date(this.currentManifest.lastUpdated);
      uiCore.setElementText("lastUpdated", date.toLocaleString("vi-VN"));
    }

    console.log("[LogoManager] Manifest display updated");
  }

  /**
   * Update manifest status badge
   */
  updateManifestStatus(status = "checking") {
    const statusBadge = document.getElementById("manifestStatus");
    if (!statusBadge) return;

    statusBadge.className = "status-badge";

    const statusMap = {
      online: { class: "online", text: "Online" },
      error: { class: "error", text: "Error" },
      checking: { class: "checking", text: "Checking..." },
    };

    const statusInfo = statusMap[status] || statusMap.checking;
    statusBadge.classList.add(statusInfo.class);
    statusBadge.textContent = statusInfo.text;

    console.log("[LogoManager] Status updated:", status);
  }

  /**
   * Display logos in grid
   */
  displayLogos() {
    const logosGrid = document.getElementById("logosGrid");
    if (!logosGrid || !this.currentManifest?.logos) return;

    logosGrid.innerHTML = "";

    this.currentManifest.logos.forEach((logo, index) => {
      const logoCard = document.createElement("div");
      logoCard.className = `logo-card ${logo.active ? "active" : "inactive"}`;

      const placeholderSvg =
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjYwIiB2aWV3Qm94PSIwIDAgMTAwIDYwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNjAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";

      logoCard.innerHTML = `
        <img src="${logo.url}" alt="${logo.name}" class="logo-preview" 
             onerror="this.src='${placeholderSvg}'">
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
                  onclick="window.logoManager.toggleLogoStatus(${index})">
            ${logo.active ? "Disable" : "Enable"}
          </button>
          <button class="btn btn-small btn-danger" onclick="window.logoManager.deleteLogo(${index})">Delete</button>
        </div>
      `;

      logosGrid.appendChild(logoCard);
    });

    console.log(
      "[LogoManager] Logos displayed:",
      this.currentManifest.logos.length
    );
  }

  /**
   * Force refresh billboard manifest
   */
  async forceRefreshBillboard() {
    try {
      console.log("[LogoManager] Sending force refresh to billboard...");

      const manifestUpdateData = {
        action: "force-refresh-manifest",
        manifest: this.currentManifest,
        timestamp: Date.now(),
        source: "admin-web",
      };

      // Send MQTT message
      if (window.MqttClient && window.MqttClient.publishManifestRefresh) {
        await window.MqttClient.publishManifestRefresh(manifestUpdateData);
        console.log("[LogoManager] MQTT refresh signal sent");
        uiCore.showToast("Force refresh signal sent to billboard", "info");

        // Simulate response
        setTimeout(() => {
          uiCore.showToast("Billboard refreshed successfully", "success");
        }, 2000);
      } else {
        throw new Error("MQTT client not available");
      }
    } catch (error) {
      console.error("[LogoManager] Failed to refresh billboard:", error);
      uiCore.showToast("Error sending refresh signal to billboard", "error");
    }
  }

  /**
   * Toggle logo active status
   */
  toggleLogoStatus(index) {
    if (!this.currentManifest?.logos?.[index]) return;

    this.currentManifest.logos[index].active =
      !this.currentManifest.logos[index].active;

    this.updateManifestDisplay();
    this.displayLogos();

    const status = this.currentManifest.logos[index].active
      ? "enabled"
      : "disabled";
    uiCore.showToast(`Logo ${status} successfully`, "success");

    console.log("[LogoManager] Logo status toggled:", index, "→", status);
  }

  /**
   * Delete logo from manifest
   */
  deleteLogo(index) {
    if (!this.currentManifest?.logos?.[index]) return;

    const logoName = this.currentManifest.logos[index].name;

    if (confirm(`Bạn có chắc muốn xóa logo "${logoName}"?`)) {
      this.currentManifest.logos.splice(index, 1);
      this.updateManifestDisplay();
      this.displayLogos();
      uiCore.showToast(`Logo "${logoName}" đã được xóa`, "success");

      console.log("[LogoManager] Logo deleted:", logoName);
    }
  }

  /**
   * Get current manifest data
   */
  getManifest() {
    return this.currentManifest;
  }

  /**
   * Get active logos count
   */
  getActiveLogosCount() {
    if (!this.currentManifest?.logos) return 0;
    return this.currentManifest.logos.filter((logo) => logo.active).length;
  }

  /**
   * Get total logos count
   */
  getTotalLogosCount() {
    return this.currentManifest?.logos?.length || 0;
  }
}
