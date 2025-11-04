/**
 * Enhanced Debug Utilities for Logo Manifest Service
 * Add comprehensive logging and error tracking
 */

// Enhanced error handling for logo manifest service
function enhanceLogoManifestDebugging() {
  console.log("🔍 Enhancing logo manifest debugging...");

  // Monitor custom events
  if (typeof window !== "undefined") {
    window.addEventListener("logo-manifest-updated", (event) => {
      console.log("🎯 Logo manifest updated event received:", event.detail);

      const manifest = event.detail?.manifest;
      if (manifest) {
        console.log(
          `📊 Manifest info: ${manifest.logos?.length || 0} logos, version: ${
            manifest.version
          }`
        );

        // Log active logos
        const activeLogos = manifest.logos?.filter((logo) => logo.active) || [];
        console.log(
          `✅ Active logos: ${activeLogos.length}`,
          activeLogos.map((logo) => logo.name)
        );

        // Check for broken URLs
        const brokenLogos =
          manifest.logos?.filter(
            (logo) =>
              !logo.url ||
              logo.url.includes("company-logo-3.png") ||
              logo.url.includes("/blob/")
          ) || [];

        if (brokenLogos.length > 0) {
          console.warn(
            "⚠️ Potentially broken logos detected:",
            brokenLogos.map((logo) => ({
              id: logo.id,
              name: logo.name,
              url: logo.url,
            }))
          );
        }
      }
    });

    // Monitor other events that might affect logo display
    ["resize", "focus", "visibilitychange"].forEach((eventType) => {
      window.addEventListener(eventType, () => {
        console.log(`🔄 Window ${eventType} event - UI might need refresh`);
      });
    });
  }

  // Override console.error to catch logo-related errors
  const originalError = console.error;
  console.error = function (...args) {
    // Check if this is a logo-related error
    const errorMessage = args.join(" ");
    if (
      errorMessage.includes("logo") ||
      errorMessage.includes("manifest") ||
      errorMessage.includes("billboard")
    ) {
      console.log("🚨 LOGO ERROR DETECTED:", ...args);

      // Try to get current state
      if (window.logoManifestService) {
        console.log("📊 Current manifest state:", {
          isRunning: window.logoManifestService.isRunning,
          currentManifest: window.logoManifestService.currentManifest,
          config: window.logoManifestService.config,
        });
      }
    }

    originalError.apply(console, args);
  };

  console.log("✅ Logo manifest debugging enhanced");
}

// Function to manually test logo downloads
async function testLogoDownloads() {
  console.log("🧪 Testing logo downloads...");

  try {
    const manifestUrl =
      "https://mquan-eoh.github.io/billboard-logos-cdn/manifest.json";
    const response = await fetch(manifestUrl);
    const manifest = await response.json();

    console.log("📄 Current manifest:", manifest);

    // Test each logo URL
    for (const logo of manifest.logos || []) {
      console.log(`🔍 Testing logo: ${logo.id} - ${logo.url}`);

      try {
        const logoResponse = await fetch(logo.url, { method: "HEAD" });
        if (logoResponse.ok) {
          console.log(`✅ Logo ${logo.id} is accessible`);
        } else {
          console.error(
            `❌ Logo ${logo.id} failed: ${logoResponse.status} ${logoResponse.statusText}`
          );
        }
      } catch (error) {
        console.error(`💥 Logo ${logo.id} error:`, error.message);
      }
    }
  } catch (error) {
    console.error("💥 Manifest test failed:", error);
  }
}

// Function to force trigger logo update
function forceTriggerLogoUpdate() {
  console.log("🔄 Force triggering logo update...");

  if (typeof window !== "undefined") {
    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent("logo-manifest-updated", {
        detail: {
          manifest: { logos: [], version: "test" },
          timestamp: Date.now(),
          source: "manual-trigger",
        },
      })
    );

    // Try other update methods
    if (window.logoManifestService) {
      window.logoManifestService.forcSync?.();
    }

    console.log("✅ Logo update triggered");
  }
}

// Function to get detailed system state
function getSystemState() {
  const state = {
    window: typeof window !== "undefined",
    electronAPI: typeof window !== "undefined" && !!window.electronAPI,
    logoManifestService:
      typeof window !== "undefined" && !!window.logoManifestService,
    mqttClient: typeof window !== "undefined" && !!window.MqttClient,
    timestamp: new Date().toISOString(),
  };

  console.log("📊 System state:", state);
  return state;
}

// Auto-run debugging enhancement
if (typeof window !== "undefined") {
  // Run enhancement after a short delay
  setTimeout(() => {
    enhanceLogoManifestDebugging();
    getSystemState();
  }, 1000);
}

// Export functions for manual use
if (typeof window !== "undefined") {
  window.enhanceLogoManifestDebugging = enhanceLogoManifestDebugging;
  window.testLogoDownloads = testLogoDownloads;
  window.forceTriggerLogoUpdate = forceTriggerLogoUpdate;
  window.getSystemState = getSystemState;
}

console.log("🔧 Logo manifest debug utilities loaded");
console.log(
  "💡 Available functions: enhanceLogoManifestDebugging(), testLogoDownloads(), forceTriggerLogoUpdate(), getSystemState()"
);
