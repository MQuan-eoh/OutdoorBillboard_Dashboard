// types/electron.d.ts - Type declarations for Electron API
export interface ElectronAPI {
  // Config operations
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
  exitConfig: () => Promise<void>;

  // File operations for logo management
  selectLogoFiles: () => Promise<string[]>;

  // App control
  minimize: () => Promise<void>;
  close: () => Promise<void>;

  // Event listeners for config updates
  onConfigUpdated: (callback: (event: any, config: any) => void) => void;
  removeConfigListener: () => void;

  // Logo-specific config updates for immediate interval changes
  onLogoConfigUpdated?: (
    callback: (event: any, logoConfig: any) => void
  ) => void;
  removeLogoConfigListener?: () => void;

  // Force service refresh handlers
  onForceRefreshServices?: (
    callback: (event: any, config: any) => void
  ) => void;
  removeForceRefreshListener?: () => void;

  // E-Ra IoT specific handlers
  updateEraIotConfig?: (
    config: any
  ) => Promise<{ success: boolean; error?: string }>;
  onEraIotConfigUpdated?: (callback: (event: any, config: any) => void) => void;
  // E-Ra IoT MQTT data handlers (NEW)
  getEraIotData: () => Promise<any>;
  refreshEraIotConnection: () => Promise<{
    success: boolean;
    message?: string;
  }>;
  onEraIotDataUpdate: (callback: (event: any, data: any) => void) => void;
  onEraIotStatusUpdate: (callback: (event: any, status: any) => void) => void;
  removeEraIotDataListener: () => void;
  removeEraIotStatusListener: () => void;
  getGatewayToken: () => Promise<string>;

  // Authentication handlers
  updateAuthToken?: (
    token: string
  ) => Promise<{ success: boolean; error?: string }>;
  onAuthTokenUpdated?: (callback: (event: any, token: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
