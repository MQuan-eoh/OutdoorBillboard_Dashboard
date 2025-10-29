/**
 * Manifest Cleanup Utility
 * Fix manifest.json to remove broken URLs and ensure proper format
 */

async function cleanupManifest() {
  try {
    console.log("🧹 Starting manifest cleanup...");

    // Get current manifest
    const manifestUrl =
      "https://mquan-eoh.github.io/billboard-logos-cdn/manifest.json";
    const response = await fetch(manifestUrl);
    const manifest = await response.json();

    console.log("📄 Current manifest:", manifest);

    // Validate each logo URL
    const validLogos = [];
    const brokenLogos = [];

    for (const logo of manifest.logos) {
      console.log(`🔍 Checking logo: ${logo.id} - ${logo.url}`);

      try {
        const logoResponse = await fetch(logo.url, { method: "HEAD" });
        if (logoResponse.ok) {
          // Ensure URL uses proper format
          let fixedUrl = logo.url;

          // Convert GitHub blob URLs to raw URLs
          if (logo.url.includes("github.com") && logo.url.includes("/blob/")) {
            fixedUrl = logo.url
              .replace("github.com", "raw.githubusercontent.com")
              .replace("/blob/", "/");
            console.log(`🔧 Fixed URL for ${logo.id}: ${fixedUrl}`);
          }

          // Test fixed URL
          const testResponse = await fetch(fixedUrl, { method: "HEAD" });
          if (testResponse.ok) {
            validLogos.push({
              ...logo,
              url: fixedUrl,
            });
            console.log(`✅ Logo ${logo.id} is valid`);
          } else {
            throw new Error(`Fixed URL still invalid: ${testResponse.status}`);
          }
        } else {
          throw new Error(`URL invalid: ${logoResponse.status}`);
        }
      } catch (error) {
        console.error(`❌ Logo ${logo.id} is broken:`, error.message);
        brokenLogos.push(logo);
      }
    }

    // Create cleaned manifest
    const cleanedManifest = {
      ...manifest,
      logos: validLogos,
      version: `1.0.${Date.now()}`,
      lastUpdated: new Date().toISOString(),
      metadata: {
        ...manifest.metadata,
        lastModifiedBy: "Manifest Cleanup Utility",
        cleanupDate: new Date().toISOString(),
        removedLogos: brokenLogos.map((logo) => logo.id),
      },
    };

    console.log("🎉 Cleanup completed!");
    console.log(`✅ Valid logos: ${validLogos.length}`);
    console.log(`❌ Broken logos: ${brokenLogos.length}`);

    if (brokenLogos.length > 0) {
      console.log(
        "🗑️ Removed broken logos:",
        brokenLogos.map((logo) => logo.id)
      );
    }

    return cleanedManifest;
  } catch (error) {
    console.error("💥 Manifest cleanup failed:", error);
    throw error;
  }
}

// Function to upload cleaned manifest
async function uploadCleanedManifest(cleanedManifest) {
  if (
    !window.GitHubUploadService ||
    !window.GitHubUploadService.isAuthenticated
  ) {
    console.error("❌ GitHub service not authenticated");
    return false;
  }

  try {
    console.log("📤 Uploading cleaned manifest...");

    await window.GitHubUploadService.uploadManifest(cleanedManifest);

    console.log("✅ Cleaned manifest uploaded successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to upload cleaned manifest:", error);
    return false;
  }
}

// Combined cleanup and upload function
async function cleanupAndUploadManifest() {
  try {
    const cleanedManifest = await cleanupManifest();
    const uploaded = await uploadCleanedManifest(cleanedManifest);

    if (uploaded) {
      console.log("🎉 Manifest cleanup and upload completed successfully!");

      // Trigger manifest refresh
      if (window.forceRefreshBillboard) {
        setTimeout(() => {
          window.forceRefreshBillboard();
        }, 2000);
      }
    }

    return cleanedManifest;
  } catch (error) {
    console.error("💥 Cleanup and upload failed:", error);
    throw error;
  }
}

// Export functions for manual use
window.cleanupManifest = cleanupManifest;
window.uploadCleanedManifest = uploadCleanedManifest;
window.cleanupAndUploadManifest = cleanupAndUploadManifest;

console.log("🧹 Manifest cleanup utilities loaded");
console.log("💡 Run 'cleanupAndUploadManifest()' to fix broken manifest URLs");
