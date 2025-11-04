"use strict";
/**
 * Logo Manifest Service - GitHub CDN-based Logo Sync System
 * Implements Phương án A: GitHub-based CDN Sync for remote logo updates
 *
 * Features:
 * - Poll manifest.json from GitHub CDN
 * - Auto-download and cache logos locally
 * - Version checking and incremental updates
 * - Hot-reload integration for instant UI updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
class LogoManifestService {
    constructor(config) {
        this.pollTimer = null;
        this.logoCache = new Map();
        this.currentManifest = null;
        this.isPolling = false;
        this.updateCallbacks = [];
        this.config = config;
        console.log("LogoManifestService: Initialized with config", {
            enabled: config.enabled,
            manifestUrl: config.manifestUrl,
            pollInterval: config.pollInterval,
        });
    }
    /**
     * Initialize the manifest service
     */
    async initialize() {
        if (!this.config.enabled) {
            console.log("LogoManifestService: Service disabled in config");
            return false;
        }
        try {
            console.log("LogoManifestService: Starting initialization...");
            // Create download directory
            await this.ensureDownloadDirectory();
            // Initial manifest fetch
            const success = await this.fetchManifest();
            if (!success) {
                console.error("LogoManifestService: Failed to fetch initial manifest");
                return false;
            }
            // Start periodic polling
            this.startPolling();
            console.log("LogoManifestService: Initialized successfully");
            return true;
        }
        catch (error) {
            console.error("LogoManifestService: Initialization failed:", error);
            return false;
        }
    }
    /**
     * Start periodic polling for manifest updates
     */
    startPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
        const intervalMs = this.config.pollInterval * 1000;
        this.pollTimer = setInterval(async () => {
            if (!this.isPolling) {
                await this.checkForUpdates();
            }
        }, intervalMs);
        console.log(`LogoManifestService: Started polling every ${this.config.pollInterval}s`);
    }
    /**
     * Check for manifest updates and process changes
     */
    async checkForUpdates() {
        if (this.isPolling)
            return;
        this.isPolling = true;
        try {
            console.log("LogoManifestService: Checking for updates...");
            const newManifest = await this.fetchManifestFromCDN();
            if (!newManifest) {
                console.log("LogoManifestService: No manifest available");
                return;
            }
            // Check if version changed
            if (this.currentManifest &&
                this.currentManifest.version === newManifest.version) {
                console.log("LogoManifestService: No updates available");
                return;
            }
            console.log(`LogoManifestService: New version detected: ${this.currentManifest?.version} -> ${newManifest.version}`);
            // Process manifest updates
            await this.processManifestUpdate(newManifest);
        }
        catch (error) {
            console.error("LogoManifestService: Error checking for updates:", error);
        }
        finally {
            this.isPolling = false;
        }
    }
    /**
     * Fetch manifest from GitHub CDN
     */
    async fetchManifestFromCDN() {
        try {
            const axios = require("axios");
            console.log(`LogoManifestService: Fetching manifest from ${this.config.manifestUrl}`);
            const response = await axios.get(this.config.manifestUrl, {
                timeout: 15000,
                headers: {
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                },
            });
            if (response.status === 200) {
                const manifest = response.data;
                console.log("LogoManifestService: Manifest fetched successfully", {
                    version: manifest.version,
                    logoCount: manifest.logos.length,
                    lastUpdated: manifest.lastUpdated,
                });
                return manifest;
            }
            console.error(`LogoManifestService: HTTP ${response.status} - ${response.statusText}`);
            return null;
        }
        catch (error) {
            console.error("LogoManifestService: Failed to fetch manifest:", error);
            return null;
        }
    }
    /**
     * Fetch manifest with retry logic
     */
    async fetchManifest() {
        let attempts = 0;
        while (attempts < this.config.retryAttempts) {
            try {
                const manifest = await this.fetchManifestFromCDN();
                if (manifest) {
                    this.currentManifest = manifest;
                    return true;
                }
            }
            catch (error) {
                console.error(`LogoManifestService: Fetch attempt ${attempts + 1} failed:`, error);
            }
            attempts++;
            if (attempts < this.config.retryAttempts) {
                console.log(`LogoManifestService: Retrying in ${this.config.retryDelay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
            }
        }
        console.error("LogoManifestService: All fetch attempts failed");
        return false;
    }
    /**
     * Process manifest update and sync logos
     */
    async processManifestUpdate(newManifest) {
        try {
            console.log("LogoManifestService: Processing manifest update...");
            const oldManifest = this.currentManifest;
            this.currentManifest = newManifest;
            // Download new/updated logos
            const downloadTasks = newManifest.logos
                .filter((logo) => logo.active)
                .map((logo) => this.downloadLogoIfNeeded(logo, oldManifest));
            const results = await Promise.allSettled(downloadTasks);
            // Log results
            const successful = results.filter((r) => r.status === "fulfilled").length;
            const failed = results.filter((r) => r.status === "rejected").length;
            console.log(`LogoManifestService: Download results: ${successful} successful, ${failed} failed`);
            // Update local configuration with new logos
            await this.updateLocalConfig();
            // Trigger hot reload
            await this.triggerHotReload();
            // Notify callbacks
            this.notifyUpdateCallbacks(newManifest.logos.filter((l) => l.active));
            console.log("LogoManifestService: Manifest update processed successfully");
        }
        catch (error) {
            console.error("LogoManifestService: Error processing manifest update:", error);
        }
    }
    /**
     * Download logo if needed (new or updated)
     */
    async downloadLogoIfNeeded(logo, oldManifest) {
        try {
            // Check if logo already exists and is up to date
            const existingLogo = oldManifest?.logos.find((l) => l.id === logo.id);
            const localPath = this.getLocalLogoPath(logo);
            if (existingLogo && existingLogo.checksum === logo.checksum) {
                const fs = require("fs");
                if (fs.existsSync(localPath)) {
                    console.log(`LogoManifestService: Logo ${logo.id} is up to date, skipping download`);
                    this.logoCache.set(logo.id, localPath);
                    return localPath;
                }
            }
            console.log(`LogoManifestService: Downloading logo ${logo.id} from ${logo.url}`);
            // Download logo
            const downloadedPath = await this.downloadLogo(logo);
            if (downloadedPath) {
                this.logoCache.set(logo.id, downloadedPath);
                console.log(`LogoManifestService: Logo ${logo.id} downloaded successfully`);
                return downloadedPath;
            }
            return null;
        }
        catch (error) {
            console.error(`LogoManifestService: Error downloading logo ${logo.id}:`, error);
            return null;
        }
    }
    /**
     * Download logo from CDN URL
     */
    async downloadLogo(logo) {
        try {
            const axios = require("axios");
            const fs = require("fs");
            const path = require("path");
            const localPath = this.getLocalLogoPath(logo);
            // Ensure directory exists
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Download file
            const response = await axios({
                method: "GET",
                url: logo.url,
                responseType: "stream",
                timeout: 30000,
            });
            // Save to local file
            const writer = fs.createWriteStream(localPath);
            response.data.pipe(writer);
            return new Promise((resolve, reject) => {
                writer.on("finish", () => {
                    console.log(`LogoManifestService: Logo downloaded successfully: ${localPath}`);
                    resolve(localPath);
                });
                writer.on("error", (error) => {
                    console.error("LogoManifestService: Download error:", error);
                    reject(error);
                });
            });
        }
        catch (error) {
            console.error(`LogoManifestService: Error downloading logo ${logo.id}:`, error);
            return null;
        }
    }
    /**
     * Download a single banner by URL and filename (for renderer process)
     */
    async downloadSingleBanner(url, filename) {
        try {
            const axios = require("axios");
            const fs = require("fs");
            const path = require("path");
            const localPath = path.join(this.config.downloadPath, filename);
            // Ensure directory exists
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Download file
            const response = await axios({
                method: "GET",
                url: url,
                responseType: "stream",
                timeout: 30000,
            });
            // Save to local file
            const writer = fs.createWriteStream(localPath);
            response.data.pipe(writer);
            return new Promise((resolve, reject) => {
                writer.on("finish", () => {
                    console.log(`LogoManifestService: Banner downloaded successfully: ${localPath}`);
                    resolve(localPath);
                });
                writer.on("error", (error) => {
                    console.error("LogoManifestService: Banner download error:", error);
                    reject(error);
                });
            });
        }
        catch (error) {
            console.error(`LogoManifestService: Error downloading banner from ${url}:`, error);
            return null;
        }
    }
    /**
     * Get local path for logo file
     */
    getLocalLogoPath(logo) {
        const path = require("path");
        return path.join(this.config.downloadPath, "logos", logo.filename);
    }
    /**
     * Ensure download directory exists
     */
    async ensureDownloadDirectory() {
        const fs = require("fs");
        const path = require("path");
        const logoDir = path.join(this.config.downloadPath, "logos");
        if (!fs.existsSync(logoDir)) {
            fs.mkdirSync(logoDir, { recursive: true });
            console.log("LogoManifestService: Created download directory:", logoDir);
        }
    }
    /**
     * Update local configuration with new logos
     */
    async updateLocalConfig() {
        try {
            if (!this.currentManifest)
                return;
            if (typeof window !== "undefined" && window.electronAPI) {
                const currentConfig = await window.electronAPI.getConfig();
                // Convert manifest logos to config format
                const logoImages = this.currentManifest.logos
                    .filter((logo) => logo.active && this.logoCache.has(logo.id))
                    .sort((a, b) => a.priority - b.priority)
                    .map((logo) => ({
                    name: logo.name,
                    path: this.logoCache.get(logo.id),
                    size: logo.size,
                    type: logo.type,
                    id: logo.id,
                    source: "cdn_sync",
                    checksum: logo.checksum,
                }));
                // Update config with new logo settings
                const updatedConfig = {
                    ...currentConfig,
                    logoImages,
                    logoMode: this.currentManifest.settings?.logoMode ||
                        currentConfig.logoMode ||
                        "loop",
                    logoLoopDuration: this.currentManifest.settings?.logoLoopDuration ||
                        currentConfig.logoLoopDuration ||
                        5,
                };
                // Save updated config
                await window.electronAPI.saveConfig(updatedConfig);
                console.log("LogoManifestService: Local config updated with manifest data", {
                    logoCount: logoImages.length,
                    logoMode: updatedConfig.logoMode,
                    logoLoopDuration: updatedConfig.logoLoopDuration,
                });
            }
        }
        catch (error) {
            console.error("LogoManifestService: Error updating local config:", error);
        }
    }
    /**
     * Trigger hot reload to update UI immediately
     */
    async triggerHotReload() {
        try {
            // Send multiple events to ensure hot reload works
            if (typeof window !== "undefined" && window.electronAPI) {
                // Force config reload in main process
                const currentConfig = await window.electronAPI.getConfig();
                // Trigger immediate UI update
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent("logo-manifest-updated", {
                        detail: {
                            manifest: this.currentManifest,
                            timestamp: Date.now(),
                        },
                    }));
                }
                console.log("LogoManifestService: Hot reload triggered");
            }
        }
        catch (error) {
            console.error("LogoManifestService: Error triggering hot reload:", error);
        }
    }
    /**
     * Get current manifest
     */
    getCurrentManifest() {
        return this.currentManifest;
    }
    /**
     * Get cached logo path by ID
     */
    getCachedLogoPath(logoId) {
        return this.logoCache.get(logoId) || null;
    }
    /**
     * Get service status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            polling: this.pollTimer !== null,
            lastUpdate: this.currentManifest?.lastUpdated || null,
            logoCount: this.currentManifest?.logos.length || 0,
            cacheSize: this.logoCache.size,
        };
    }
    /**
     * Add update callback
     */
    onLogoUpdate(callback) {
        this.updateCallbacks.push(callback);
        return () => {
            const index = this.updateCallbacks.indexOf(callback);
            if (index > -1) {
                this.updateCallbacks.splice(index, 1);
            }
        };
    }
    /**
     * Notify update callbacks
     */
    notifyUpdateCallbacks(logos) {
        this.updateCallbacks.forEach((callback) => {
            try {
                callback(logos);
            }
            catch (error) {
                console.error("LogoManifestService: Error in update callback:", error);
            }
        });
    }
    /**
     * Force manual sync
     */
    async forcSync() {
        console.log("LogoManifestService: Force sync requested...");
        try {
            const success = await this.fetchManifest();
            if (success && this.currentManifest) {
                await this.processManifestUpdate(this.currentManifest);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("LogoManifestService: Force sync failed:", error);
            return false;
        }
    }
    /**
     * Stop service and cleanup
     */
    destroy() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.logoCache.clear();
        this.updateCallbacks = [];
        this.isPolling = false;
        console.log("LogoManifestService: Service destroyed and cleaned up");
    }
}
exports.default = LogoManifestService;
