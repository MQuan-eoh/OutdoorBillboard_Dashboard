/**
 * Application Settings
 * Default values and storage keys
 */

export const DEFAULT_SETTINGS = {
  displayMode: "loop", // loop|fixed|scheduled
  loopDuration: 10, // seconds
  fixedBannerId: null,
  scheduledTime: null,
};

export const STORAGE_KEYS = {
  settings: "billboard-settings",
  token: "github-token",
  user: "github-user",
  lastUpdate: "last-update-time",
};

export const APP_INFO = {
  name: "ITS Billboard Management",
  version: "2.0.0",
  model: "Simplified OTA",
};
