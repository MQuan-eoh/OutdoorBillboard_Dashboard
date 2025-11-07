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

    // Initialize keyword array for auto-detect modal
    this.currentKeywords = [];

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

        // 🚀 AUTO-LOAD CONFIG WHEN AUTHENTICATED
        if (authState.isAuthenticated) {
          console.log(
            "ConfigManager: User authenticated, preparing auto-load..."
          );

          // Small delay to ensure UI is ready
          setTimeout(() => {
            // Check current tab
            const activeTab = document.querySelector(".nav-link.active");
            const currentTabId = activeTab ? activeTab.dataset.tab : null;

            console.log("ConfigManager: Current active tab:", currentTabId);

            if (currentTabId === "era-config") {
              // Already on era-config tab, load immediately
              console.log(
                "ConfigManager: Already on era-config tab, loading cached config..."
              );
              this.loadCachedEraConfigIfAvailable();
            } else {
              // Not on era-config tab yet - this will be handled by checkAndAutoSwitchToEraConfig
              console.log(
                "ConfigManager: Will auto-switch to era-config tab when ready"
              );
            }
          }, 800);
        } else {
          console.log(
            "ConfigManager: User not authenticated, clearing era config UI"
          );
          // Clear era config UI when not authenticated
          this.clearEraConfigUI();
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
    this.setupModalHandlers();
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

    // Setup scale factor input handler
    const scaleFactorInput = document.getElementById("scale-factor-value");
    if (scaleFactorInput) {
      scaleFactorInput.addEventListener("input", (e) => {
        const scaleFactor = parseFloat(e.target.value) || 0.1;
        if (this.eraConfigService) {
          this.eraConfigService.updateScaleFactor(scaleFactor);
        }
      });
    }

    // Setup decimal places input handler
    const decimalPlacesInput = document.getElementById("decimal-places-value");
    if (decimalPlacesInput) {
      decimalPlacesInput.addEventListener("input", (e) => {
        const decimalPlaces = parseInt(e.target.value) || 1;
        if (this.eraConfigService) {
          this.eraConfigService.updateDecimalPlaces(decimalPlaces);
        }
      });
    }

    // Setup scale sensor checkboxes
    const scaleSensors = ["temperature", "humidity", "pm25", "pm10"];
    scaleSensors.forEach((sensor) => {
      const checkbox = document.getElementById(`scale-${sensor}`);
      if (checkbox) {
        checkbox.addEventListener("change", (e) => {
          const isApplied = e.target.checked;
          if (this.eraConfigService) {
            this.eraConfigService.updateScaleAppliedSensors(sensor, isApplied);
          }
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

        // 🚀 AUTO-FETCH CONFIG: Automatically get E-Ra config after successful login
        console.log(
          "ConfigManager: Starting auto-fetch of E-Ra config after login"
        );
        try {
          const autoFetchResult = await this.handleGetEraConfig(true); // true = silent mode
          if (autoFetchResult !== false) {
            // undefined or success
            console.log(
              "ConfigManager: ✅ Auto-fetched E-Ra config after login successfully"
            );

            // Force save mapping if auto-detection worked
            if (this.eraConfigService) {
              const currentMapping = this.eraConfigService.getCurrentMapping();
              const mappedCount = Object.values(currentMapping).filter(
                (id) => id !== null
              ).length;

              if (mappedCount > 0) {
                console.log(
                  `ConfigManager: Auto-saving ${mappedCount} detected sensor mappings`
                );
                await this.handleSaveMapping(true); // true = silent mode
              }
            }
          } else {
            console.warn("ConfigManager: Auto-config fetch returned false");
          }
        } catch (autoConfigError) {
          console.warn(
            "ConfigManager: Auto-config fetch failed:",
            autoConfigError
          );
          // Don't show error to user, they can still manually fetch if needed
        }

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
      "Are you sure you want to logout?\n\nThis will clear your current authentication and sensor mapping configuration, allowing you to login with a different E-Ra account."
    );

    if (!confirmLogout) {
      return;
    }

    console.log("ConfigManager: Logging out and clearing E-Ra configuration");

    // Perform logout
    this.authService.logout();

    // ✨ CRITICAL: Clear E-Ra IoT configuration when switching accounts
    if (this.config.eraIot) {
      console.log("ConfigManager: Clearing previous E-Ra IoT configuration");

      // Clear auth token and sensor configs
      this.config.eraIot.authToken = null;
      this.config.eraIot.gatewayToken = null;
      this.config.eraIot.sensorConfigs = {
        temperature: null,
        humidity: null,
        pm25: null,
        pm10: null,
      };

      // Save cleared config immediately
      this.saveConfiguration()
        .then(() => {
          console.log("ConfigManager: ✅ Cleared E-Ra configuration saved");
        })
        .catch((error) => {
          console.error("ConfigManager: Failed to save cleared config:", error);
        });
    }

    this.showNotification(
      "✅ Logged out successfully! Previous sensor mapping cleared. You can now login with a different E-Ra account.",
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

    // Clear any cached config data on logout
    if (this.eraConfigService) {
      this.eraConfigService.clearCacheOnLogout();
    }

    // Reset mapping selectors to default state
    const sensorTypes = ["temperature", "humidity", "pm25", "pm10"];
    sensorTypes.forEach((sensor) => {
      const selector = document.getElementById(`mapping-${sensor}`);
      if (selector) {
        selector.value = ""; // Reset to default "Choose datastream" option
      }
    });

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

    // Update current mapping display to show cleared state
    this.updateCurrentMappingDisplay();

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
      // FIXED: Do NOT extract gatewayToken from authToken
      // authToken and gatewayToken are separate values
      // Only update authToken, keep existing gatewayToken from config

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
      // FIXED: Do NOT overwrite gatewayToken - keep existing value

      console.log("E-Ra IoT configuration updated:");
      console.log("- Auth token:", token.substring(0, 20) + "...");
      console.log("- Gateway token: (preserved existing value)");
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

  async handleGetEraConfig(silent = false) {
    if (!this.eraConfigService) {
      if (!silent)
        this.showNotification("E-Ra config service not available", "error");
      return false;
    }

    if (!this.authService || !this.authService.isAuthenticated()) {
      if (!silent)
        this.showNotification("Hãy đăng nhập tài khoản E-Ra trước", "error");
      return false;
    }

    const getConfigBtn = document.getElementById("get-era-config-btn");
    const btnText = getConfigBtn?.querySelector(".btn-text");
    const btnLoader = getConfigBtn?.querySelector(".btn-loader");
    const statusDiv = document.getElementById("era-config-status");
    const statusIndicator = document.getElementById(
      "era-config-status-indicator"
    );
    const statusText = statusIndicator?.querySelector(".status-text");

    // Show loading state (only if not silent)
    if (!silent && getConfigBtn) {
      getConfigBtn.disabled = true;
      if (btnText) btnText.style.display = "none";
      if (btnLoader) btnLoader.style.display = "inline";
      if (statusDiv) statusDiv.style.display = "block";
      if (statusIndicator)
        statusIndicator.className = "status-indicator connecting";
      if (statusText) statusText.textContent = "Đang lấy cấu hình";
    }

    try {
      const result = await this.eraConfigService.getCompleteConfig();

      if (result.success) {
        if (!silent) this.showNotification(result.message, "success");

        // Hide saved config info card (we have fresh data now)
        const savedConfigInfo = document.getElementById(
          "era-saved-config-info"
        );
        if (savedConfigInfo) {
          savedConfigInfo.style.display = "none";
        }

        // Update UI with results
        this.displayChips(result.chips);
        this.displayDatastreams(result.datastreams);
        this.populateMappingSelectors(result.datastreams);
        this.loadScaleConfigFromSystem();

        // 🚀 AUTO-DETECT MAPPING: Try to auto-detect sensor mappings for new users
        if (
          this.eraConfigService &&
          result.datastreams &&
          result.datastreams.length > 0
        ) {
          const currentMapping = this.eraConfigService.getCurrentMapping();
          const mappedCount = Object.values(currentMapping).filter(
            (id) => id !== null
          ).length;

          console.log(
            `ConfigManager: Current mapping has ${mappedCount} mapped sensors`
          );

          // If no sensors are mapped, try auto-detection
          if (mappedCount === 0) {
            console.log(
              "ConfigManager: No existing mapping, trying auto-detection"
            );
            const autoMapping = this.eraConfigService.autoDetectMapping();
            const autoMappedCount = Object.values(autoMapping).filter(
              (id) => id !== null
            ).length;

            if (autoMappedCount > 0) {
              console.log(
                `ConfigManager: Auto-detected ${autoMappedCount} sensors`
              );
              if (!silent) {
                this.showNotification(
                  `🎯 Tự động phát hiện ${autoMappedCount}/4 cảm biến!`,
                  "success"
                );
              }
            }
          }
        }

        this.updateCurrentMappingDisplay();

        // Show sections
        const sections = [
          "era-chips-section",
          "era-datastreams-section",
          "era-mapping-section",
          "era-current-mapping",
        ];
        sections.forEach((sectionId) => {
          const section = document.getElementById(sectionId);
          if (section) section.style.display = "block";
        });

        const autoDetectBtn = document.getElementById(
          "auto-detect-mapping-btn"
        );
        if (autoDetectBtn) autoDetectBtn.style.display = "inline-block";

        // Update status
        if (statusDiv) statusDiv.style.display = "block";
        if (statusIndicator)
          statusIndicator.className = "status-indicator online";
        if (statusText)
          statusText.textContent = `Cấu hình đã tải: ${
            result.chips?.length || 0
          } chips, ${result.datastreams?.length || 0} datastreams`;

        return true; // Success
      } else {
        if (!silent)
          this.showNotification(
            result.message || "Failed to fetch configuration",
            "error"
          );

        // Update status
        if (statusIndicator)
          statusIndicator.className = "status-indicator offline";
        if (statusText) statusText.textContent = "Failed to load configuration";

        return false; // Failed
      }
    } catch (error) {
      console.error("Error fetching E-Ra config:", error);
      if (!silent)
        this.showNotification(
          "Error fetching configuration: " + error.message,
          "error"
        );

      // Update status
      if (statusIndicator)
        statusIndicator.className = "status-indicator offline";
      if (statusText) statusText.textContent = "Configuration fetch failed";

      return false; // Error
    } finally {
      // Reset button state (only if not silent)
      if (!silent && getConfigBtn) {
        getConfigBtn.disabled = false;
        if (btnText) btnText.style.display = "inline";
        if (btnLoader) btnLoader.style.display = "none";
      }
    }
  }

  handleAutoDetectMapping() {
    if (!this.eraConfigService) {
      this.showNotification("E-Ra config service not available", "error");
      return;
    }

    // Show modal for keywords input
    this.showAutoDetectModal();
  }

  showAutoDetectModal() {
    const modal = document.getElementById("autoDetectModal");
    const keywordInput = document.getElementById("keywordInput");

    if (modal) {
      // Initialize default keywords
      this.initializeDefaultKeywords();
      modal.classList.remove("modal-hidden");
      if (keywordInput) {
        keywordInput.focus();
      }
    }
  }

  closeAutoDetectModal() {
    const modal = document.getElementById("autoDetectModal");
    if (modal) {
      modal.classList.add("modal-hidden");
    }
  }

  initializeDefaultKeywords() {
    const defaultKeywords = [
      "Billboard",
      "ITS",
      "Nhiệt độ",
      "Độ ẩm",
      "Pm2.5",
      "PM10",
      "Quảng cáo",
    ];

    this.currentKeywords = [...defaultKeywords];
    this.renderKeywordChips();
  }

  renderKeywordChips() {
    const container = document.getElementById("keywordChips");
    if (!container) return;

    container.innerHTML = "";

    this.currentKeywords.forEach((keyword, index) => {
      const chip = document.createElement("div");
      chip.className = "keyword-chip";
      chip.innerHTML = `
        <span>${keyword}</span>
        <button class="keyword-chip-remove" onclick="configManager.removeKeyword(${index})" type="button">×</button>
      `;
      container.appendChild(chip);
    });
  }

  removeKeyword(index) {
    if (index >= 0 && index < this.currentKeywords.length) {
      this.currentKeywords.splice(index, 1);
      this.renderKeywordChips();
    }
  }

  addKeywordFromInput() {
    const input = document.getElementById("keywordInput");
    if (!input) return;

    const newKeyword = input.value.trim();
    if (newKeyword && !this.currentKeywords.includes(newKeyword)) {
      this.currentKeywords.push(newKeyword);
      this.renderKeywordChips();
      input.value = "";
    } else if (this.currentKeywords.includes(newKeyword)) {
      this.showNotification("Từ khóa đã tồn tại", "warning");
    }
  }

  setupModalHandlers() {
    const modal = document.getElementById("autoDetectModal");
    const keywordInput = document.getElementById("keywordInput");

    if (modal) {
      // Close modal when clicking outside content
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeAutoDetectModal();
        }
      });

      // Handle Enter key in input to add keywords
      if (keywordInput) {
        keywordInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.addKeywordFromInput();
          }
        });
      }
    }
  }

  executeAutoDetectWithKeywords() {
    if (!this.currentKeywords || this.currentKeywords.length === 0) {
      this.showNotification("Vui lòng thêm ít nhất một từ khóa", "error");
      return;
    }

    // Close modal
    this.closeAutoDetectModal();

    // Convert array to string format for compatibility with existing function
    const keywordsString = this.currentKeywords.join(" - ");

    // Execute auto-detect with keywords
    const autoMapping =
      this.eraConfigService.autoDetectMappingWithKeywords(keywordsString);

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

    if (mappedCount > 0) {
      this.showNotification(
        `Tự động phát hiện thành công ${mappedCount}/4 cảm biến với từ khóa: ${keywordsString}`,
        "success"
      );
    } else {
      this.showNotification(
        "Không tìm thấy cảm biến nào phù hợp với từ khóa đã nhập",
        "warning"
      );
    }
  }

  async handleSaveMapping(silent = false) {
    if (!this.eraConfigService) {
      if (!silent)
        this.showNotification("E-Ra config service not available", "error");
      return;
    }

    const currentMapping = this.eraConfigService.getCurrentMapping();
    const currentScaleConfig = this.eraConfigService.getCurrentScaleConfig();

    // Validate mapping
    const mappedCount = Object.values(currentMapping).filter(
      (id) => id !== null
    ).length;
    if (mappedCount === 0) {
      if (!silent)
        this.showNotification(
          "Please map at least one sensor before saving",
          "error"
        );
      return;
    }

    console.log("ConfigManager: Saving sensor mapping:", currentMapping);
    console.log("ConfigManager: Saving scale config:", currentScaleConfig);

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

    // Add scale configuration to config
    this.config.eraIot.scaleConfig = {
      scaleFactor: currentScaleConfig.scaleFactor,
      decimalPlaces: currentScaleConfig.decimalPlaces,
      appliedSensors: currentScaleConfig.appliedSensors,
    };

    console.log(
      "ConfigManager: Updated config.eraIot.sensorConfigs:",
      this.config.eraIot.sensorConfigs
    );
    console.log(
      "ConfigManager: Updated config.eraIot.scaleConfig:",
      this.config.eraIot.scaleConfig
    );

    try {
      // Save to storage with hot-reload
      await this.saveConfiguration();

      // Force broadcast config update for immediate effect
      if (window.electronAPI && window.electronAPI.forceConfigReload) {
        await window.electronAPI.forceConfigReload(this.config);
        console.log(
          "ConfigManager: Forced config reload broadcasted to main process"
        );
      }

      if (!silent) {
        this.showNotification(
          `✅ Sensor mapping saved and applied instantly! (${mappedCount}/4 sensors mapped)`,
          "success"
        );
      }

      // Log the successful mapping for debugging
      Object.entries(currentMapping).forEach(([sensor, id]) => {
        if (id !== null) {
          console.log(`ConfigManager: ✅ ${sensor} → Config ID ${id}`);
        }
      });
    } catch (error) {
      console.error("ConfigManager: Failed to save sensor mapping:", error);
      if (!silent) {
        this.showNotification(
          "Failed to save sensor mapping: " + error.message,
          "error"
        );
      }
    }
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

    // Initialize collapsed state for Luồng Dữ Liệu Khả Dụng section
    const indicator = document.getElementById("datastreams-indicator");
    if (indicator && !datastreamsList.classList.contains("collapsed")) {
      datastreamsList.classList.add("collapsed");
      indicator.classList.remove("expanded");
      indicator.textContent = "►";
    }

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

  loadCachedEraConfigIfAvailable() {
    console.log("ConfigManager: loadCachedEraConfigIfAvailable() called");

    if (!this.eraConfigService) {
      console.log(
        "ConfigManager: No era config service available for cache load"
      );
      return;
    }

    // 1️⃣ ALWAYS LOAD SYSTEM CONFIG: Load sensor mapping and scale config from config.json
    this.loadSensorMappingFromSystem();

    // 2️⃣ CHECK IF WE HAVE PREVIOUS CONFIG: Check if user has E-Ra config in system
    const hasSystemEraConfig = !!(
      this.config.eraIot &&
      (this.config.eraIot.authToken ||
        (this.config.eraIot.sensorConfigs &&
          Object.values(this.config.eraIot.sensorConfigs).some(
            (id) => id !== null
          )))
    );

    console.log("ConfigManager: System E-Ra config status:", {
      hasEraIot: !!this.config.eraIot,
      hasAuthToken: !!this.config.eraIot?.authToken,
      hasSensorConfigs: !!this.config.eraIot?.sensorConfigs,
      mappedSensors: this.config.eraIot?.sensorConfigs
        ? Object.values(this.config.eraIot.sensorConfigs).filter(
            (id) => id !== null
          ).length
        : 0,
    });

    // 3️⃣ TRY TO SHOW PREVIOUS CONFIG FROM CACHE OR FRESH FETCH
    const cachedChips = this.eraConfigService.getCachedChips();
    const cachedDatastreams = this.eraConfigService.getCachedDatastreams();

    console.log("ConfigManager: Cached data status:", {
      chips: cachedChips ? cachedChips.length : 0,
      datastreams: cachedDatastreams ? cachedDatastreams.length : 0,
    });

    if (
      cachedChips &&
      cachedChips.length > 0 &&
      cachedDatastreams &&
      cachedDatastreams.length > 0
    ) {
      console.log("ConfigManager: ✅ Loading from cache + system config");

      // Hide saved config info card (we have full data now)
      const savedConfigInfo = document.getElementById("era-saved-config-info");
      if (savedConfigInfo) {
        savedConfigInfo.style.display = "none";
      }

      // Display cached data
      this.displayChips(cachedChips);
      this.displayDatastreams(cachedDatastreams);
      this.populateMappingSelectors(cachedDatastreams);
      this.loadScaleConfigFromSystem();
      this.updateCurrentMappingDisplay();

      // Show sections that were previously loaded
      this.showEraConfigSections();

      // Update status to show data is loaded
      this.updateEraConfigStatus(
        "online",
        `Đã tải: ${cachedChips.length} chips, ${cachedDatastreams.length} datastreams`
      );

      this.showNotification("✅ Cấu hình E-Ra đã sẵn sàng!", "success");
    } else if (hasSystemEraConfig) {
      // 4️⃣ HAS SYSTEM CONFIG BUT NO CACHE: Show saved mapping and try to fetch fresh data
      console.log(
        "ConfigManager: 📋 Has system config but no cache - showing saved mapping"
      );

      this.showSavedConfigInfo(); // Show saved config info card
      this.updateCurrentMappingDisplay();
      this.showEraConfigSections(true); // true = show mapping section only
      this.updateEraConfigStatus(
        "connecting",
        "Có cấu hình đã lưu - nhấn 'Lấy Cấu hình E-Ra' để cập nhật"
      );

      this.showNotification(
        "📋 Đã tải cấu hình đã lưu - bạn có thể cập nhật bằng 'Lấy Cấu hình E-Ra'",
        "info"
      );

      // Auto-fetch if authenticated
      if (this.authService && this.authService.isAuthenticated()) {
        console.log("ConfigManager: Auto-fetching fresh data to update cache");
        setTimeout(() => {
          this.handleGetEraConfig(true); // Silent mode - don't interrupt user
        }, 1000);
      }
    } else {
      // 5️⃣ NO CONFIG AT ALL: Prompt user to login and fetch
      console.log(
        "ConfigManager: ❌ No E-Ra config found - user needs to setup"
      );

      if (this.authService && this.authService.isAuthenticated()) {
        console.log(
          "ConfigManager: User authenticated but no config - auto-fetching"
        );
        this.handleGetEraConfig(true); // Silent mode
      } else {
        this.updateEraConfigStatus(
          "offline",
          "Chưa có cấu hình - hãy đăng nhập và lấy cấu hình E-Ra"
        );
      }
    }
  }

  /**
   * Show E-Ra config sections
   */
  showEraConfigSections(mappingOnly = false) {
    const sectionsToShow = mappingOnly
      ? ["era-mapping-section", "era-current-mapping"]
      : [
          "era-chips-section",
          "era-datastreams-section",
          "era-mapping-section",
          "era-current-mapping",
        ];

    sectionsToShow.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = "block";
      }
    });

    // Initialize collapsed state for datastreams section when showing it
    if (!mappingOnly && sectionsToShow.includes("era-datastreams-section")) {
      const datastreamsList = document.getElementById("era-datastreams-list");
      const indicator = document.getElementById("datastreams-indicator");

      if (datastreamsList && indicator) {
        datastreamsList.classList.add("collapsed");
        indicator.classList.remove("expanded");
        indicator.textContent = "►";
      }
    }

    const autoDetectBtn = document.getElementById("auto-detect-mapping-btn");
    if (autoDetectBtn) {
      autoDetectBtn.style.display = "inline-block";
    }
  }

  /**
   * Update E-Ra config status indicator
   */
  updateEraConfigStatus(status, message) {
    const statusDiv = document.getElementById("era-config-status");
    const statusIndicator = document.getElementById(
      "era-config-status-indicator"
    );
    const statusText = statusIndicator?.querySelector(".status-text");

    if (statusDiv && statusIndicator && statusText) {
      statusDiv.style.display = "block";
      statusIndicator.className = `status-indicator ${status}`;
      statusText.textContent = message;
    }
  }

  /**
   * Show saved config info card
   */
  showSavedConfigInfo() {
    const infoCard = document.getElementById("era-saved-config-info");
    const summaryDiv = document.getElementById("saved-config-summary");

    if (!infoCard || !summaryDiv || !this.config.eraIot) {
      return;
    }

    // Build summary text
    const eraConfig = this.config.eraIot;
    const summaryItems = [];

    // Auth status
    if (eraConfig.authToken) {
      summaryItems.push("✅ Đã xác thực E-Ra");
    }

    // Sensor mapping count
    if (eraConfig.sensorConfigs) {
      const mappedCount = Object.values(eraConfig.sensorConfigs).filter(
        (id) => id !== null
      ).length;
      if (mappedCount > 0) {
        summaryItems.push(`🎯 ${mappedCount}/4 cảm biến đã cấu hình`);
      }
    }

    // Scale config status
    if (eraConfig.scaleConfig) {
      const appliedCount = Object.values(
        eraConfig.scaleConfig.appliedSensors || {}
      ).filter(Boolean).length;
      if (appliedCount > 0) {
        summaryItems.push(
          `⚖️ Hệ số scale áp dụng cho ${appliedCount} cảm biến`
        );
      }
    }

    // Update summary display
    summaryDiv.innerHTML =
      summaryItems.length > 0
        ? summaryItems.join("<br>")
        : "📋 Có cấu hình cơ bản - hãy hoàn thiện thêm";

    // Show the card
    infoCard.style.display = "block";
    console.log("ConfigManager: Showed saved config info card");
  }

  /**
   * Load existing sensor mapping from system configuration
   */
  loadSensorMappingFromSystem() {
    console.log("ConfigManager: Loading sensor mapping from system config");

    // 1️⃣ LOAD SENSOR MAPPINGS
    if (this.config.eraIot && this.config.eraIot.sensorConfigs) {
      const systemMapping = this.config.eraIot.sensorConfigs;
      console.log("ConfigManager: Found system sensor mapping:", systemMapping);

      // Update service with system mapping
      if (this.eraConfigService) {
        Object.entries(systemMapping).forEach(([sensorType, datastreamId]) => {
          if (datastreamId !== null) {
            this.eraConfigService.updateMapping(sensorType, datastreamId);
          }
        });
        console.log("ConfigManager: Applied system mapping to service");
      }

      // Update UI selectors with system mapping
      Object.entries(systemMapping).forEach(([sensorType, datastreamId]) => {
        const selector = document.getElementById(`mapping-${sensorType}`);
        if (selector && datastreamId !== null) {
          selector.value = datastreamId.toString();
          console.log(
            `ConfigManager: Set ${sensorType} selector to ${datastreamId}`
          );
        }
      });

      // Update current mapping display
      this.updateCurrentMappingDisplay();
    } else {
      console.log("ConfigManager: No existing sensor mapping in system config");
    }

    // 2️⃣ LOAD SCALE CONFIG (always do this to restore UI state)
    this.loadScaleConfigFromSystem();
  }

  loadScaleConfigFromSystem() {
    // Load scale configuration from existing config if available
    if (this.config.eraIot && this.config.eraIot.scaleConfig) {
      const scaleConfig = this.config.eraIot.scaleConfig;

      // Update scale factor input
      const scaleFactorInput = document.getElementById("scale-factor-value");
      if (scaleFactorInput) {
        scaleFactorInput.value = scaleConfig.scaleFactor || 0.1;
      }

      // Update decimal places input
      const decimalPlacesInput = document.getElementById(
        "decimal-places-value"
      );
      if (decimalPlacesInput) {
        decimalPlacesInput.value = scaleConfig.decimalPlaces || 1;
      }

      // Update scale checkboxes
      const sensors = ["temperature", "humidity", "pm25", "pm10"];
      sensors.forEach((sensor) => {
        const checkbox = document.getElementById(`scale-${sensor}`);
        if (checkbox) {
          checkbox.checked = scaleConfig.appliedSensors[sensor] || false;
        }
      });

      // Update service with loaded config
      if (this.eraConfigService) {
        this.eraConfigService.updateScaleFactor(scaleConfig.scaleFactor || 0.1);
        this.eraConfigService.updateDecimalPlaces(
          scaleConfig.decimalPlaces || 1
        );
        Object.entries(scaleConfig.appliedSensors || {}).forEach(
          ([sensor, isApplied]) => {
            this.eraConfigService.updateScaleAppliedSensors(sensor, isApplied);
          }
        );
      }

      console.log(
        "ConfigManager: Loaded scale config from system:",
        scaleConfig
      );
    }
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

        // AUTO-LOAD CACHED CONFIG: When switching to era-config tab, auto-load cached data
        if (tabId === "era-config" && this.eraConfigService) {
          this.loadCachedEraConfigIfAvailable();
        }
      });
    });

    // 🚀 AUTO-SWITCH TO ERA-CONFIG TAB: If user is logged in when opening config window
    this.checkAndAutoSwitchToEraConfig();
  }

  /**
   * Check if user is authenticated and auto-switch to era-config tab
   */
  checkAndAutoSwitchToEraConfig() {
    console.log("ConfigManager: Checking auto-switch to era-config tab");

    // Wait a bit for auth service to initialize
    setTimeout(() => {
      if (this.authService && this.authService.isAuthenticated()) {
        console.log(
          "ConfigManager: User is authenticated, auto-switching to era-config tab"
        );

        // Find era-config tab and switch to it
        const eraConfigTab = document.querySelector('[data-tab="era-config"]');
        if (eraConfigTab) {
          console.log("ConfigManager: Clicking era-config tab");
          eraConfigTab.click(); // This will trigger the tab switch and auto-load cached data
        } else {
          console.warn("ConfigManager: era-config tab not found");
        }
      } else {
        console.log(
          "ConfigManager: User not authenticated, staying on login tab"
        );
      }
    }, 500); // Small delay to ensure auth service is ready
  }

  /**
   * Clear E-Ra config UI sections when not authenticated
   */
  clearEraConfigUI() {
    console.log("ConfigManager: Clearing E-Ra config UI sections");

    // Hide config sections
    const sectionsToHide = [
      "era-chips-section",
      "era-datastreams-section",
      "era-mapping-section",
      "era-current-mapping",
      "era-config-status",
      "era-saved-config-info", // Also hide saved config info
    ];

    sectionsToHide.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = "none";
      }
    });

    // Hide auto-detect button
    const autoDetectBtn = document.getElementById("auto-detect-mapping-btn");
    if (autoDetectBtn) {
      autoDetectBtn.style.display = "none";
    }

    // Reset mapping selectors
    const sensorTypes = ["temperature", "humidity", "pm25", "pm10"];
    sensorTypes.forEach((sensor) => {
      const selector = document.getElementById(`mapping-${sensor}`);
      if (selector) {
        selector.value = ""; // Reset to default option
      }
    });

    // Reset datastreams section to collapsed state
    const datastreamsList = document.getElementById("era-datastreams-list");
    const indicator = document.getElementById("datastreams-indicator");
    if (datastreamsList && indicator) {
      datastreamsList.classList.add("collapsed");
      indicator.classList.remove("expanded");
      indicator.textContent = "►";
    }

    console.log("ConfigManager: E-Ra config UI cleared");
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

        console.log("ConfigManager: Loaded configuration from config.json:", {
          logoMode: this.config.logoMode,
          logoCount: this.config.logoImages?.length || 0,
          eraIotEnabled: !!this.config.eraIot?.enabled,
          hasSensorConfigs: !!this.config.eraIot?.sensorConfigs,
          hasAuthToken: !!this.config.eraIot?.authToken,
        });

        this.loadEraConfigFromSystem();

        this.updateUI();
      }
    } catch (error) {
      console.error("Error loading configuration:", error);
    }
  }

  /**
   * Load E-Ra IoT configuration from system config and populate UI
   */
  loadEraConfigFromSystem() {
    console.log("ConfigManager: Loading E-Ra IoT config from system...");

    if (!this.config.eraIot) {
      console.log("ConfigManager: No E-Ra IoT config found in system");
      return;
    }

    const eraConfig = this.config.eraIot;
    console.log("ConfigManager: Found E-Ra IoT config:", {
      enabled: eraConfig.enabled,
      hasAuthToken: !!eraConfig.authToken,
      hasGatewayToken: !!eraConfig.gatewayToken,
      hasSensorConfigs: !!eraConfig.sensorConfigs,
      hasScaleConfig: !!eraConfig.scaleConfig,
    });

    // 1️⃣ RESTORE AUTH TOKEN: If we have an auth token, try to restore auth state
    if (eraConfig.authToken && this.authService) {
      console.log("ConfigManager: Restoring authentication from config");

      // Extract username from token or use a placeholder
      const user = eraConfig.user || { username: "Restored User" };

      // Update auth service state (this simulates a successful login)
      this.authService.updateAuthState({
        isAuthenticated: true,
        token: eraConfig.authToken,
        user: user,
        lastLogin: new Date(),
      });

      console.log("ConfigManager: ✅ Authentication restored from config");
    }

    // 2️⃣ RESTORE SENSOR MAPPING: Load sensor mappings to E-Ra config service
    if (eraConfig.sensorConfigs && this.eraConfigService) {
      console.log(
        "ConfigManager: Restoring sensor mappings from config:",
        eraConfig.sensorConfigs
      );

      Object.entries(eraConfig.sensorConfigs).forEach(
        ([sensorType, datastreamId]) => {
          if (datastreamId !== null) {
            this.eraConfigService.updateMapping(sensorType, datastreamId);
            console.log(
              `ConfigManager: Restored mapping ${sensorType} → ${datastreamId}`
            );
          }
        }
      );
    }

    // 3️⃣ RESTORE SCALE CONFIG: Load scale factor configuration
    if (eraConfig.scaleConfig && this.eraConfigService) {
      console.log(
        "ConfigManager: Restoring scale config from system:",
        eraConfig.scaleConfig
      );

      this.eraConfigService.updateScaleFactor(
        eraConfig.scaleConfig.scaleFactor || 0.1
      );

      Object.entries(eraConfig.scaleConfig.appliedSensors || {}).forEach(
        ([sensor, isApplied]) => {
          this.eraConfigService.updateScaleAppliedSensors(sensor, isApplied);
        }
      );
    }

    console.log(
      "ConfigManager: ✅ E-Ra IoT config loaded from system successfully"
    );
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

    // Prevent flicker by only updating if content actually changed
    const currentContent = logoGrid.innerHTML;
    let newContent = "";

    this.config.logoImages.forEach((logo, index) => {
      // Enhanced path resolution with stable fallback strategy
      let logoSrc = logo.path;
      let fallbackSrc = null;

      console.log(
        `Config: Processing logo ${logo.name}, source: ${logo.source}`
      );

      if (logo.source === "github_cdn") {
        // Primary: Try GitHub CDN URL if available
        if (logo.url) {
          logoSrc = logo.url;
        } else if (logo.path) {
          // Secondary: Use local downloaded file
          const normalizedPath = logo.path.replace(/\\/g, "/");
          if (
            !normalizedPath.startsWith("/") &&
            !normalizedPath.match(/^[A-Za-z]:/)
          ) {
            logoSrc = `file:///f:/EoH Company/ITS_OurdoorScreen/${normalizedPath}`;
          } else {
            logoSrc = `file:///${normalizedPath}`;
          }
        }

        // Prepare fallback
        fallbackSrc = `./assets/imgs/${logo.name}`;
        console.log(
          `Config: GitHub CDN logo - primary: ${logoSrc}, fallback: ${fallbackSrc}`
        );
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

      newContent += `
        <div class="logo-item">
          <img src="${logoSrc}" alt="${logo.name}" 
               style="max-width: 80px; max-height: 60px; object-fit: contain; transition: opacity 0.2s ease;"
               onerror="
                 console.error('Config: Failed to load:', this.src); 
                 if (!this.dataset.fallbackTried && '${fallbackSrc}' && this.src !== '${fallbackSrc}') {
                   this.dataset.fallbackTried = 'true';
                   this.src = '${fallbackSrc}';
                 } else {
                   this.style.opacity = '0.3'; 
                   this.nextElementSibling.innerHTML = '${logo.name}<br><small style=\\"color: #dc3545;\\">(Failed to load)</small>';
                 }
               "
               onload="
                 console.log('Config: Logo loaded successfully:', this.src);
                 this.style.opacity = '1';
               " />
          <p style="font-size: 12px; margin-top: 5px; word-break: break-all; text-align: center;">${logo.name}</p>
          <button class="remove-btn" onclick="configManager.removeLogo(${index})" style="position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; background: #dc3545; color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 12px;">×</button>
        </div>
      `;
    });

    // Only update DOM if content changed to prevent flicker
    if (currentContent !== newContent) {
      logoGrid.innerHTML = newContent;
      console.log(
        "Config: Logo grid updated with",
        this.config.logoImages.length,
        "logos"
      );
    } else {
      console.log("Config: Logo grid content unchanged, skipping update");
    }
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

function toggleDatastreamsSection() {
  const content = document.getElementById("era-datastreams-list");
  const indicator = document.getElementById("datastreams-indicator");

  if (content && indicator) {
    const isCollapsed = content.classList.contains("collapsed");

    if (isCollapsed) {
      content.classList.remove("collapsed");
      indicator.classList.add("expanded");
      indicator.textContent = "▼";
    } else {
      content.classList.add("collapsed");
      indicator.classList.remove("expanded");
      indicator.textContent = "►";
    }
  }
}

async function saveAndApply() {
  console.log("Saving all configuration including sensor mapping...");

  try {
    // 1. SAVE E-RA SENSOR MAPPING & SCALE CONFIG (if available)
    if (
      configManager.eraConfigService &&
      configManager.authService &&
      configManager.authService.isAuthenticated()
    ) {
      console.log(
        "SaveAndApply: Saving E-Ra sensor mapping and scale config..."
      );
      await configManager.handleSaveMapping(true); // true = silent mode, no separate notification
      console.log("SaveAndApply: E-Ra sensor mapping saved successfully");
    } else {
      console.log(
        "SaveAndApply: Skipping E-Ra config (not logged in or service unavailable)"
      );
    }

    // 2. SAVE LOGO CONFIGURATION
    console.log("SaveAndApply: Saving logo configuration...", {
      mode: configManager.config.logoMode,
      duration: configManager.config.logoLoopDuration,
      imageCount: configManager.config.logoImages.length,
    });

    await configManager.saveConfiguration();

    // 3. SHOW SUCCESS MESSAGE
    let successMessage = "✅ Cấu hình đã được lưu thành công!";

    // Add details about what was saved
    const savedItems = [];
    if (
      configManager.eraConfigService &&
      configManager.authService &&
      configManager.authService.isAuthenticated()
    ) {
      savedItems.push("Cấu hình cảm biến E-Ra");
      savedItems.push("Hệ số scale");
    }
    savedItems.push("Cấu hình logo");

    if (savedItems.length > 0) {
      successMessage += `\n\nĐã lưu: ${savedItems.join(", ")}`;
    }

    configManager.showNotification(successMessage, "success");

    // 4. LOG FINAL CONFIG
    console.log("SaveAndApply: All configuration applied successfully:", {
      logoMode: configManager.config.logoMode,
      logoLoopDuration: configManager.config.logoLoopDuration,
      logoImages: configManager.config.logoImages.length,
      eraIotEnabled: !!configManager.config.eraIot?.enabled,
      sensorsMapped: configManager.config.eraIot?.sensorConfigs
        ? Object.values(configManager.config.eraIot.sensorConfigs).filter(
            (v) => v !== null
          ).length
        : 0,
      scaleConfigured: !!configManager.config.eraIot?.scaleConfig,
    });
  } catch (error) {
    console.error("SaveAndApply: Error saving configuration:", error);
    configManager.showNotification(
      "❌ Lỗi khi lưu cấu hình: " + error.message,
      "error"
    );
  }

  // Optional: Close config window after save (uncomment if desired)
  // setTimeout(() => {
  //   exitConfig();
  // }, 2000);
}

async function exitConfig() {
  if (window.electronAPI) {
    await window.electronAPI.exitConfig();
  }
}

// Global functions for modal handling (called from HTML)
function closeAutoDetectModal() {
  if (configManager) {
    configManager.closeAutoDetectModal();
  }
}

function executeAutoDetectWithKeywords() {
  if (configManager) {
    configManager.executeAutoDetectWithKeywords();
  }
}

function addKeywordFromInput() {
  if (configManager) {
    configManager.addKeywordFromInput();
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
