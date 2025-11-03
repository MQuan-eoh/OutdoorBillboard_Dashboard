#!/usr/bin/env node

/**
 * 🚀 TEST ADMIN-WEB FORCE UPDATE BUTTON
 * Kiểm tra nút "Cập Nhật Ngay" có hoạt động không
 *
 * Chạy: node test-admin-web-button.js
 */

const puppeteer = require("puppeteer");

async function testForceUpdateButton() {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║           🧪 ADMIN-WEB BUTTON TEST                 ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("");

  let browser;
  try {
    console.log("📱 Launching browser...");
    browser = await puppeteer.launch({
      headless: false, // Show browser for visual verification
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    console.log("🌐 Opening admin-web...");
    await page.goto("http://localhost:8000");

    console.log("⏳ Waiting for page to load...");
    await page.waitForSelector("#forceUpdateBtn", { timeout: 10000 });

    // Check if button exists
    const buttonExists = await page.$("#forceUpdateBtn");
    if (!buttonExists) {
      throw new Error("❌ Force Update button not found!");
    }

    console.log("✅ Force Update button found");

    // Check button state
    const isDisabled = await page.$eval(
      "#forceUpdateBtn",
      (btn) => btn.disabled
    );
    const buttonText = await page.$eval(
      "#forceUpdateBtn .btn-text",
      (el) => el.textContent
    );

    console.log(`📋 Button state:`);
    console.log(`   • Text: "${buttonText}"`);
    console.log(`   • Disabled: ${isDisabled}`);

    if (isDisabled) {
      console.log("⚠️  Button is disabled - need to check updates first");
      console.log("   Testing 'Check Updates' button...");

      // Try to click "Check Updates" first
      const checkBtn = await page.$("#checkUpdateBtn");
      if (checkBtn) {
        await checkBtn.click();
        console.log("✅ Clicked 'Check Updates' button");

        // Wait a bit for response
        await page.waitForTimeout(3000);

        // Check if force update button is now enabled
        const isStillDisabled = await page.$eval(
          "#forceUpdateBtn",
          (btn) => btn.disabled
        );
        console.log(`   • Force Update button enabled: ${!isStillDisabled}`);
      }
    }

    // Take screenshot for verification
    await page.screenshot({
      path: "admin-web-button-test.png",
      fullPage: true,
    });
    console.log("📸 Screenshot saved: admin-web-button-test.png");

    console.log("");
    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║           ✅ BUTTON TEST COMPLETED                 ║");
    console.log("╚════════════════════════════════════════════════════╝");
    console.log("");
    console.log("🎯 MANUAL VERIFICATION:");
    console.log("1. Open http://localhost:8000 in browser");
    console.log(
      "2. Look for 'Cập Nhật Ngay' button in 'Cài Đặt Hệ Thống' section"
    );
    console.log("3. Check if button is enabled/disabled");
    console.log("4. Try clicking 'Kiểm Tra Cập Nhật' first");
    console.log("");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.log("");
    console.log("🔧 TROUBLESHOOTING:");
    console.log(
      "1. Make sure admin-web server is running: cd admin-web && python -m http.server 8000"
    );
    console.log("2. Check if puppeteer is installed: npm install puppeteer");
    console.log("3. Check browser console for JavaScript errors");
    console.log(
      "4. Verify button exists in HTML: grep 'forceUpdateBtn' admin-web/index.html"
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run test
testForceUpdateButton().catch(console.error);
