// billboard.js - Enhanced main billboard display with config support
class BillboardApp {
  constructor() {
    this.config = null;
    this.logoRotationInterval = null;
    this.currentLogoIndex = 0;

    this.init();
  }

  async init() {
    console.log("Billboard App initializing...");
    await this.loadConfig();
    this.createBillboardLayout();
    this.setupConfigListener();
    this.addInteractiveFeatures();
    this.startLogoRotation();
  }

  async loadConfig() {
    try {
      if (window.electronAPI) {
        this.config = await window.electronAPI.getConfig();
        console.log("Config loaded:", this.config);
      } else {
        // Fallback default config for standalone mode
        this.config = {
          logoMode: "fixed",
          logoImages: [],
          logoLoopDuration: 5,
          layoutPositions: {
            weather: { x: 0, y: 0, width: 192, height: 288 },
            iot: { x: 192, y: 0, width: 192, height: 288 },
            logo: { x: 0, y: 288, width: 384, height: 96 },
          },
        };
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }
  }

  setupConfigListener() {
    if (window.electronAPI) {
      window.electronAPI.onConfigUpdated((event, newConfig) => {
        console.log("Config updated:", newConfig);
        this.config = newConfig;
        this.applyConfigChanges();
      });
    }
  }

  applyConfigChanges() {
    // Update logo display
    this.updateLogoDisplay();

    // Restart logo rotation if needed
    if (this.config.logoMode === "loop") {
      this.startLogoRotation();
    } else {
      this.stopLogoRotation();
    }

    // Update layout positions if changed
    this.updateLayoutPositions();
  }

  createBillboardLayout() {
    const root = document.getElementById("root");
    if (!root) return;

    // Clear existing content
    root.innerHTML = "";

    const container = document.createElement("div");
    container.className = "billboard-container";
    container.style.cssText = `
            width: 384px;
            height: 384px;
            display: flex;
            flex-direction: column;
            background-color: #000;
            color: white;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            position: relative;
        `;

    // Create top row with weather and IoT panels
    const topRow = this.createTopRow();

    // Create bottom row with company logo
    const bottomRow = this.createBottomRow();

    container.appendChild(topRow);
    container.appendChild(bottomRow);
    root.appendChild(container);
  }

  createTopRow() {
    const topRow = document.createElement("div");
    topRow.style.cssText = `
            flex: 3;
            display: flex;
            flex-direction: row;
        `;

    const leftColumn = this.createWeatherPanel();
    const rightColumn = this.createIoTPanel();

    topRow.appendChild(leftColumn);
    topRow.appendChild(rightColumn);

    return topRow;
  }

  createWeatherPanel() {
    const weatherPanel = document.createElement("div");
    weatherPanel.id = "weather-panel";
    weatherPanel.style.cssText = `
            flex: 1;
            background-color: #1a1a2e;
            padding: 10px;
            border: 2px solid #ff0000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
        `;

    weatherPanel.innerHTML = `
            <h3 style="font-size: 14px; margin-bottom: 8px; margin-top: 0;">TP. THỪA THIÊN HUẾ</h3>
            <div style="font-size: 32px; font-weight: bold;">24,2°</div>
            <div style="font-size: 12px;">-29,7°</div>
            <div style="font-size: 12px;">Độ ẩm 95% | UV Thấp</div>
            <div style="font-size: 12px;">Mưa 97% | Gió 1,6 km/h</div>
            <div style="font-size: 10px; margin-top: 5px;">Chất lượng không khí: Tốt</div>
        `;

    return weatherPanel;
  }

  createIoTPanel() {
    const iotPanel = document.createElement("div");
    iotPanel.id = "iot-panel";
    iotPanel.style.cssText = `
            flex: 1;
            background-color: #16213e;
            padding: 10px;
            border: 2px solid #ff0000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
        `;

    iotPanel.innerHTML = `
            <h3 style="font-size: 14px; margin-bottom: 8px; margin-top: 0;">THIẾT BỊ ĐO</h3>
            <div style="font-size: 14px; margin-bottom: 4px;">Nhiệt độ: 24,0°</div>
            <div style="font-size: 14px; margin-bottom: 4px;">Độ ẩm: 96%</div>
            <div style="font-size: 14px; margin-bottom: 4px;">PM2.5: 2,06 μg</div>
            <div style="font-size: 14px; margin-bottom: 4px;">PM10: 2,4 μg</div>
            <div style="font-size: 12px; background-color: green; padding: 2px 6px; border-radius: 3px; margin-top: 5px;">
                TỐT
            </div>
        `;

    return iotPanel;
  }

  createBottomRow() {
    const bottomRow = document.createElement("div");
    bottomRow.id = "company-logo-section";
    bottomRow.style.cssText = `
            flex: 1;
            background-color: #ff6b35;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            position: relative;
            overflow: hidden;
        `;

    this.updateLogoDisplay(bottomRow);
    return bottomRow;
  }

  updateLogoDisplay(container = null) {
    const logoSection =
      container || document.getElementById("company-logo-section");
    if (!logoSection) return;

    logoSection.innerHTML = "";

    if (this.config.logoImages && this.config.logoImages.length > 0) {
      const currentLogo = this.getCurrentLogo();
      if (currentLogo) {
        this.renderCustomLogo(logoSection, currentLogo);
      } else {
        this.renderDefaultLogo(logoSection);
      }
    } else {
      this.renderDefaultLogo(logoSection);
    }
  }

  getCurrentLogo() {
    if (!this.config.logoImages || this.config.logoImages.length === 0) {
      return null;
    }

    switch (this.config.logoMode) {
      case "fixed":
        return this.config.logoImages[0];

      case "loop":
        return this.config.logoImages[
          this.currentLogoIndex % this.config.logoImages.length
        ];

      case "scheduled":
        return this.getScheduledLogo();

      default:
        return this.config.logoImages[0];
    }
  }

  getScheduledLogo() {
    const now = new Date();
    const currentTime =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    // Find matching schedule
    const matchingSchedule = this.config.schedules.find((schedule) => {
      if (schedule.time === currentTime) {
        // Check day matching logic here
        return true;
      }
      return false;
    });

    if (matchingSchedule) {
      return this.config.logoImages[matchingSchedule.logoIndex];
    }

    // Fallback to first logo
    return this.config.logoImages[0];
  }

  renderCustomLogo(container, logo) {
    const logoImg = document.createElement("img");
    logoImg.src = logo.path;
    logoImg.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            border-radius: 0;
        `;

    logoImg.onerror = () => {
      this.renderDefaultLogo(container);
    };

    container.appendChild(logoImg);
  }

  renderDefaultLogo(container) {
    // Default logo circle
    const logoCircle = document.createElement("div");
    logoCircle.style.cssText = `
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background-color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-size: 36px;
            font-weight: bold;
            color: #ff6b35;
            cursor: pointer;
        `;
    logoCircle.textContent = "C";
    logoCircle.id = "company-logo";

    // Text container
    const textContainer = document.createElement("div");
    textContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            color: white;
        `;

    const mainText = document.createElement("div");
    mainText.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            line-height: 1.2;
            margin: 0;
        `;
    mainText.textContent = "CÔNG TY";

    const subText = document.createElement("div");
    subText.style.cssText = `
            font-size: 12px;
            line-height: 1.2;
            margin: 0;
            opacity: 0.9;
        `;
    subText.textContent = "VÌ CUỘC SỐNG TỐT ĐẸP HƠN";

    textContainer.appendChild(mainText);
    textContainer.appendChild(subText);

    container.appendChild(logoCircle);
    container.appendChild(textContainer);
  }

  startLogoRotation() {
    this.stopLogoRotation(); // Clear existing interval

    if (
      this.config.logoMode === "loop" &&
      this.config.logoImages &&
      this.config.logoImages.length > 1
    ) {
      const duration = (this.config.logoLoopDuration || 5) * 1000;

      this.logoRotationInterval = setInterval(() => {
        this.currentLogoIndex++;
        this.updateLogoDisplay();
      }, duration);
    }
  }

  stopLogoRotation() {
    if (this.logoRotationInterval) {
      clearInterval(this.logoRotationInterval);
      this.logoRotationInterval = null;
    }
  }

  updateLayoutPositions() {
    // Implementation for dynamic layout positioning
    // This would adjust the positions of weather, IoT, and logo sections
    // based on the config.layoutPositions
    console.log("Layout positions updated:", this.config.layoutPositions);
  }

  addInteractiveFeatures() {
    // Click events for panels
    const weatherPanel = document.getElementById("weather-panel");
    if (weatherPanel) {
      weatherPanel.addEventListener("click", () => {
        console.log("Weather panel clicked!");
        this.updateWeatherData();
      });
    }

    const iotPanel = document.getElementById("iot-panel");
    if (iotPanel) {
      iotPanel.addEventListener("click", () => {
        console.log("IoT panel clicked!");
        this.updateIoTData();
      });
    }

    // Keyboard events
    document.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "1":
          weatherPanel?.click();
          break;
        case "2":
          iotPanel?.click();
          break;
        case "r":
        case "R":
          this.refreshAllData();
          break;
      }
    });
  }

  updateWeatherData() {
    // Simulate weather data update
    const weatherPanel = document.getElementById("weather-panel");
    if (weatherPanel) {
      const temp = (20 + Math.random() * 15).toFixed(1);
      const humidity = (70 + Math.random() * 30).toFixed(0);

      weatherPanel.innerHTML = `
                <h3 style="font-size: 14px; margin-bottom: 8px; margin-top: 0;margin-left: 70px;">TP. THỪA THIÊN HUẾ</h3>
                <div style="font-size: 32px; font-weight: bold;">${temp}°</div>
                <div style="font-size: 14px;">Độ ẩm ${humidity}% | UV Thấp</div>
                <div style="font-size: 12px;">Mưa ${Math.floor(
                  Math.random() * 100
                )}% | Gió ${(Math.random() * 5).toFixed(1)} km/h</div>
                <div style="font-size: 10px; margin-top: 5px;">Chất lượng không khí: Tốt</div>
            `;
    }
  }

  updateIoTData() {
    // Simulate IoT data update
    const iotPanel = document.getElementById("iot-panel");
    if (iotPanel) {
      const temp = (20 + Math.random() * 10).toFixed(1);
      const humidity = (80 + Math.random() * 20).toFixed(0);
      const pm25 = (1 + Math.random() * 3).toFixed(2);
      const pm10 = (2 + Math.random() * 4).toFixed(1);

      iotPanel.innerHTML = `
                <h3 style="font-size: 14px; margin-bottom: 8px; margin-top: 0;">THIẾT BỊ ĐO</h3>
                <div style="font-size: 14px; margin-bottom: 4px;">Nhiệt độ: ${temp}°</div>
                <div style="font-size: 14px; margin-bottom: 4px;">Độ ẩm: ${humidity}%</div>
                <div style="font-size: 14px; margin-bottom: 4px;">PM2.5: ${pm25} μg</div>
                <div style="font-size: 14px; margin-bottom: 4px;">PM10: ${pm10} μg</div>
                <div style="font-size: 12px; background-color: green; padding: 2px 6px; border-radius: 3px; margin-top: 5px;">
                    TỐT
                </div>
            `;
    }
  }

  refreshAllData() {
    console.log("Refreshing all data...");
    this.updateWeatherData();
    this.updateIoTData();
    this.showAlert("All data refreshed!");
  }

  showAlert(message) {
    const alertDiv = document.createElement("div");
    alertDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #ff6b35;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
        `;
    alertDiv.textContent = message;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
      if (document.body.contains(alertDiv)) {
        document.body.removeChild(alertDiv);
      }
    }, 2000);
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("Billboard display starting...");
  const app = new BillboardApp();

  // Export for console debugging
  window.billboardApp = {
    app,
    updateWeatherData: () => app.updateWeatherData(),
    updateIoTData: () => app.updateIoTData(),
    refreshAllData: () => app.refreshAllData(),
    showAlert: (msg) => app.showAlert(msg),
  };
});
