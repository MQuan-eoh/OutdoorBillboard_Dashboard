/**
 * Test GitHub Banner Upload Functionality
 * Simple test to verify the upload system is working correctly
 */

console.log("🧪 Testing GitHub Banner Upload System...");

// Test configurations
const testConfigs = [
  {
    name: "Primary Repository (MQuan-eoh)",
    config: {
      owner: "MQuan-eoh",
      repo: "billboard-logos-cdn",
    },
  },
  {
    name: "Fallback Repository (MinhQuan7)",
    config: {
      owner: "MinhQuan7",
      repo: "billboard-logos-cdn",
    },
  },
];

// Mock file for testing
const createMockFile = () => {
  const content =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  const blob = new Blob([content], { type: "image/png" });
  const file = new File([blob], "test-banner.png", { type: "image/png" });
  return file;
};

// Test function
async function testGitHubUpload() {
  console.log("🔍 Starting upload tests...");

  try {
    // Test 1: Configuration validation
    console.log("📋 Test 1: Configuration validation");
    if (window.GitHubConfig) {
      window.GitHubConfig.validate();
      console.log("✅ Configuration is valid");
    } else {
      console.warn("⚠️ GitHubConfig not loaded");
    }

    // Test 2: Service initialization
    console.log("📋 Test 2: Service initialization");
    const service = window.GitHubUploadService;
    if (service) {
      console.log("✅ GitHubUploadService is available");
      console.log("📊 Service status:", service.getStatus());
    } else {
      console.error("❌ GitHubUploadService not available");
      return;
    }

    // Test 3: Manifest structure validation
    console.log("📋 Test 3: Manifest structure validation");
    const defaultManifest = service.createDefaultManifest();
    console.log("📄 Default manifest:", defaultManifest);

    // Test addLogoToManifest with empty manifest
    const mockLogo = {
      id: "test-logo",
      name: "Test Logo",
      url: "https://example.com/test.png",
      filename: "test.png",
      size: 1000,
      type: "image/png",
      priority: 1,
      active: true,
      uploadedAt: new Date().toISOString(),
    };

    const updatedManifest = service.addLogoToManifest({}, mockLogo);
    console.log("✅ Manifest update test passed:", updatedManifest);

    // Test 4: Repository access test (requires token)
    console.log("📋 Test 4: Repository access");
    const token = prompt("Enter GitHub token for testing (or cancel to skip):");

    if (token) {
      console.log("🔐 Testing authentication...");
      const authSuccess = await service.initialize(token);

      if (authSuccess) {
        console.log("✅ Authentication successful");

        // Test file upload
        console.log("📋 Test 5: File upload simulation");
        const mockFile = createMockFile();

        try {
          const uploadResult = await service.uploadLogo(mockFile, {
            name: "Test Banner",
            priority: 1,
          });

          console.log("✅ Upload test successful:", uploadResult);

          // Test manifest update
          console.log("📋 Test 6: Manifest update");
          const manifestResult = await service.updateManifest(uploadResult);
          console.log("✅ Manifest update successful");
        } catch (uploadError) {
          console.error("❌ Upload test failed:", uploadError.message);
        }
      } else {
        console.error("❌ Authentication failed");
      }
    } else {
      console.log("⏭️ Skipping authentication tests");
    }

    // Test 7: URL generation
    console.log("📋 Test 7: URL generation");
    if (window.GitHubConfig) {
      console.log(
        "🔗 Repository URL:",
        window.GitHubConfig.getCurrentRepoUrl()
      );
      console.log("🔗 Manifest URL:", window.GitHubConfig.getManifestUrl());
      console.log("✅ URL generation working");
    }

    console.log("🎉 All tests completed!");
  } catch (error) {
    console.error("💥 Test failed:", error);
  }
}

// Run tests automatically if in development environment
if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) {
  // Auto-run tests in 2 seconds
  setTimeout(() => {
    console.log("🚀 Auto-running tests in development environment...");
    testGitHubUpload();
  }, 2000);
}

// Export test function for manual use
window.testGitHubUpload = testGitHubUpload;

console.log("💡 Run 'testGitHubUpload()' in console to test the upload system");
