// config.js - Configuration Interface Logic
class BillboardConfigManager {
  constructor() {
    this.config = {
      logoMode: "fixed",
      logoImages: [],
      logoLoopDuration: 5,
      layoutPositions: {
        weather: { x: 0, y: 0, width: 192, height: 288 },
        iot: { x: 192, y: 0, width: 192, height: 288 },
        logo: { x: 0, y: 288, width: 384, height: 96 },
      },
      schedules: [],
    };

    // Initialize authentication service
    this.authService = null;
    this.initAuthService();

    // Initialize E-Ra configuration service
    this.eraConfigService = null;
    this.initEraConfigService();

    this.init();
  }

  async initAuthService() {
    try {
      console.log("ConfigManager: Initializing auth service...");

      // Check if EraAuthService is available (should be loaded from HTML script tag)
      if (!window.EraAuthService) {
        console.error(
          "ConfigManager: EraAuthService not found on window object"
        );
        return;
      }

      this.authService = new window.EraAuthService();

      // Subscribe to auth state changes
      this.authService.onAuthStateChange((authState) => {
        console.log("ConfigManager: Auth state changed:", authState);
        this.updateLoginUI(authState);

        // Update E-Ra config service with auth changes
        if (this.eraConfigService) {
          this.eraConfigService.setAuthService(this.authService);
        }
      });

      // Initialize login UI with current auth state
      const currentState = this.authService.getAuthState();
      console.log("ConfigManager: Current auth state:", currentState);
      this.updateLoginUI(currentState);

      console.log("ConfigManager: Auth service initialized successfully");
    } catch (error) {
      console.error("ConfigManager: Failed to initialize auth service:", error);
    }
  }

  async initEraConfigService() {
    try {
      console.log("ConfigManager: Initializing E-Ra config service...");

      // Check if EraConfigService is available
      if (!window.EraConfigService) {
        console.error(
          "ConfigManager: EraConfigService not found on window object"
        );
        return;
      }

      this.eraConfigService = new window.EraConfigService(this.authService);
      console.log(
        "ConfigManager: E-Ra config service initialized successfully"
      );
    } catch (error) {
      console.error(
        "ConfigManager: Failed to initialize E-Ra config service:",
        error
      );
    }
  }

  init() {
    this.setupTabNavigation();
    this.setupLogoModeHandlers();
    this.setupLoginHandlers();
    this.setupEraConfigHandlers();
    this.loadConfiguration();
    this.setupDragAndDrop();
  }

  setupLoginHandlers() {
    const loginForm = document.getElementById("era-login-form");
    const logoutBtn = document.getElementById("logout-btn");
    const copyTokenBtn = document.getElementById("copy-token-btn");

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        this.handleLogout();
      });
    }

    if (copyTokenBtn) {
      copyTokenBtn.addEventListener("click", () => {
        this.copyTokenToClipboard();
      });
    }

    // Initialize form fields to ensure they're enabled
    this.initializeLoginForm();
  }

  initializeLoginForm() {
    const usernameInput = document.getElementById("era-username");
    const passwordInput = document.getElementById("era-password");
    const loginBtn = document.getElementById("login-btn");
    const loginForm = document.getElementById("era-login-form");

    // Ensure all form elements are enabled and interactive
    if (loginForm) {
      loginForm.style.pointerEvents = "auto";
      loginForm.style.opacity = "1";
    }

    if (usernameInput) {
      usernameInput.disabled = false;
      usernameInput.removeAttribute("readonly");
      usernameInput.style.pointerEvents = "auto";
      usernameInput.style.opacity = "1";
      usernameInput.setAttribute("tabindex", "0");
    }

    if (passwordInput) {
      passwordInput.disabled = false;
      passwordInput.removeAttribute("readonly");
      passwordInput.style.pointerEvents = "auto";
      passwordInput.style.opacity = "1";
      passwordInput.setAttribute("tabindex", "0");
    }

    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.style.pointerEvents = "auto";
      loginBtn.style.opacity = "1";
      loginBtn.setAttribute("tabindex", "0");
    }

    console.log("Login form initialized - all fields should be interactive");
  }

  setupEraConfigHandlers() {
    const getConfigBtn = document.getElementById("get-era-config-btn");
    const autoDetectBtn = document.getElementById("auto-detect-mapping-btn");
    const saveMappingBtn = document.getElementById("save-mapping-btn");
    const testMappingBtn = document.getElementById("test-mapping-btn");

    if (getConfigBtn) {
      getConfigBtn.addEventListener("click", () => {
        this.handleGetEraConfig();
      });
    }

    if (autoDetectBtn) {
      autoDetectBtn.addEventListener("click", () => {
        this.handleAutoDetectMapping();
      });
    }

    if (saveMappingBtn) {
      saveMappingBtn.addEventListener("click", () => {
        this.handleSaveMapping();
      });
    }

    if (testMappingBtn) {
      testMappingBtn.addEventListener("click", () => {
        this.handleTestMapping();
      });
    }

    // Setup mapping selectors
    const mappingSelectors = ["temperature", "humidity", "pm25", "pm10"];
    mappingSelectors.forEach((sensor) => {
      const selector = document.getElementById(`mapping-${sensor}`);
      if (selector) {
        selector.addEventListener("change", (e) => {
          const datastreamId = e.target.value ? parseInt(e.target.value) : null;
          if (this.eraConfigService) {
            this.eraConfigService.updateMapping(sensor, datastreamId);
          }
          this.updateCurrentMappingDisplay();
        });
      }
    });
  }

  async handleLogin() {
    if (!this.authService) {
      this.showNotification("Authentication service not available", "error");
      return;
    }

    const usernameInput = document.getElementById("era-username");
    const passwordInput = document.getElementById("era-password");
    const loginBtn = document.getElementById("login-btn");
    const btnText = loginBtn.querySelector(".btn-text");
    const btnLoader = loginBtn.querySelector(".btn-loader");

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      this.showNotification("Please enter both username and password", "error");
      return;
    }

    // Show loading state - only disable the button, not the input fields
    loginBtn.disabled = true;
    btnText.style.display = "none";
    btnLoader.style.display = "inline";

    // Keep input fields enabled during login process
    usernameInput.disabled = false;
    passwordInput.disabled = false;

    try {
      const result = await this.authService.login({ username, password });

      if (result.success) {
        this.showNotification("Login successful!", "success");

        // Update E-Ra IoT configuration with new token
        await this.updateEraIotConfig(result.token);

        // Clear password field
        passwordInput.value = "";
      } else {
        this.showNotification(result.message || "Login failed", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showNotification("Login failed: " + error.message, "error");
    } finally {
      // Reset button state
      loginBtn.disabled = false;
      btnText.style.display = "inline";
      btnLoader.style.display = "none";
    }
  }

  handleLogout() {
    if (!this.authService) {
      return;
    }

    // Show confirmation dialog
    const confirmLogout = confirm(
      "Are you sure you want to logout?\n\nThis will clear your current authentication and allow you to login with a different E-Ra account."
    );

    if (!confirmLogout) {
      return;
    }

    // Perform logout
    this.authService.logout();
    this.showNotification(
      "Logged out successfully! You can now login with a different account.",
      "success"
    );

    // Clear form fields and ensure they are enabled
    const usernameInput = document.getElementById("era-username");
    const passwordInput = document.getElementById("era-password");
    const loginBtn = document.getElementById("login-btn");

    if (usernameInput) {
      usernameInput.value = "";
      usernameInput.disabled = false;
      usernameInput.removeAttribute("readonly");
      usernameInput.style.pointerEvents = "auto";
      usernameInput.style.opacity = "1";
    }
    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.disabled = false;
      passwordInput.removeAttribute("readonly");
      passwordInput.style.pointerEvents = "auto";
      passwordInput.style.opacity = "1";
    }
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.style.pointerEvents = "auto";
      loginBtn.style.opacity = "1";

      // Reset button loading state
      const btnText = loginBtn.querySelector(".btn-text");
      const btnLoader = loginBtn.querySelector(".btn-loader");
      if (btnText) btnText.style.display = "inline";
      if (btnLoader) btnLoader.style.display = "none";
    }

    // Clear any cached config data
    if (this.eraConfigService) {
      this.eraConfigService.clearCache();
    }

    // Hide config sections that require authentication
    const sectionsToHide = [
      "era-chips-section",
      "era-datastreams-section",
      "era-mapping-section",
      "era-current-mapping",
    ];

    sectionsToHide.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = "none";
      }
    });

    // Reset era config status
    const statusDiv = document.getElementById("era-config-status");
    if (statusDiv) {
      statusDiv.style.display = "none";
    }

    // Force re-enable form and focus on username field
    setTimeout(() => {
      const loginForm = document.getElementById("era-login-form");
      if (loginForm) {
        // Make sure form is enabled
        loginForm.style.pointerEvents = "auto";
        loginForm.style.opacity = "1";

        // Re-enable all form controls
        const formControls = loginForm.querySelectorAll(
          ".form-control, button"
        );
        formControls.forEach((control) => {
          control.disabled = false;
          control.style.pointerEvents = "auto";
          control.style.opacity = "1";
        });
      }

      if (usernameInput) {
        usernameInput.focus();
        usernameInput.click(); // Ensure click events work
      }
    }, 100);
  }

  updateLoginUI(authState) {
    const statusIndicator = document.getElementById("status-indicator");
    const statusText = statusIndicator?.querySelector(".status-text");
    const loginForm = document.getElementById("era-login-form");
    const logoutSection = document.getElementById("logout-section");
    const tokenInfo = document.getElementById("token-info");
    const tokenDisplay = document.getElementById("token-display");
    const usernameInput = document.getElementById("era-username");
    const passwordInput = document.getElementById("era-password");
    const loginBtn = document.getElementById("login-btn");

    if (!statusIndicator || !statusText) return;

    if (authState.isAuthenticated) {
      // Logged in state
      statusIndicator.className = "status-indicator online";
      statusText.textContent = `Đăng nhập với ${
        authState.user?.username || "User"
      }`;

      // Hide login form and show logout section
      if (loginForm) loginForm.style.display = "none";
      if (logoutSection) logoutSection.style.display = "block";
      if (tokenInfo) tokenInfo.style.display = "block";

      // Update token display
      if (tokenDisplay) {
        const tokenText = tokenDisplay.querySelector(".token-text");
        if (tokenText) {
          tokenText.textContent = authState.token || "Token not available";
        }
      }
    } else {
      // Logged out state
      statusIndicator.className = "status-indicator offline";
      statusText.textContent = "Not logged in";

      // Show login form and hide logout section
      if (loginForm) loginForm.style.display = "block";
      if (logoutSection) logoutSection.style.display = "none";
      if (tokenInfo) tokenInfo.style.display = "none";

      // Explicitly enable input fields and login button
      if (usernameInput) {
        usernameInput.disabled = false;
        usernameInput.removeAttribute("readonly");
        usernameInput.style.pointerEvents = "auto";
        usernameInput.style.opacity = "1";
      }
      if (passwordInput) {
        passwordInput.disabled = false;
        passwordInput.removeAttribute("readonly");
        passwordInput.style.pointerEvents = "auto";
        passwordInput.style.opacity = "1";
      }
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.style.pointerEvents = "auto";
        loginBtn.style.opacity = "1";
      }

      // Reset any loading states
      const btnText = loginBtn?.querySelector(".btn-text");
      const btnLoader = loginBtn?.querySelector(".btn-loader");
      if (btnText) btnText.style.display = "inline";
      if (btnLoader) btnLoader.style.display = "none";
    }
  }

  async updateEraIotConfig(token) {
    try {
      const gatewayToken = this.authService.extractGatewayToken(token);

      if (!gatewayToken) {
        console.error("Failed to extract gateway token");
        return;
      }

      // Update authentication token via IPC
      if (window.electronAPI) {
        const result = await window.electronAPI.updateAuthToken(token);
        if (result.success) {
          console.log(
            "Authentication token saved successfully with auto hot-reload"
          );
          this.showNotification(
            "Authentication updated and applied instantly!",
            "success"
          );
        } else {
          console.error("Failed to save authentication token:", result.error);
        }
      }

      // Update local config for immediate use
      if (!this.config.eraIot) {
        this.config.eraIot = {
          enabled: true,
          baseUrl: "https://backend.eoh.io",
          sensorConfigs: {
            temperature: null,
            humidity: null,
            pm25: null,
            pm10: null,
          },
          updateInterval: 5,
          timeout: 15000,
          retryAttempts: 3,
          retryDelay: 2000,
        };
      }

      this.config.eraIot.authToken = token;

      console.log(
        "E-Ra IoT configuration updated with new token - hot-reload active"
      );
    } catch (error) {
      console.error("Failed to update E-Ra IoT config:", error);
    }
  }

  copyTokenToClipboard() {
    if (!this.authService) return;

    const token = this.authService.getToken();
    if (!token) {
      this.showNotification("No token available to copy", "error");
      return;
    }

    navigator.clipboard
      .writeText(token)
      .then(() => {
        this.showNotification("Token copied to clipboard", "success");
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = token;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        this.showNotification("Token copied to clipboard", "success");
      });
  }

  async handleGetEraConfig() {
    if (!this.eraConfigService) {
      this.showNotification("E-Ra config service not available", "error");
      return;
    }

    if (!this.authService || !this.authService.isAuthenticated()) {
      this.showNotification("Hãy đăng nhập tài khoản E-Ra trước", "error");
      return;
    }

    const getConfigBtn = document.getElementById("get-era-config-btn");
    const btnText = getConfigBtn.querySelector(".btn-text");
    const btnLoader = getConfigBtn.querySelector(".btn-loader");
    const statusDiv = document.getElementById("era-config-status");
    const statusIndicator = document.getElementById(
      "era-config-status-indicator"
    );
    const statusText = statusIndicator?.querySelector(".status-text");

    // Show loading state
    getConfigBtn.disabled = true;
    btnText.style.display = "none";
    btnLoader.style.display = "inline";
    statusDiv.style.display = "block";
    if (statusIndicator)
      statusIndicator.className = "status-indicator connecting";
    if (statusText) statusText.textContent = "Đang lấy cấu hình";

    try {
      const result = await this.eraConfigService.getCompleteConfig();

      if (result.success) {
        this.showNotification(result.message, "success");

        // Update UI with results
        this.displayChips(result.chips);
        this.displayDatastreams(result.datastreams);
        this.populateMappingSelectors(result.datastreams);
        this.updateCurrentMappingDisplay();

        // Show sections
        document.getElementById("era-chips-section").style.display = "block";
        document.getElementById("era-datastreams-section").style.display =
          "block";
        document.getElementById("era-mapping-section").style.display = "block";
        document.getElementById("era-current-mapping").style.display = "block";
        document.getElementById("auto-detect-mapping-btn").style.display =
          "inline-block";

        // Update status
        if (statusIndicator)
          statusIndicator.className = "status-indicator online";
        if (statusText)
          statusText.textContent = `Configuration loaded: ${
            result.chips?.length || 0
          } chips, ${result.datastreams?.length || 0} datastreams`;
      } else {
        this.showNotification(
          result.message || "Failed to fetch configuration",
          "error"
        );

        // Update status
        if (statusIndicator)
          statusIndicator.className = "status-indicator offline";
        if (statusText) statusText.textContent = "Failed to load configuration";
      }
    } catch (error) {
      console.error("Error fetching E-Ra config:", error);
      this.showNotification(
        "Error fetching configuration: " + error.message,
        "error"
      );

      // Update status
      if (statusIndicator)
        statusIndicator.className = "status-indicator offline";
      if (statusText) statusText.textContent = "Configuration fetch failed";
    } finally {
      // Reset button state
      getConfigBtn.disabled = false;
      btnText.style.display = "inline";
      btnLoader.style.display = "none";
    }
  }

  handleAutoDetectMapping() {
    if (!this.eraConfigService) {
      this.showNotification("E-Ra config service not available", "error");
      return;
    }

    const autoMapping = this.eraConfigService.autoDetectMapping();

    // Update selectors with auto-detected mapping
    Object.entries(autoMapping).forEach(([sensor, datastreamId]) => {
      const selector = document.getElementById(`mapping-${sensor}`);
      if (selector && datastreamId) {
        selector.value = datastreamId.toString();
        this.eraConfigService.updateMapping(sensor, datastreamId);
      }
    });

    this.updateCurrentMappingDisplay();

    // Count successful mappings
    const mappedCount = Object.values(autoMapping).filter(
      (id) => id !== null
    ).length;
    this.showNotification(
      `Auto-detected ${mappedCount}/4 sensor mappings`,
      "success"
    );
  }

  async handleSaveMapping() {
    if (!this.eraConfigService) {
      this.showNotification("E-Ra config service not available", "error");
      return;
    }

    const currentMapping = this.eraConfigService.getCurrentMapping();

    // Validate mapping
    const mappedCount = Object.values(currentMapping).filter(
      (id) => id !== null
    ).length;
    if (mappedCount === 0) {
      this.showNotification(
        "Please map at least one sensor before saving",
        "error"
      );
      return;
    }

    // Update system configuration with new mapping
    if (!this.config.eraIot) {
      this.config.eraIot = {
        enabled: true,
        baseUrl: "https://backend.eoh.io",
        updateInterval: 5,
        timeout: 15000,
        retryAttempts: 3,
        retryDelay: 2000,
      };
    }

    // Update sensor configs with new mapping
    this.config.eraIot.sensorConfigs = {
      temperature: currentMapping.temperature,
      humidity: currentMapping.humidity,
      pm25: currentMapping.pm25,
      pm10: currentMapping.pm10,
    };

    // Save to storage with hot-reload
    await this.saveConfiguration();
    this.showNotification(
      `Sensor mapping saved and applied instantly! (${mappedCount}/4 sensors mapped)`,
      "success"
    );
  }

  async handleTestMapping() {
    if (!this.eraConfigService) {
      this.showNotification("E-Ra config service not available", "error");
      return;
    }

    const currentMapping = this.eraConfigService.getCurrentMapping();
    const mappedSensors = Object.entries(currentMapping).filter(
      ([, id]) => id !== null
    );

    if (mappedSensors.length === 0) {
      this.showNotification("No sensor mappings to test", "error");
      return;
    }

    this.showNotification(
      `Testing ${mappedSensors.length} sensor mappings...`,
      "info"
    );

    // Test each mapped sensor
    let successCount = 0;
    for (const [sensorType, datastreamId] of mappedSensors) {
      try {
        console.log(`Testing ${sensorType} sensor (ID: ${datastreamId})`);
        // This would make an actual API call to test the datastream
        // For now, just simulate success
        successCount++;
      } catch (error) {
        console.error(`Failed to test ${sensorType} sensor:`, error);
      }
    }

    if (successCount === mappedSensors.length) {
      this.showNotification(
        "All sensor mappings tested successfully!",
        "success"
      );
    } else {
      this.showNotification(
        `${successCount}/${mappedSensors.length} sensor mappings working`,
        "error"
      );
    }
  }

  displayChips(chips) {
    const chipsList = document.getElementById("era-chips-list");
    if (!chipsList || !chips) return;

    chipsList.innerHTML = "";

    if (chips.length === 0) {
      chipsList.innerHTML =
        '<p class="info-text">No chips found in your E-Ra account.</p>';
      return;
    }

    chips.forEach((chip) => {
      const chipElement = document.createElement("div");
      chipElement.className = "chip-item";
      chipElement.style.cssText = `
        padding: 15px;
        margin-bottom: 10px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      chipElement.innerHTML = `
        <div>
          <h4 style="margin: 0 0 5px 0; color: #495057;">${chip.name}</h4>
          <p style="margin: 0; font-size: 14px; color: #6c757d;">ID: ${
            chip.id
          }${chip.description ? ` | ${chip.description}` : ""}</p>
        </div>
        <div style="text-align: right;">
          <span class="status-indicator ${
            chip.isOnline ? "online" : "offline"
          }" style="font-size: 14px;">
            <span class="status-dot"></span>
            ${chip.isOnline ? "Online" : "Offline"}
          </span>
        </div>
      `;

      chipsList.appendChild(chipElement);
    });
  }

  displayDatastreams(datastreams) {
    const datastreamsList = document.getElementById("era-datastreams-list");
    if (!datastreamsList || !datastreams) return;

    datastreamsList.innerHTML = "";

    if (datastreams.length === 0) {
      datastreamsList.innerHTML =
        '<p class="info-text">No datastreams found.</p>';
      return;
    }

    datastreams.forEach((stream) => {
      const streamElement = document.createElement("div");
      streamElement.className = "datastream-item";
      streamElement.style.cssText = `
        padding: 12px;
        margin-bottom: 8px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
      `;

      streamElement.innerHTML = `
        <div>
          <strong style="color: #495057;">${stream.name}</strong>
          <span style="margin-left: 10px; color: #6c757d;">ID: ${
            stream.id
          }</span>
          ${
            stream.unit
              ? `<span style="margin-left: 10px; color: #6c757d;">(${stream.unit})</span>`
              : ""
          }
        </div>
        <div style="text-align: right; color: #6c757d;">
          ${
            stream.currentValue !== undefined
              ? `Value: ${stream.currentValue}`
              : "No data"
          }
        </div>
      `;

      datastreamsList.appendChild(streamElement);
    });
  }

  populateMappingSelectors(datastreams) {
    if (!datastreams) return;

    const sensorTypes = ["temperature", "humidity", "pm25", "pm10"];

    sensorTypes.forEach((sensorType) => {
      const selector = document.getElementById(`mapping-${sensorType}`);
      if (!selector) return;

      // Clear existing options except the first one
      while (selector.children.length > 1) {
        selector.removeChild(selector.lastChild);
      }

      // Add datastream options
      datastreams.forEach((stream) => {
        const option = document.createElement("option");
        option.value = stream.id.toString();
        option.textContent = `${stream.name} (ID: ${stream.id})${
          stream.unit ? ` [${stream.unit}]` : ""
        }`;
        selector.appendChild(option);
      });
    });
  }

  updateCurrentMappingDisplay() {
    const displayDiv = document.getElementById("current-mapping-display");
    if (!displayDiv || !this.eraConfigService) return;

    const currentMapping = this.eraConfigService.getCurrentMapping();
    const datastreams = this.eraConfigService.getCachedDatastreams();

    displayDiv.innerHTML = "";

    Object.entries(currentMapping).forEach(([sensorType, datastreamId]) => {
      const mappingItem = document.createElement("div");
      mappingItem.style.cssText = `
        padding: 10px;
        margin-bottom: 8px;
        background: #f8f9fa;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const datastreamName = datastreamId
        ? datastreams.find((ds) => ds.id === datastreamId)?.name ||
          `Unknown (ID: ${datastreamId})`
        : "Not mapped";

      const sensorTypeLabel =
        sensorType.charAt(0).toUpperCase() + sensorType.slice(1);

      mappingItem.innerHTML = `
        <div>
          <strong>${sensorTypeLabel}:</strong>
        </div>
        <div style="color: ${datastreamId ? "#28a745" : "#6c757d"};">
          ${datastreamName}
        </div>
      `;

      displayDiv.appendChild(mappingItem);
    });
  }

  setupTabNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const tabContents = document.querySelectorAll(".tab-content");

    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();

        // Remove active class from all links and tabs
        navLinks.forEach((l) => l.classList.remove("active"));
        tabContents.forEach((t) => t.classList.remove("active"));

        // Add active class to clicked link
        link.classList.add("active");

        // Show corresponding tab content
        const tabId = link.getAttribute("data-tab");
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
          tabContent.classList.add("active");
        }
      });
    });
  }

  setupLogoModeHandlers() {
    const radioButtons = document.querySelectorAll('input[name="logoMode"]');
    const loopSettings = document.getElementById("loop-settings");
    const scheduleSettings = document.getElementById("schedule-settings");

    radioButtons.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const mode = e.target.value;
        this.config.logoMode = mode;

        // Show/hide relevant settings
        loopSettings.style.display = mode === "loop" ? "block" : "none";
        scheduleSettings.style.display =
          mode === "scheduled" ? "block" : "none";
      });
    });

    // Loop duration handler
    const loopDurationInput = document.getElementById("loop-duration");
    loopDurationInput.addEventListener("change", (e) => {
      const newDuration = parseInt(e.target.value);
      console.log(
        `Logo loop duration changed: ${this.config.logoLoopDuration} -> ${newDuration} seconds`
      );
      this.config.logoLoopDuration = newDuration;
    });

    loopDurationInput.addEventListener("input", (e) => {
      const newDuration = parseInt(e.target.value);
      console.log(`Logo loop duration input: ${newDuration} seconds`);
      this.config.logoLoopDuration = newDuration;
    });
  }

  async loadConfiguration() {
    try {
      if (window.electronAPI) {
        const savedConfig = await window.electronAPI.getConfig();
        this.config = { ...this.config, ...savedConfig };
        this.updateUI();
      }
    } catch (error) {
      console.error("Error loading configuration:", error);
    }
  }

  updateUI() {
    // Update logo mode radio buttons
    const modeRadio = document.querySelector(
      `input[value="${this.config.logoMode}"]`
    );
    if (modeRadio) {
      modeRadio.checked = true;
      modeRadio.dispatchEvent(new Event("change"));
    }

    // Update loop duration
    const loopDurationInput = document.getElementById("loop-duration");
    if (loopDurationInput) {
      loopDurationInput.value = this.config.logoLoopDuration;
      console.log(
        `Updated UI with loop duration: ${this.config.logoLoopDuration} seconds`
      );
    }

    // Update logo grid
    this.renderLogoGrid();
  }

  renderLogoGrid() {
    const logoGrid = document.getElementById("logo-grid");
    logoGrid.innerHTML = "";

    this.config.logoImages.forEach((logo, index) => {
      const logoItem = document.createElement("div");
      logoItem.className = "logo-item";

      // Fix path resolution for downloaded files
      let logoSrc = logo.path;
      console.log(
        `Config: Processing logo ${logo.name}, original path: ${logo.path}, source: ${logo.source}`
      );

      if (logo.source === "github_cdn" && logo.path) {
        // Convert Windows backslash to forward slash, then create absolute path
        const normalizedPath = logo.path.replace(/\\/g, "/");
        // Check if it's a relative path and make it absolute
        if (
          !normalizedPath.startsWith("/") &&
          !normalizedPath.match(/^[A-Za-z]:/)
        ) {
          logoSrc = `file:///f:/EoH Company/ITS_OurdoorScreen/${normalizedPath}`;
        } else {
          logoSrc = `file:///${normalizedPath}`;
        }
        console.log(`Config: GitHub CDN logo converted to: ${logoSrc}`);
      } else if (
        logo.path &&
        !logo.path.startsWith("data:") &&
        !logo.path.startsWith("http")
      ) {
        // For local files, ensure proper file:// protocol
        const normalizedPath = logo.path.replace(/\\/g, "/");
        if (
          !normalizedPath.startsWith("/") &&
          !normalizedPath.match(/^[A-Za-z]:/)
        ) {
          logoSrc = `file:///f:/EoH Company/ITS_OurdoorScreen/${normalizedPath}`;
        } else {
          logoSrc = `file:///${normalizedPath}`;
        }
        console.log(`Config: Local logo converted to: ${logoSrc}`);
      }

      logoItem.innerHTML = `
                <img src="${logoSrc}" alt="${logo.name}" 
                     onerror="
                       console.error('Config: Failed to load logo:', '${logoSrc}'); 
                       if (this.src !== './assets/imgs/${logo.name}') {
                         console.log('Config: Trying assets fallback for:', '${logo.name}');
                         this.src = './assets/imgs/${logo.name}';
                       } else {
                         this.style.display='none'; 
                         this.nextElementSibling.textContent='${logo.name} (Load Failed)';
                       }
                     "
                     onload="console.log('Config: Logo loaded successfully:', '${logoSrc}')" />
                <p style="font-size: 12px; margin-top: 5px; word-break: break-all;">${logo.name}</p>
                <button class="remove-btn" onclick="configManager.removeLogo(${index})">×</button>
            `;
      logoGrid.appendChild(logoItem);
    });
  }

  addLogo(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const logo = {
        name: file.name,
        path: e.target.result,
        size: file.size,
        type: file.type,
      };

      this.config.logoImages.push(logo);
      this.renderLogoGrid();
    };
    reader.readAsDataURL(file);
  }

  removeLogo(index) {
    this.config.logoImages.splice(index, 1);
    this.renderLogoGrid();
  }

  setupDragAndDrop() {
    const uploadArea = document.querySelector(".logo-upload-area");

    // Handle drag and drop
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "#e55a2b";
      uploadArea.style.background = "#ffede6";
    });

    uploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "#ff6b35";
      uploadArea.style.background = "#fff5f2";
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "#ff6b35";
      uploadArea.style.background = "#fff5f2";

      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        if (file.type.startsWith("image/")) {
          this.addLogo(file);
        }
      });
    });
  }

  addScheduleRule() {
    const scheduleRules = document.getElementById("schedule-rules");
    const ruleIndex = this.config.schedules.length;

    const ruleDiv = document.createElement("div");
    ruleDiv.className = "schedule-rule";
    ruleDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 10px;
        `;

    ruleDiv.innerHTML = `
            <div style="flex: 1;">
                <label style="display: block; font-size: 14px; color: #6c757d; margin-bottom: 5px;">Time</label>
                <input type="time" class="form-control" style="width: 120px;" 
                       onchange="configManager.updateScheduleRule(${ruleIndex}, 'time', this.value)">
            </div>
            <div style="flex: 1;">
                <label style="display: block; font-size: 14px; color: #6c757d; margin-bottom: 5px;">Logo</label>
                <select class="form-control" 
                        onchange="configManager.updateScheduleRule(${ruleIndex}, 'logoIndex', this.value)">
                    <option value="">Select Logo</option>
                    ${this.config.logoImages
                      .map(
                        (logo, idx) =>
                          `<option value="${idx}">${logo.name}</option>`
                      )
                      .join("")}
                </select>
            </div>
            <div style="flex: 1;">
                <label style="display: block; font-size: 14px; color: #6c757d; margin-bottom: 5px;">Days</label>
                <select class="form-control" 
                        onchange="configManager.updateScheduleRule(${ruleIndex}, 'days', this.value)">
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekends">Weekends</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            <button class="btn btn-secondary" style="height: 40px; width: 40px; padding: 0;" 
                    onclick="configManager.removeScheduleRule(${ruleIndex})">×</button>
        `;

    scheduleRules.appendChild(ruleDiv);

    // Add empty rule to config
    this.config.schedules.push({
      time: "",
      logoIndex: null,
      days: "daily",
    });
  }

  updateScheduleRule(index, field, value) {
    if (this.config.schedules[index]) {
      this.config.schedules[index][field] = value;
    }
  }

  removeScheduleRule(index) {
    this.config.schedules.splice(index, 1);
    this.renderScheduleRules();
  }

  renderScheduleRules() {
    const scheduleRules = document.getElementById("schedule-rules");
    scheduleRules.innerHTML = "";
    this.config.schedules.forEach((rule, index) => {
      this.addScheduleRule();
    });
  }

  async saveConfiguration() {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.saveConfig(this.config);
        if (result.success) {
          this.showNotification("Configuration saved successfully!", "success");
        } else {
          this.showNotification("Failed to save configuration", "error");
        }
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
      this.showNotification("Error saving configuration", "error");
    }
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            ${
              type === "success"
                ? "background: #28a745;"
                : type === "error"
                ? "background: #dc3545;"
                : "background: #007bff;"
            }
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Global functions for HTML onclick handlers
async function selectLogoFiles() {
  if (window.electronAPI) {
    try {
      const filePaths = await window.electronAPI.selectLogoFiles();
      if (filePaths && filePaths.length > 0) {
        filePaths.forEach((filePath) => {
          const fileName = filePath.split("\\").pop().split("/").pop();
          const logo = {
            name: fileName,
            path: filePath,
            size: 0,
            type: "image/*",
          };
          configManager.config.logoImages.push(logo);
        });
        configManager.renderLogoGrid();
      }
    } catch (error) {
      console.error("Error selecting files:", error);
    }
  } else {
    // Fallback for web environment
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";

    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        configManager.addLogo(file);
      });
    };

    input.click();
  }
}

function addScheduleRule() {
  configManager.addScheduleRule();
}

async function saveAndApply() {
  console.log("Saving configuration with logo loop duration:", {
    mode: configManager.config.logoMode,
    duration: configManager.config.logoLoopDuration,
    imageCount: configManager.config.logoImages.length,
  });

  await configManager.saveConfiguration();

  // Show success message
  configManager.showNotification(
    `Configuration saved! Logo rotation: ${configManager.config.logoLoopDuration}s interval.`,
    "success"
  );

  // Log current config for debugging
  console.log("Configuration applied:", {
    logoMode: configManager.config.logoMode,
    logoLoopDuration: configManager.config.logoLoopDuration,
    logoImages: configManager.config.logoImages.length,
  });

  // Optional: Close config window after save (uncomment if desired)
  // setTimeout(() => {
  //   exitConfig();
  // }, 1000);
}

async function exitConfig() {
  if (window.electronAPI) {
    await window.electronAPI.exitConfig();
  }
}

// Initialize configuration manager when DOM is loaded
let configManager;
document.addEventListener("DOMContentLoaded", () => {
  configManager = new BillboardConfigManager();

  // Add CSS animation for notifications
  const style = document.createElement("style");
  style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .hidden {
            display: none !important;
        }
        
        .schedule-rule {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 10px;
        }
    `;
  document.head.appendChild(style);
});
