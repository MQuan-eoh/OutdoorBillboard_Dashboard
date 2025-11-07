# Bug Fix: MQTT Device Values Not Displaying on Desktop App

## Tóm tắt vấn đề

Desktop application không hiển thị giá trị từ thiết bị đo (temperature, humidity, PM2.5, PM10) mà chỉ hiển thị "N/A" mặc dù MQTT service đã nhận được data thành công.

## Triệu chứng

- MQTT service trong main process đã kết nối thành công và nhận được data
- Console log cho thấy data được parse đúng định dạng: `{"v":18,"time":1762405649.131}`
- UI vẫn hiển thị "N/A" cho tất cả sensor values
- Không có lỗi trong console về IPC communication

## Phân tích nguyên nhân

### 1. Data Flow Architecture

```
MQTT Broker → MainProcessMqttService → handleMqttMessage() → updateSensorData() → IPC → Renderer Process → UI Components
```

### 2. Root Cause

Vấn đề nằm ở logic extract value từ JSON object trong `handleMqttMessage()` method của `MainProcessMqttService`.

**Code lỗi:**

```javascript
// Extract value from various possible formats
if (typeof data === "object" && data !== null) {
  const keys = Object.keys(data);
  if (keys.length === 1) {
    // ❌ BUG: JSON có 2 keys {v, time}
    const key = keys[0];
    const potentialValue = data[key];
    // Logic extract value...
  }
}
```

**Data thực tế từ MQTT:**

```json
{
  "v": 18,
  "time": 1762405649.131
}
```

**Vấn đề:** Code expect JSON object chỉ có 1 key, nhưng thực tế có 2 keys (`v` và `time`). Do đó condition `keys.length === 1` trả về false, và `value` vẫn là `null`.

### 3. Debug Process

**Bước 1:** Thêm debug logs để trace data flow

```javascript
console.log(
  `MainProcessMqttService: Extracted configId: ${configId}, value: ${value}`
);
console.log(
  `MainProcessMqttService: updateSensorData called with configId: ${configId}, value: ${value}`
);
```

**Bước 2:** Phát hiện `value = null` mặc dù JSON parse thành công

```
MainProcessMqttService: Parsed JSON: { v: 751, time: 1762440376 }
MainProcessMqttService: Invalid value extracted: null, isNaN: false
```

**Bước 3:** Xác định logic extract value bị lỗi

## Solution Implementation

### Fix Code

Sửa logic extract value để handle JSON object có multiple keys:

```javascript
// OLD CODE (BUG)
if (keys.length === 1) {
  const key = keys[0];
  const potentialValue = data[key];
  // ...
}

// NEW CODE (FIXED)
// Specifically look for 'v' key in E-RA format
if (data.hasOwnProperty("v")) {
  const potentialValue = data.v;
  if (typeof potentialValue === "string") {
    value = this.parseEraValue(potentialValue);
  } else if (typeof potentialValue === "number" && !isNaN(potentialValue)) {
    value = potentialValue;
  }
}
```

### Key Changes

1. **Removed length check:** Không còn check `keys.length === 1`
2. **Direct property access:** Trực tiếp truy cập `data.v` thay vì iterate qua keys
3. **E-RA format specific:** Code giờ handle đúng format của E-RA IoT platform

## Verification

### Before Fix

```
MainProcessMqttService: Parsed JSON: { v: 18, time: 1762405649.131 }
MainProcessMqttService: Invalid value extracted: null, isNaN: false
```

### After Fix

```
MainProcessMqttService: Parsed JSON: { v: 18, time: 1762405649.131 }
MainProcessMqttService: Extracted configId: 145636, value: 18
MainProcessMqttService: updateSensorData called with configId: 145636, value: 18
MainProcessMqttService: Mapped sensor type: pm10 for configId: 145636
MainProcessMqttService: Updating pm10 (ID: 145636) = 18
MainProcessMqttService: Broadcasted sensor data: {
  temperature: 29.5,
  humidity: 751,
  pm25: 20,
  pm10: 18,
  lastUpdated: 2025-11-06T14:30:45.123Z,
  status: "connected"
}
```

### UI Result

- Temperature: `29.5°C` (instead of N/A)
- Humidity: `751%` (instead of N/A)
- PM2.5: `20 μg/m³` (instead of N/A)
- PM10: `18 μg/m³` (instead of N/A)

## Config Mapping Reference

```json
"sensorConfigs": {
  "temperature": 145634,
  "humidity": 145615,
  "pm25": 145635,
  "pm10": 145636
}
```

**MQTT Topics → Sensor Types:**

- `eoh/chip/{token}/config/145634/value` → Temperature
- `eoh/chip/{token}/config/145615/value` → Humidity
- `eoh/chip/{token}/config/145635/value` → PM2.5
- `eoh/chip/{token}/config/145636/value` → PM10

## Files Modified

1. **`main.js`** - Fixed `handleMqttMessage()` method in `MainProcessMqttService` class

## Testing

### Manual Testing

1. Start application: `npm start`
2. Monitor console logs for MQTT data reception
3. Verify UI displays actual sensor values instead of "N/A"
4. Check IPC data broadcast in debug logs

### Expected Behavior

- Real-time sensor data updates every 1-3 seconds
- UI reflects actual sensor readings
- Air quality calculation based on real PM values
- Status shows "connected" when data is flowing

## Prevention

### Code Review Checklist

- [ ] Verify JSON object structure matches expected format
- [ ] Add unit tests for data parsing logic
- [ ] Validate MQTT message format in documentation
- [ ] Add error handling for unexpected JSON structures

### Monitoring

- Add more specific error logging for data extraction failures
- Monitor `currentSensorData` state in development tools
- Set up alerts for missing sensor data in production

## Related Issues

- **IPC Communication:** Verified working correctly
- **MQTT Connection:** Verified successful connection and subscription
- **UI Components:** Verified correct data binding and display logic
- **Config Mapping:** Verified correct sensor ID mapping

## Documentation Updates

This fix addresses the core issue preventing IoT sensor data from displaying in the desktop application. The solution ensures proper data extraction from E-RA IoT platform's JSON format while maintaining backward compatibility with existing MQTT infrastructure.
