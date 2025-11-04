/**
 * E-Ra IoT Authentication Service
 * Handles login to E-Ra platform and token management
 */

export interface EraLoginCredentials {
  username: string;
  password: string;
}

export interface EraLoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    username: string;
    email: string;
    name?: string;
  };
  message?: string;
  error?: string;
}

export interface EraAuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  lastLogin: Date | null;
}

class EraAuthService {
  private readonly baseUrl: string = "https://backend.eoh.io";
  private readonly loginEndpoint: string = "/api/accounts/login/";

  private authState: EraAuthState = {
    isAuthenticated: false,
    token: null,
    user: null,
    lastLogin: null,
  };

  private authCallbacks: ((state: EraAuthState) => void)[] = [];

  constructor() {
    this.loadStoredAuth();
    console.log("EraAuthService: Initialized");
  }

  /**
   * Authenticate user with E-Ra platform
   */
  public async login(
    credentials: EraLoginCredentials
  ): Promise<EraLoginResponse> {
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
  public logout(): void {
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
  public getAuthState(): EraAuthState {
    return { ...this.authState };
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return this.authState.isAuthenticated && !!this.authState.token;
  }

  /**
   * Get current authentication token
   */
  public getToken(): string | null {
    return this.authState.token;
  }

  /**
   * Get current user information
   */
  public getUser(): any | null {
    return this.authState.user;
  }

  /**
   * Subscribe to authentication state changes
   */
  public onAuthStateChange(
    callback: (state: EraAuthState) => void
  ): () => void {
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
  public async validateToken(): Promise<boolean> {
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
  private updateAuthState(newState: Partial<EraAuthState>): void {
    this.authState = { ...this.authState, ...newState };
    console.log("EraAuthService: Auth state updated:", {
      isAuthenticated: this.authState.isAuthenticated,
      hasToken: !!this.authState.token,
      user: this.authState.user?.username,
    });

    this.notifyAuthCallbacks();
  }

  /**
   * Notify all authentication callbacks
   */
  private notifyAuthCallbacks(): void {
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
  private storeAuth(): void {
    try {
      const authData = {
        token: this.authState.token,
        user: this.authState.user,
        lastLogin: this.authState.lastLogin?.toISOString(),
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
  private loadStoredAuth(): void {
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
  private clearStoredAuth(): void {
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
  public extractGatewayToken(authToken?: string): string | null {
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
  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
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
  public destroy(): void {
    this.authCallbacks = [];
    console.log("EraAuthService: Destroyed");
  }
}

export default EraAuthService;
