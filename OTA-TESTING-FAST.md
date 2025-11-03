# ⚡ OTA TESTING NHANH NHẤT - 3 BƯỚC

## 📋 CHUẨN BỊ

### Terminal 1: Desktop App

```bash
npm start
```

Chờ app khởi động và xem console logs cho `[OTA]` prefix

### Terminal 2: Admin-Web (nếu cần)

```bash
cd admin-web
python -m http.server 8000
# Hoặc: npx http-server
```

### Terminal 3: Test Script (Main)

Sẽ chạy ở step 3 dưới

---

## ⚡ 3 BƯỚC TESTING NHANH

### BƯỚC 1️⃣: Khởi động Desktop App

```bash
npm start
```

**Chờ cho đến khi thấy:**

```
[MainProcess] Electron app started
[MainProcess] Initializing MQTT connections
[OTA] Desktop app is ready to receive update commands
```

---

### BƯỚC 2️⃣: Gửi OTA Command (Terminal mới)

```bash
node test-ota-quick.js
```

**Script sẽ:**

1. ✅ Kết nối đến MQTT broker
2. ✅ Subscribe vào ACK topic
3. ✅ Gửi update command
4. ✅ Đợi ACK từ desktop app (10 giây)
5. ✅ Hiện kết quả

---

### BƯỚC 3️⃣: Kiểm tra Kết Quả

#### ✅ NẾU THÀNH CÔNG

```
✅ ACK RECEIVED!

   Device Response:
   • Device ID: ITS Outdoor Billboard
   • Status: acknowledged
   • Current Version: 1.0.2
   • Message: Update command received and processing

╔════════════════════════════════════════════════════╗
║           ✅ OTA TEST PASSED!                     ║
╚════════════════════════════════════════════════════╝
```

**Desktop console sẽ hiển thị:**

```
[OTA] Force update initiated
[OTA] Extracting version from command: 1.0.3
[OTA] Update command acknowledged
[OTA] Checking for updates from GitHub...
```

**→ TEST PASS ✅**

---

#### ❌ NẾU THẤT BẠI

| Lỗi                  | Nguyên nhân                | Cách Fix                         |
| -------------------- | -------------------------- | -------------------------------- |
| TIMEOUT: No ACK      | Desktop app không chạy     | Chạy `npm start` ở Terminal 1    |
| TIMEOUT: No ACK      | Desktop không kết nối MQTT | Kiểm tra internet connection     |
| "Invalid ACK format" | Desktop gửi ACK sai format | Check code có syntax error không |

---

## 🔍 DEBUG: Kiểm tra Desktop Console

**Tìm các log này trong console:**

```
✅ GOOD SIGNS:
[OTA] Force update initiated
[OTA] Extracting version
[OTA] Update acknowledgment sent
[MainProcessMqttService] Received command message

❌ BAD SIGNS:
[Error] Invalid command object
[Error] Failed to subscribe
Cannot connect to MQTT
```

---

## 🚀 FAST PATH SUMMARY

```
Terminal 1:           Terminal 2:              Expected:
npm start      →      node test-ota-quick.js   → ✅ ACK RECEIVED
(wait logs)            (wait 10sec)              → TEST PASSED ✅
```

**Total time:** ~30 giây (từ lúc chạy test script)

---

## 💡 NẾU MUỐN TEST VỚI ADMIN-WEB

1. Khởi động desktop: `npm start`
2. Khởi động admin-web: `cd admin-web && python -m http.server 8000`
3. Mở browser: `http://localhost:8000`
4. Kích "Force Update" button
5. Xem feedback trên admin-web UI

---

## 📊 EXPECTED BEHAVIOR

```
Admin-Web Timeline:
│
├─ Button clicked: "Force Update"
│
├─ Notification: "Checking MQTT connection..."
│
├─ Notification: "Connecting to MQTT..."
│
├─ MQTT sends command to desktop
│
├─ [Wait 5 seconds for ACK]
│
├─ ✅ "Billboard acknowledged!"
│
└─ Progress bar: 0% → 100%


Desktop Timeline:
│
├─ Receives MQTT message
│
├─ Validates command ✓
│
├─ Extracts version ✓
│
├─ Sends ACK back ✓
│
├─ Starts download
│
├─ Progress: 0% → 100%
│
└─ Restarts with new version ✓
```

---

## ✅ CHECKLIST TRƯỚC KHI TEST

- [ ] Internet connection OK
- [ ] Desktop app runs without error
- [ ] No firewall blocking MQTT (port 8884)
- [ ] MQTT broker accessible (can test: https://www.hivemq.com/tools/mqtt-client/)
- [ ] GitHub releases exist for version 1.0.3+
- [ ] Node.js >= 14

---

**QUICK TEST COMMAND:**

```bash
npm start & timeout 5 & node test-ota-quick.js
```

This starts app and runs test after 5 seconds! 🚀

---

**STATUS:** ✅ OTA System Ready for Testing
