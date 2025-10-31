/**
 * UI Core Module
 * Basic UI utilities: notifications, modals, status display
 */

/**
 * Show toast notification
 */
export function showToast(message, type = "info", duration = 5000) {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const emoji = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  toast.innerHTML = `
    <span class="toast-emoji">${emoji[type] || "ℹ"}</span>
    <span class="toast-message">${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);

  console.log(`[Toast] ${type.toUpperCase()}: ${message}`);
}

/**
 * Show modal dialog
 */
export function showModal(title, content) {
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  if (!modal || !modalTitle || !modalBody) return;

  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  modal.style.display = "block";

  console.log("[Modal] Opened:", title);
}

/**
 * Close modal dialog
 */
export function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) {
    modal.style.display = "none";
  }
  console.log("[Modal] Closed");
}

/**
 * Update connection status display
 */
export function updateConnectionStatus(status) {
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");

  if (!statusIndicator || !statusText) return;

  statusIndicator.className = "status-indicator";

  const statusMap = {
    connected: { class: "online", text: "Đã kết nối" },
    connecting: { class: "connecting", text: "Đang kết nối..." },
    reconnecting: { class: "connecting", text: "Tái kết nối..." },
    disconnected: { class: "offline", text: "Mất kết nối" },
    error: { class: "offline", text: "Lỗi kết nối" },
  };

  const statusInfo = statusMap[status.status] || statusMap.disconnected;

  statusIndicator.classList.add(statusInfo.class);
  statusText.textContent = statusInfo.text;

  console.log("[UI] Status updated:", status.status);
}

/**
 * Show confirmation dialog
 */
export function showConfirmation(title, message) {
  return new Promise((resolve) => {
    const confirmed = confirm(`${title}\n\n${message}`);
    console.log("[Confirmation]", title, "→", confirmed);
    resolve(confirmed);
  });
}

/**
 * Enable/disable UI element
 */
export function setElementDisabled(elementId, disabled = true) {
  const element = document.getElementById(elementId);
  if (element) {
    element.disabled = disabled;
    console.log(
      `[UI] Element ${elementId} ${disabled ? "disabled" : "enabled"}`
    );
  }
}

/**
 * Show/hide element
 */
export function setElementVisible(elementId, visible = true) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = visible ? "block" : "none";
    console.log(`[UI] Element ${elementId} ${visible ? "shown" : "hidden"}`);
  }
}

/**
 * Update element text
 */
export function setElementText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Update element HTML
 */
export function setElementHTML(elementId, html) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = html;
  }
}

/**
 * Get element value
 */
export function getElementValue(elementId) {
  const element = document.getElementById(elementId);
  return element ? element.value : null;
}

/**
 * Set element value
 */
export function setElementValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.value = value;
  }
}
