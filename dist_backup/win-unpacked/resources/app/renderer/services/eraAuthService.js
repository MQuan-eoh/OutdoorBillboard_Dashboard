/**
 * E-Ra IoT Authentication Service
 * Handles login to E-Ra platform and token management
 */
class EraAuthService {
  constructor() {
    this.baseUrl = "https://backend.eoh.io";
    this.loginEndpoint = "/api/accounts/login/";
    this.authState = {
      isAuthenticated: false,
      token: null,
      user: null,
      lastLogin: null,
    };
    this.authCallbacks = [];
    this.loadStoredAuth();
    console.log("EraAuthService: Initialized");
  }
  /**
   * Authenticate user with E-Ra platform
   */
  async login(credentials) {
    try {
      console.log(
        "EraAuthService: Attempting login for username:",
        credentials.username
      );
      const loginUrl = `${this.baseUrl}${this.loginEndpoint}`;
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
      });
      const responseData = await response.json();
      console.log(
        "EraAuthService: Login response:",
        response.status,
        responseData
      );
      if (response.ok && responseData.token) {
        // Successful login
        const authToken = `Token ${responseData.token}`;
        this.updateAuthState({
          isAuthenticated: true,
          token: authToken,
          user: responseData.user || { username: credentials.username },
          lastLogin: new Date(),
        });
        // Store authentication data
        this.storeAuth();
        return {
          success: true,
          token: authToken,
          user: responseData.user,
          message: "Login successful",
        };
      } else {
        // Login failed
        console.error("EraAuthService: Login failed:", responseData);
        return {
          success: false,
          error: responseData.message || responseData.error || "Login failed",
          message: responseData.message || "Invalid credentials",
        };
      }
    } catch (error) {
      console.error("EraAuthService: Login error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
        message: "Failed to connect to E-Ra platform",
      };
    }
  }
  /**
   * Logout and clear authentication
   */
  logout() {
    console.log("EraAuthService: Logging out");
    this.updateAuthState({
      isAuthenticated: false,
      token: null,
      user: null,
      lastLogin: null,
    });
    this.clearStoredAuth();
  }
  /**
   * Get current authentication state
   */
  getAuthState() {
    return { ...this.authState };
  }
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.authState.isAuthenticated && !!this.authState.token;
  }
  /**
   * Get current authentication token
   */
  getToken() {
    return this.authState.token;
  }
  /**
   * Get current user information
   */
  getUser() {
    return this.authState.user;
  }
  /**
   * Subscribe to authentication state changes
   */
  onAuthStateChange(callback) {
    this.authCallbacks.push(callback);
    return () => {
      const index = this.authCallbacks.indexOf(callback);
      if (index > -1) {
        this.authCallbacks.splice(index, 1);
      }
    };
  }
  /**
   * Validate current token (optional - can be implemented if E-Ra has token validation endpoint)
   */
  async validateToken() {
    if (!this.authState.token) {
      return false;
    }
    try {
      // This would require a token validation endpoint from E-Ra
      // For now, we'll assume the token is valid if it exists
      // TODO: Implement actual token validation when E-Ra provides the endpoint
      console.log("EraAuthService: Token validation - assuming valid for now");
      return true;
    } catch (error) {
      console.error("EraAuthService: Token validation error:", error);
      return false;
    }
  }
  /**
   * Update authentication state and notify callbacks
   */
  updateAuthState(newState) {
    var _a;
    this.authState = { ...this.authState, ...newState };
    console.log("EraAuthService: Auth state updated:", {
      isAuthenticated: this.authState.isAuthenticated,
      hasToken: !!this.authState.token,
      user:
        (_a = this.authState.user) === null || _a === void 0
          ? void 0
          : _a.username,
    });
    this.notifyAuthCallbacks();
  }
  /**
   * Notify all authentication callbacks
   */
  notifyAuthCallbacks() {
    this.authCallbacks.forEach((callback) => {
      try {
        callback(this.getAuthState());
      } catch (error) {
        console.error("EraAuthService: Error in auth callback:", error);
      }
    });
  }
  /**
   * Store authentication data in localStorage
   */
  storeAuth() {
    var _a;
    try {
      const authData = {
        token: this.authState.token,
        user: this.authState.user,
        lastLogin:
          (_a = this.authState.lastLogin) === null || _a === void 0
            ? void 0
            : _a.toISOString(),
      };
      localStorage.setItem("era_auth", JSON.stringify(authData));
      console.log("EraAuthService: Authentication data stored");
    } catch (error) {
      console.error("EraAuthService: Failed to store auth data:", error);
    }
  }
  /**
   * Load stored authentication data
   */
  loadStoredAuth() {
    try {
      const storedAuth = localStorage.getItem("era_auth");
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        if (authData.token) {
          this.updateAuthState({
            isAuthenticated: true,
            token: authData.token,
            user: authData.user,
            lastLogin: authData.lastLogin ? new Date(authData.lastLogin) : null,
          });
          console.log("EraAuthService: Restored authentication from storage");
        }
      }
    } catch (error) {
      console.error("EraAuthService: Failed to load stored auth:", error);
      this.clearStoredAuth();
    }
  }
  /**
   * Clear stored authentication data
   */
  clearStoredAuth() {
    try {
      localStorage.removeItem("era_auth");
      console.log("EraAuthService: Cleared stored authentication");
    } catch (error) {
      console.error("EraAuthService: Failed to clear stored auth:", error);
    }
  }
  /**
   * Extract gateway token from full auth token
   * Removes "Token " prefix to get the raw token
   */
  extractGatewayToken(authToken) {
    const token = authToken || this.authState.token;
    if (!token) {
      return null;
    }
    // Remove "Token " prefix if present
    return token.startsWith("Token ") ? token.substring(6) : token;
  }
  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders() {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.authState.token) {
      headers["Authorization"] = this.authState.token;
    }
    return headers;
  }
  /**
   * Destroy service and cleanup
   */
  destroy() {
    this.authCallbacks = [];
    console.log("EraAuthService: Destroyed");
  }
}

// Export for browser environment
window.EraAuthService = EraAuthService;
