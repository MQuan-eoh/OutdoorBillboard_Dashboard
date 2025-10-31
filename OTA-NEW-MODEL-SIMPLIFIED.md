# OTA Update - Mô Hình Đơn Giản Hóa (v2.0)

## Trạng Thái: REFACTORING

**Ngày:** 2025-10-31  
**Tác Giả:** Tech Lead  
**Lý Do:** Đơn giản hóa workflow, loại bỏ kiểm tra version phức tạp

---

## Sơ Đồ Luồng Mới - 3 Bước

```
┌────────────────────────────────────────────────────────────────────┐
│ BƯỚC 1: PUSH VERSION MỚI (Một chiều)                              │
└────────────────────────────────────────────────────────────────────┘

  [ADMIN-WEB]
       │
       ├─ Upload .exe version 1.0.3 to GitHub Release v1.0.3
       │
       └─► MQTT: { action: "force_update" }
           │
           └─► [DESKTOP APP]
               │
               ├─ Download .exe từ: .../v1.0.3/ITS-Billboard.exe
               │  (Không cần check version hiện tại)
               │
               └─ MQTT Status: { status: "downloading", percent: X% }


┌────────────────────────────────────────────────────────────────────┐
│ BƯỚC 2: VERIFY 100% SUCCESS                                        │
└────────────────────────────────────────────────────────────────────┘

  [DESKTOP APP] Download hoàn thành
       │
       ├─ Event: "update-downloaded"
       │
       ├─ MQTT Status: { status: "update_success" }
       │  (Tín hiệu: Download 100%, sẵn sàng cài đặt)
       │
       └─► [ADMIN-WEB] Nhận xác nhận thành công


┌────────────────────────────────────────────────────────────────────┐
│ BƯỚC 3: TRIGGER RESET (Tự động)                                   │
└────────────────────────────────────────────────────────────────────┘

  [DESKTOP APP] Sau khi update-downloaded
       │
       ├─ MQTT: { action: "reset_app", reason: "post_update" }
       │  (Tự trigger reset app sau update 100%)
       │
       └─► [DESKTOP APP] Restart → v1.0.3 chạy
           │
           └─ MQTT Status: { status: "reset_success", version: "1.0.3" }
              (Xác nhận app đã restart với version mới)
```

---

## So Sánh: Cũ vs Mới

| Khía Cạnh                  | Mô Hình Cũ                | Mô Hình Mới               |
| -------------------------- | ------------------------- | ------------------------- |
| **Check version hiện tại** | ✅ Có (phức tạp)          | ❌ Không cần              |
| **So sánh version**        | ✅ Có (phức tạp)          | ❌ Loại bỏ                |
| **Push version**           | ✅ Có                     | ✅ Có                     |
| **Verify success**         | ✅ Có (phức tạp)          | ✅ Có (đơn giản)          |
| **Auto reset**             | ❌ Không (quitAndInstall) | ✅ Có (trigger reset_app) |
| **Số lần MQTT message**    | 4-6 lần                   | 3-4 lần                   |
| **Logic desktop app**      | 150+ dòng                 | 50-60 dòng                |

---

## MQTT Message Flow (Chi Tiết)

### Workflow Step 1: Admin bấm "Cập nhật"

```json
ADMIN-WEB → DESKTOP-APP

Topic: its/billboard/commands
Message: {
  "action": "force_update",
  "version": "1.0.3",
  "timestamp": 1730000000000
}
```

### Workflow Step 2: Desktop App nhận, bắt đầu download

```json
DESKTOP-APP → ADMIN-WEB

Topic: its/billboard/update/status
Message: {
  "status": "downloading",
  "version": "1.0.3",
  "percent": 25,
  "bytesPerSecond": 5242880,
  "timestamp": 1730000000001
}
```

(Lặp lại nhiều lần khi progress thay đổi)

### Workflow Step 3: Download hoàn thành (100%)

```json
DESKTOP-APP → ADMIN-WEB

Topic: its/billboard/update/status
Message: {
  "status": "update_success",
  "version": "1.0.3",
  "downloaded": true,
  "timestamp": 1730000000005
}

// Đồng thời tự trigger reset
DESKTOP-APP → DESKTOP-APP (Internal)

Topic: its/billboard/commands
Message: {
  "action": "reset_app",
  "reason": "post_update",
  "timestamp": 1730000000006
}
```

### Workflow Step 4: Reset app hoàn thành

```json
DESKTOP-APP → ADMIN-WEB

Topic: its/billboard/reset/status
Message: {
  "status": "reset_success",
  "version": "1.0.3",
  "timestamp": 1730000000010
}
```

---

## Code Changes Required

### Desktop App (main.js)

#### THAY ĐỔI 1: Xóa handleCheckUpdateCommand (không cần check)

**Cũ:**

```javascript
async handleCheckUpdateCommand() {
  // Kiểm tra version hiện tại
  // So sánh với GitHub
  // Gửi status "update_available"
}
```

**Mới:** Loại bỏ hàm này hoàn toàn

---

#### THAY ĐỔI 2: Đơn giản hóa handleForceUpdateCommand

**Cũ (150+ dòng):**

```javascript
async handleForceUpdateCommand() {
  // 1. ensureAppUpdateFile() - kiểm tra manifest
  // 2. checkForUpdates() - kiểm tra version
  // 3. Nếu có version mới, downloadUpdate()
  // 4. Đợi update-downloaded event
  // 5. quitAndInstall()
  // ... (xử lý error phức tạp)
}
```

**Mới (40-50 dòng):**

```javascript
async handleForceUpdateCommand() {
  try {
    // 1. Đơn thuần bắt đầu download từ GitHub
    await autoUpdater.downloadUpdate();

    // Status: downloading (xử lý qua download-progress event)
  } catch (error) {
    // Send error status
    this.sendUpdateStatus({
      status: "error",
      error: error.message,
      timestamp: Date.now(),
    });
  }
}
```

---

#### THAY ĐỔI 3: Auto-trigger reset sau update thành công

**Sự kiện: update-downloaded**

```javascript
autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded successfully:", info.version);

  // ✅ THAY ĐỔI: Tự động trigger reset_app (không quitAndInstall)
  this.sendUpdateStatus({
    status: "update_success",
    version: info.version,
    timestamp: Date.now(),
  });

  // Tự trigger reset app sau 1 giây
  setTimeout(() => {
    this.triggerResetApp({
      reason: "post_update",
      version: info.version,
    });
  }, 1000);
});
```

**Hàm triggerResetApp:**

```javascript
triggerResetApp(options = {}) {
  const command = {
    action: "reset_app",
    reason: options.reason || "manual",
    version: options.version || app.getVersion(),
    timestamp: Date.now(),
  };

  // Gửi internal command (hoặc pub MQTT và self-subscribe)
  this.handleResetAppCommand(command);
}
```

---

### Admin-Web (admin-web/app.js)

#### Thay ĐỔI 1: UI mới - Chỉ có nút "Cập Nhật"

**Cũ:**

- Nút "Kiểm tra cập nhật"
- Nút "Cập nhật ngay"
- Status: "update_available", "no_updates", ...

**Mới:**

- Nút "Cập Nhật Phiên Bản Mới"
- Input: Nhập version mới (default từ config hoặc suggestion)
- Status: "downloading", "success", "error"

```html
<!-- admin-web/index.html -->

<div class="update-section">
  <div class="update-form">
    <label>Phiên bản mới</label>
    <input id="updateVersion" type="text" placeholder="VD: 1.0.3" />
  </div>

  <button id="updateBtn" onclick="triggerUpdate()">Cập Nhật Ngay</button>

  <div id="updateStatus" class="status">Sẵn sàng cập nhật</div>

  <div id="updateProgress" class="progress-bar" style="display: none;">
    <div class="progress-fill" id="progressFill"></div>
    <span id="progressText">0%</span>
  </div>
</div>
```

#### THAY ĐỔI 2: Update handler logic

```javascript
function triggerUpdate() {
  const version = document.getElementById("updateVersion").value;

  if (!version) {
    alert("Nhập phiên bản mới");
    return;
  }

  // Send MQTT: force_update
  mqttClient.publish(
    "its/billboard/commands",
    JSON.stringify({
      action: "force_update",
      version: version,
      timestamp: Date.now(),
    })
  );

  updateStatus("Bắt đầu cập nhật...");
  showProgressBar();
}
```

#### THAY ĐỔI 3: Listener status updates

```javascript
// Subscribe to update status
mqttClient.subscribe("its/billboard/update/status");

mqttClient.on("message", (topic, message) => {
  if (topic === "its/billboard/update/status") {
    const status = JSON.parse(message.toString());

    if (status.status === "downloading") {
      updateProgress(status.percent);
      updateStatus(`Đang tải: ${status.percent}%`);
    } else if (status.status === "update_success") {
      updateStatus("Cập nhật thành công, đang khởi động lại...");
      updateProgress(100);
    } else if (status.status === "error") {
      updateStatus(`Lỗi: ${status.error}`);
      hideProgressBar();
    }
  }

  // Subscribe to reset status
  if (topic === "its/billboard/reset/status") {
    const resetStatus = JSON.parse(message.toString());

    if (resetStatus.status === "reset_success") {
      updateStatus(`Cập nhật hoàn thành! (v${resetStatus.version})`);
      hideProgressBar();
    }
  }
});
```

---

## File Changes Summary

| File                   | Thay Đổi                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `main.js`              | Xóa handleCheckUpdateCommand, đơn giản hóa handleForceUpdateCommand, thêm triggerResetApp |
| `admin-web/index.html` | Thêm input version, update UI                                                             |
| `admin-web/app.js`     | Thay đổi logic trigger update, add listeners                                              |
| `admin-web/styles.css` | Thêm style progress bar                                                                   |
| Docs                   | Cập nhật OTA-WORKFLOW-DIAGRAM.md                                                          |

---

## Benefits của Mô Hình Mới

1. **Đơn Giản Hơn**

   - Loại bỏ logic check version (50+ dòng)
   - Loại bỏ version mismatch error
   - Loại bỏ custom checkForUpdates override

2. **Nhanh Hơn**

   - Bỏ qua bước check version
   - Trực tiếp download
   - Tổng thời gian: 2-3 phút (thay vì 3-5 phút)

3. **Đáng Tin Cậy Hơn**

   - Không phụ thuộc version hiện tại
   - Reset app tự động (đảm bảo clean state)
   - Ít điểm failure

4. **Professional Hơn**
   - Admin-web UI clear: upload → monitor → done
   - MQTT flow: push → verify → reset
   - 100% one-way, không callback phức tạp

---

## Rollback Plan

Nếu cần quay lại mô hình cũ:

1. Backup branch: `git checkout -b backup-old-ota main`
2. Revert changes: `git log --oneline` (tìm commit update)
3. `git revert [commit-hash]`

---

## Testing Checklist

Sau khi refactor:

- [ ] Manual test: Upload v1.0.3 → Desktop app download
- [ ] Monitor: MQTT messages đầy đủ
- [ ] Verify: App restart với v1.0.3
- [ ] Error case: Network fail → Show error UI
- [ ] Admin-web: UI responsive, real-time progress

---

## Next Step

1. Refactor main.js (desktop app)
2. Update admin-web UI & logic
3. Test workflow end-to-end
4. Update docs

---

**Status:** Planning → Ready to implement
