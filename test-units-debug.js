/**
 * Test script để debug việc lấy Unit IDs từ E-Ra API
 * Kiểm tra xem tại sao units chỉ hiển thị một ít thay vì toàn bộ
 */

const fs = require("fs");
const path = require("path");

// Load config để lấy auth token
function loadConfig() {
  try {
    const configPath = path.join(__dirname, "config.json");
    const configData = fs.readFileSync(configPath, "utf8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Error loading config:", error.message);
    return null;
  }
}

// Mock auth service để test
class TestAuthService {
  constructor(token) {
    this.token = token;
  }

  isAuthenticated() {
    return !!this.token;
  }

  getAuthHeaders() {
    return {
      Authorization: this.token, // Token already includes "Token " prefix
      "Content-Type": "application/json",
    };
  }
}

// Test function để gọi từng API endpoint riêng biệt
async function testUnitAPIs() {
  console.log("🔍 TESTING UNIT APIs - DEBUG REPORT");
  console.log("=".repeat(60));

  const config = loadConfig();
  if (!config || !config.eraIot || !config.eraIot.authToken) {
    console.error("❌ No E-Ra auth token found in config.json");
    return;
  }

  const authService = new TestAuthService(config.eraIot.authToken);
  const baseUrl = "https://backend.eoh.io";

  console.log("✅ Auth token loaded successfully");
  console.log("🌐 Base URL:", baseUrl);
  console.log("");

  // Test 1: Direct Units API call
  console.log("📋 TEST 1: Direct Units API Call");
  console.log("-".repeat(40));

  try {
    const unitsUrl = `${baseUrl}/api/property_manager/iot_dashboard/dev_mode/units/`;
    console.log("🔗 URL:", unitsUrl);

    const response = await fetch(unitsUrl, {
      method: "GET",
      headers: authService.getAuthHeaders(),
    });

    const responseData = await response.json();
    console.log("📊 Response Status:", response.status);
    console.log("📊 Response Data:", JSON.stringify(responseData, null, 2));

    if (response.ok && responseData) {
      const units = parseUnitsResponse(responseData);
      console.log(`✅ Found ${units.length} units from direct API call`);
      units.forEach((unit, index) => {
        console.log(`   ${index + 1}. ${unit.name} (ID: ${unit.id})`);
      });
    } else {
      console.log("❌ Failed to get units from direct API");
    }
  } catch (error) {
    console.error("❌ Error calling direct units API:", error.message);
  }

  console.log("");

  // Test 2: Chips API call (current approach)
  console.log("🔧 TEST 2: Chips API Call (Current Approach)");
  console.log("-".repeat(40));

  try {
    const chipsUrl = `${baseUrl}/api/chip_manager/developer_mode_chips/`;
    console.log("🔗 URL:", chipsUrl);

    const response = await fetch(chipsUrl, {
      method: "GET",
      headers: authService.getAuthHeaders(),
    });

    const responseData = await response.json();
    console.log("📊 Response Status:", response.status);
    console.log(
      "📊 Number of chips found:",
      Array.isArray(responseData)
        ? responseData.length
        : responseData.results
        ? responseData.results.length
        : "Unknown"
    );

    if (response.ok && responseData) {
      const chips = parseChipsResponse(responseData);
      console.log(`✅ Found ${chips.length} chips`);

      // Convert chips to units
      const units = convertChipsToUnits(chips);
      console.log(`✅ Converted to ${units.length} units:`);

      units.forEach((unit, index) => {
        console.log(
          `   ${index + 1}. ${unit.name} (ID: ${unit.id}) - ${
            unit.isOnline ? "Online" : "Offline"
          }`
        );
      });
    } else {
      console.log("❌ Failed to get chips");
    }
  } catch (error) {
    console.error("❌ Error calling chips API:", error.message);
  }

  console.log("");

  // Test 3: Compare chip filtering
  console.log("🔎 TEST 3: Chip Filtering Analysis");
  console.log("-".repeat(40));

  try {
    const chipsUrl = `${baseUrl}/api/chip_manager/developer_mode_chips/`;
    const response = await fetch(chipsUrl, {
      method: "GET",
      headers: authService.getAuthHeaders(),
    });

    const responseData = await response.json();

    if (response.ok && responseData) {
      console.log("🔍 Raw response structure analysis:");
      console.log("   - Type:", typeof responseData);
      console.log("   - Is Array:", Array.isArray(responseData));
      console.log("   - Has results:", !!responseData.results);
      console.log("   - Has data:", !!responseData.data);

      let chipData = responseData;
      if (responseData.results && Array.isArray(responseData.results)) {
        chipData = responseData.results;
        console.log("   - Using results array");
      } else if (Array.isArray(responseData)) {
        chipData = responseData;
        console.log("   - Using direct array");
      } else if (responseData.data && Array.isArray(responseData.data)) {
        chipData = responseData.data;
        console.log("   - Using data array");
      }

      console.log(
        `   - Total items in array: ${
          Array.isArray(chipData) ? chipData.length : "Not array"
        }`
      );

      if (Array.isArray(chipData) && chipData.length > 0) {
        console.log("📋 Sample chip data structure:");
        const sample = chipData[0];
        console.log("   Keys:", Object.keys(sample));
        console.log("   Sample:", JSON.stringify(sample, null, 4));

        // Test filtering logic
        const onlineChips = chipData.filter(
          (chip) => chip.is_online || chip.online || chip.status === "online"
        );
        const offlineChips = chipData.filter(
          (chip) => !(chip.is_online || chip.online || chip.status === "online")
        );

        console.log(`📊 Online chips: ${onlineChips.length}`);
        console.log(`📊 Offline chips: ${offlineChips.length}`);
      }
    }
  } catch (error) {
    console.error("❌ Error in filtering analysis:", error.message);
  }

  console.log("");
  console.log("🏁 DEBUG TEST COMPLETED");
  console.log("=".repeat(60));
}

// Helper functions (copied from eraConfigService.js)
function parseUnitsResponse(responseData) {
  const units = [];

  try {
    let unitData = null;

    if (responseData.units && Array.isArray(responseData.units)) {
      unitData = responseData.units;
    } else if (responseData.results && Array.isArray(responseData.results)) {
      unitData = responseData.results;
    } else if (Array.isArray(responseData)) {
      unitData = responseData;
    } else if (responseData.data && Array.isArray(responseData.data)) {
      unitData = responseData.data;
    }

    if (Array.isArray(unitData)) {
      unitData.forEach((unit) => {
        units.push({
          id: unit.id || unit.unit_id || unit.unitId || 0,
          name:
            unit.name || unit.unit_name || unit.unitName || `Unit ${unit.id}`,
          description: unit.description || unit.desc || undefined,
          address: unit.address || undefined,
          type: unit.type || unit.unit_type || undefined,
          status: unit.status || unit.is_active ? "active" : "inactive",
        });
      });
    }
  } catch (error) {
    console.error("Error parsing units response:", error);
  }

  return units;
}

function parseChipsResponse(responseData) {
  const chips = [];

  try {
    let chipData = responseData;

    if (responseData.results && Array.isArray(responseData.results)) {
      chipData = responseData.results;
    } else if (Array.isArray(responseData)) {
      chipData = responseData;
    } else if (responseData.data && Array.isArray(responseData.data)) {
      chipData = responseData.data;
    }

    if (Array.isArray(chipData)) {
      chipData.forEach((chip) => {
        chips.push({
          id: chip.id || chip.chip_id || 0,
          name: chip.name || chip.chip_name || `Chip ${chip.id}`,
          description: chip.description || chip.desc || undefined,
          isOnline:
            chip.is_online || chip.online || chip.status === "online" || false,
          lastSeen: chip.last_seen ? new Date(chip.last_seen) : undefined,
          deviceType: chip.device_type || chip.type || undefined,
        });
      });
    }
  } catch (error) {
    console.error("Error parsing chips response:", error);
  }

  return chips;
}

function convertChipsToUnits(chips) {
  const units = [];

  try {
    chips.forEach((chip) => {
      units.push({
        id: chip.id.toString(),
        name: chip.name,
        description: chip.description || `Chip ${chip.id}`,
        isOnline: chip.isOnline,
        lastSeen: chip.lastSeen,
        deviceType: chip.deviceType,
      });
    });

    units.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error converting chips to units:", error);
  }

  return units;
}

// Run the test
if (require.main === module) {
  testUnitAPIs().catch(console.error);
}

module.exports = { testUnitAPIs };
