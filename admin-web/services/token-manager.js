/**
 * GitHub Token Manager
 * Handles secure storage and retrieval of GitHub authentication tokens
 * Provides machine-specific token persistence for banner upload functionality
 */

export class TokenManager {
  constructor() {
    this.storageKey = "github-auth-data";
    this.machineId = this.generateMachineId();
    console.log("[TokenManager] Initialized for machine:", this.machineId);
  }

  /**
   * Generate machine-specific identifier
   */
  generateMachineId() {
    const userAgent = navigator.userAgent;
    const screen = `${screen.width}x${screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;

    const machineString = `${userAgent}-${screen}-${timezone}-${language}`;

    // Simple hash function for machine ID
    let hash = 0;
    for (let i = 0; i < machineString.length; i++) {
      const char = machineString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Simple obfuscation for token storage
   */
  obfuscateToken(token) {
    const key = this.machineId;
    let result = "";

    for (let i = 0; i < token.length; i++) {
      const tokenChar = token.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(tokenChar ^ keyChar);
    }

    return btoa(result);
  }

  /**
   * Deobfuscate stored token
   */
  deobfuscateToken(obfuscatedToken) {
    try {
      const key = this.machineId;
      const encoded = atob(obfuscatedToken);
      let result = "";

      for (let i = 0; i < encoded.length; i++) {
        const encodedChar = encoded.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        result += String.fromCharCode(encodedChar ^ keyChar);
      }

      return result;
    } catch (error) {
      console.error("[TokenManager] Token deobfuscation failed:", error);
      return null;
    }
  }

  /**
   * Store GitHub token securely
   */
  storeToken(token, userLogin = null) {
    try {
      const authData = {
        token: this.obfuscateToken(token),
        userLogin: userLogin,
        machineId: this.machineId,
        storedAt: new Date().toISOString(),
        expiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(), // 30 days
      };

      localStorage.setItem(this.storageKey, JSON.stringify(authData));
      console.log(
        "[TokenManager] Token stored successfully for user:",
        userLogin
      );
      return true;
    } catch (error) {
      console.error("[TokenManager] Failed to store token:", error);
      return false;
    }
  }

  /**
   * Retrieve stored GitHub token
   */
  getStoredToken() {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      if (!storedData) {
        console.log("[TokenManager] No stored token found");
        return null;
      }

      const authData = JSON.parse(storedData);

      // Check if token is for this machine
      if (authData.machineId !== this.machineId) {
        console.log("[TokenManager] Token not for this machine, clearing");
        this.clearToken();
        return null;
      }

      // Check if token has expired
      if (new Date() > new Date(authData.expiresAt)) {
        console.log("[TokenManager] Token expired, clearing");
        this.clearToken();
        return null;
      }

      const token = this.deobfuscateToken(authData.token);
      if (!token) {
        console.log("[TokenManager] Token deobfuscation failed");
        this.clearToken();
        return null;
      }

      console.log(
        "[TokenManager] Retrieved stored token for user:",
        authData.userLogin
      );
      return {
        token: token,
        userLogin: authData.userLogin,
        storedAt: authData.storedAt,
      };
    } catch (error) {
      console.error("[TokenManager] Failed to retrieve token:", error);
      this.clearToken();
      return null;
    }
  }

  /**
   * Clear stored token
   */
  clearToken() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log("[TokenManager] Token cleared successfully");
      return true;
    } catch (error) {
      console.error("[TokenManager] Failed to clear token:", error);
      return false;
    }
  }

  /**
   * Check if token exists and is valid
   */
  hasValidToken() {
    const tokenData = this.getStoredToken();
    return tokenData !== null;
  }

  /**
   * Get token info without retrieving the actual token
   */
  getTokenInfo() {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      if (!storedData) return null;

      const authData = JSON.parse(storedData);

      return {
        hasToken: true,
        userLogin: authData.userLogin,
        storedAt: authData.storedAt,
        expiresAt: authData.expiresAt,
        isExpired: new Date() > new Date(authData.expiresAt),
        isForThisMachine: authData.machineId === this.machineId,
      };
    } catch (error) {
      console.error("[TokenManager] Failed to get token info:", error);
      return null;
    }
  }
}

// Create global instance
window.TokenManager = new TokenManager();

console.log("[TokenManager] Module loaded and ready");
