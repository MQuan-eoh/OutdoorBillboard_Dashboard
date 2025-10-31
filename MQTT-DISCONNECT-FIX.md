# MQTT DISCONNECT BUG FIX - OTA UPDATE ISSUE

## Problem Analysis

### Symptoms:

- Admin-web shows "Update check passed - v1.0.0 available"
- Click "Force Update" triggers initial message
- MQTT starts reconnecting repeatedly (Max reconnection attempts reached)
- Desktop app receives update command but OTA update doesn't complete
- Admin-web loses MQTT connection during update process

### Root Cause:

1. **Admin-web MQTT connection instability:**

   - HiveMQ free broker can be slow under load
   - Default reconnect period (1000ms) too aggressive
   - Max reconnect attempts (5) too low for network fluctuations
   - Rapid reconnect attempts cause broker to rate-limit or disconnect

2. **Improper connection management during update:**

   - Admin-web needs to keep monitoring MQTT for status updates
   - Both sides maintaining separate MQTT clients can cause conflicts
   - No exponential backoff for reconnection attempts

3. **Race condition in status reporting:**
   - When update downloads large files, network becomes busy
   - MQTT messages get buffered or lost
   - Reconnect storm triggers when trying to send status

## Solutions Implemented

### 1. Admin-Web Client Improvements (mqtt-client.js)

**Increased max reconnect attempts:**

```javascript
this.maxReconnectAttempts = 10; // Was 5
```

Allows connection to survive longer network disruptions.

**Exponential backoff for reconnection:**

```javascript
reconnectPeriod: Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
// Delays: 1s, 1.5s, 2.2s, 3.4s, 5s, 7.5s... (capped at 30s)
```

Prevents overwhelming broker with connection requests.

**Better reconnection logging:**

```javascript
console.log(
  `MQTT Client reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
);
console.log(`Next reconnect in ${(backoffDelay / 1000).toFixed(1)}s`);
```

### 2. Main Process Update Handler (main.js)

**Keep MQTT alive during download:**

```javascript
// IMPORTANT: Keep MQTT connected during update to monitor progress
// Do NOT disconnect MQTT - admin-web needs to receive status updates
console.log(
  "MainProcessMqttService: Keeping MQTT connection alive for status reporting"
);
```

- Removed any disconnect calls during OTA update
- MQTT stays connected to send progress updates
- Admin-web can monitor update status in real-time

### 3. Admin-Web Update UI (app.js)

**Better timeout handling:**

```javascript
// Extended timeout from 60s to 120s for large downloads
const timeoutId = setTimeout(() => {
  // Don't close connection on timeout - just show status
}, 120000);
```

**Improved progress indication:**

- Shows "Waiting for download to start"
- Better cleanup of intervals and timeouts
- Prevents duplicate timer issues

## Testing Steps

### Test 1: Check update detection works

1. Click "KIỂM TRA CẬP NHẬT"
2. Verify "v1.0.0 available" message appears
3. MQTT should stay connected

### Test 2: Force update

1. Click "CẬP NHẬT NGAY"
2. Confirm dialog
3. Admin-web should maintain MQTT connection
4. Progress bar should advance
5. Billboard app should restart after download

### Test 3: Network resilience

1. Simulate network interruption during update
2. MQTT should reconnect with exponential backoff
3. Update should continue after reconnection

### Test 4: Multiple clients

1. Run admin-web on 2 browsers
2. Both should maintain separate MQTT connections
3. Update command should work from either client

## Performance Metrics

Before fix:

- Max reconnect attempts: 5 (fails after ~5s of network issues)
- Reconnect delay: constant 1000ms (storms broker)
- Update timeout: 60s (too short for large files)

After fix:

- Max reconnect attempts: 10 (handles ~30s of issues)
- Reconnect delay: exponential 1-30s (respects broker load)
- Update timeout: 120s (handles slower downloads)
- MQTT stays alive: Yes (enables real-time status)

## Troubleshooting

### If MQTT still disconnects:

1. Check HiveMQ broker status: https://www.hivemq.com/
2. Try alternative MQTT broker if HiveMQ is overloaded
3. Increase maxReconnectAttempts further if needed

### If update takes too long:

1. Check network speed: `speedtest.net`
2. Check file size on GitHub release
3. Consider using local MQTT broker instead of cloud broker

### If admin-web shows "Error":

1. Check console logs for exact error message
2. Verify MQTT connection before clicking update
3. Try refresh admin-web and retry

## Files Modified

1. `/admin-web/mqtt-client.js`

   - Increased max reconnect attempts: 5 → 10
   - Added exponential backoff calculation
   - Better reconnection logging

2. `/main.js`

   - Keep MQTT alive during OTA update
   - Added explicit log about not disconnecting
   - Added delay before download to ensure status sent

3. `/admin-web/app.js`
   - Extended timeout: 60s → 120s
   - Better progress UI state management
   - Improved error messages
   - Proper cleanup of timers

## Future Improvements

1. Switch to local MQTT broker (Mosquitto) instead of cloud
2. Add bandwidth throttling for large downloads
3. Implement chunked update status reporting
4. Add update resume capability
5. Cache updates locally to avoid re-download
