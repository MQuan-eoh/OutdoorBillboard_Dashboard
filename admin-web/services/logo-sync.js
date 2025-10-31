/**
 * Logo Sync Service
 * Manifest cleanup and synchronization
 * Validates and fixes broken logo URLs in manifest
 */

export class LogoSyncService {
  constructor(githubService) {
    this.github = githubService;
    console.log("[LogoSync] Service initialized");
  }

  /**
   * Cleanup manifest and fix broken URLs
   */
  async cleanupManifest(manifestUrl) {
    try {
      console.log("[LogoSync] Starting manifest cleanup...");

      const response = await fetch(manifestUrl);
      const manifest = await response.json();

      console.log("[LogoSync] Current manifest version:", manifest.version);

      const validLogos = [];
      const brokenLogos = [];

      for (const logo of manifest.logos || []) {
        console.log(`[LogoSync] Checking logo: ${logo.id}`);

        try {
          const logoResponse = await fetch(logo.url, { method: "HEAD" });

          if (logoResponse.ok) {
            let fixedUrl = logo.url;

            if (
              logo.url.includes("github.com") &&
              logo.url.includes("/blob/")
            ) {
              fixedUrl = logo.url
                .replace("github.com", "raw.githubusercontent.com")
                .replace("/blob/", "/");
              console.log(`[LogoSync] Fixed URL for ${logo.id}`);
            }

            const testResponse = await fetch(fixedUrl, { method: "HEAD" });
            if (testResponse.ok) {
              validLogos.push({
                ...logo,
                url: fixedUrl,
              });
              console.log(`[LogoSync] Logo ${logo.id} is valid`);
            } else {
              throw new Error(`Fixed URL invalid: ${testResponse.status}`);
            }
          } else {
            throw new Error(`URL invalid: ${logoResponse.status}`);
          }
        } catch (error) {
          console.error(`[LogoSync] Logo ${logo.id} is broken:`, error.message);
          brokenLogos.push(logo);
        }
      }

      const cleanedManifest = {
        ...manifest,
        logos: validLogos,
        version: `1.0.${Date.now()}`,
        lastUpdated: new Date().toISOString(),
        metadata: {
          ...manifest.metadata,
          lastModifiedBy: "Logo Sync Service",
          cleanupDate: new Date().toISOString(),
          removedLogos: brokenLogos.map((logo) => logo.id),
        },
      };

      console.log("[LogoSync] Cleanup completed");
      console.log(`[LogoSync] Valid logos: ${validLogos.length}`);
      console.log(`[LogoSync] Broken logos: ${brokenLogos.length}`);

      if (brokenLogos.length > 0) {
        console.log(
          "[LogoSync] Removed broken logos:",
          brokenLogos.map((logo) => logo.id)
        );
      }

      return cleanedManifest;
    } catch (error) {
      console.error("[LogoSync] Manifest cleanup failed:", error);
      throw error;
    }
  }

  /**
   * Upload cleaned manifest
   */
  async uploadCleanedManifest(cleanedManifest) {
    if (!this.github || !this.github.isAuthenticated) {
      throw new Error("GitHub service not authenticated");
    }

    try {
      console.log("[LogoSync] Uploading cleaned manifest...");

      await this.github.uploadManifest(cleanedManifest);

      console.log("[LogoSync] Cleaned manifest uploaded successfully");
      return true;
    } catch (error) {
      console.error("[LogoSync] Failed to upload cleaned manifest:", error);
      throw error;
    }
  }

  /**
   * Complete cleanup and upload workflow
   */
  async cleanupAndUpload(manifestUrl) {
    try {
      const cleanedManifest = await this.cleanupManifest(manifestUrl);
      await this.uploadCleanedManifest(cleanedManifest);

      console.log("[LogoSync] Cleanup and upload completed successfully");
      return cleanedManifest;
    } catch (error) {
      console.error("[LogoSync] Cleanup and upload failed:", error);
      throw error;
    }
  }

  /**
   * Validate manifest structure
   */
  validateManifest(manifest) {
    try {
      console.log("[LogoSync] Validating manifest structure...");

      const required = ["version", "logos", "lastUpdated", "metadata"];

      for (const field of required) {
        if (!manifest.hasOwnProperty(field)) {
          console.warn(`[LogoSync] Missing field: ${field}`);
        }
      }

      if (Array.isArray(manifest.logos)) {
        for (const logo of manifest.logos) {
          if (!logo.id || !logo.url || !logo.name) {
            console.warn("[LogoSync] Logo missing required fields:", logo);
          }
        }
      }

      console.log("[LogoSync] Manifest validation completed");
      return true;
    } catch (error) {
      console.error("[LogoSync] Manifest validation failed:", error);
      return false;
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      authenticated: this.github?.isAuthenticated || false,
      ready: !!this.github,
    };
  }
}
