"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// IoTPanel.tsx - Real-time sensor data display using E-Ra IoT Platform
const react_1 = __importStar(require("react"));
require("./IoTPanel.css");
const IoTPanel = ({ className = "", eraIotService, }) => {
    const [sensorData, setSensorData] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [connectionStatus, setConnectionStatus] = (0, react_1.useState)("offline");
    (0, react_1.useEffect)(() => {
        if (!eraIotService) {
            console.log("IoTPanel: No E-Ra IoT service provided");
            setIsLoading(false);
            setConnectionStatus("offline");
            return;
        }
        console.log("IoTPanel: Initializing with real-time E-Ra IoT service");
        // Subscribe to real-time data updates (receives updates every second from MQTT service)
        const unsubscribeData = eraIotService.onDataUpdate((data) => {
            console.log("IoTPanel: Real-time data update received:", {
                temperature: data.temperature,
                humidity: data.humidity,
                pm25: data.pm25,
                pm10: data.pm10,
                status: data.status,
                lastUpdated: data.lastUpdated,
                errorMessage: data.errorMessage,
            });
            setSensorData(data);
            setIsLoading(false);
            // Update connection status based on data status
            switch (data.status) {
                case "success":
                    setConnectionStatus("connected");
                    break;
                case "partial":
                    setConnectionStatus("connected"); // Still showing some data
                    break;
                case "error":
                    setConnectionStatus("error");
                    break;
                default:
                    setConnectionStatus("offline");
            }
        });
        // Subscribe to service status updates
        const unsubscribeStatus = eraIotService.onStatusUpdate((status) => {
            console.log("IoTPanel: Service status update:", status);
            if (!status.isRunning && !sensorData) {
                setConnectionStatus("offline");
            }
        });
        // Cleanup subscriptions
        return () => {
            unsubscribeData();
            unsubscribeStatus();
        };
    }, [eraIotService, sensorData]);
    // Handle manual refresh
    const handleRefresh = async () => {
        if (!eraIotService)
            return;
        console.log("IoTPanel: Manual refresh requested");
        setIsLoading(true);
        try {
            await eraIotService.refreshData();
            // Give some time for the service to update
            setTimeout(() => {
                const updatedData = eraIotService.getCurrentData();
                if (updatedData) {
                    setSensorData(updatedData);
                    setConnectionStatus(updatedData.status === "error" ? "error" : "connected");
                }
                setIsLoading(false);
            }, 1000);
        }
        catch (error) {
            console.error("IoTPanel: Manual refresh failed:", error);
            setConnectionStatus("error");
            setIsLoading(false);
        }
    };
    // Format sensor data for display
    const formatSensorData = (data) => {
        const getSensorStatus = (value, type) => {
            if (value === null)
                return "offline";
            switch (type) {
                case "temperature":
                    if (value >= 15 && value <= 35)
                        return "good";
                    if (value >= 10 && value <= 40)
                        return "warning";
                    return "error";
                case "humidity":
                    if (value >= 30 && value <= 70)
                        return "good";
                    if (value >= 20 && value <= 80)
                        return "warning";
                    return "error";
                case "pm25":
                    if (value <= 12)
                        return "good";
                    if (value <= 35)
                        return "warning";
                    return "error";
                case "pm10":
                    if (value <= 20)
                        return "good";
                    if (value <= 50)
                        return "warning";
                    return "error";
                default:
                    return "good";
            }
        };
        return [
            {
                label: "Nhiệt độ",
                value: data.temperature !== null ? `${data.temperature.toFixed(1)}` : "--",
                unit: "°C",
                status: getSensorStatus(data.temperature, "temperature"),
            },
            {
                label: "Độ ẩm",
                value: data.humidity !== null ? `${data.humidity.toFixed(1)}` : "--",
                unit: "%",
                status: getSensorStatus(data.humidity, "humidity"),
            },
            {
                label: "PM2.5",
                value: data.pm25 !== null ? `${data.pm25.toFixed(1)}` : "--",
                unit: "μg/m³",
                status: getSensorStatus(data.pm25, "pm25"),
            },
            {
                label: "PM10",
                value: data.pm10 !== null ? `${data.pm10.toFixed(1)}` : "--",
                unit: "μg/m³",
                status: getSensorStatus(data.pm10, "pm10"),
            },
        ];
    };
    // Calculate Air Quality Index based on PM2.5 and PM10
    const calculateAirQuality = (data) => {
        if (data.pm25 === null && data.pm10 === null) {
            return {
                status: "KHÔNG XÁC ĐỊNH",
                color: "#757575",
                label: "Không có dữ liệu",
            };
        }
        let pm25Level = 0;
        let pm10Level = 0;
        // WHO Air Quality Guidelines 2021 & EPA standards
        if (data.pm25 !== null) {
            if (data.pm25 <= 15)
                pm25Level = 1; // Good
            else if (data.pm25 <= 25)
                pm25Level = 2; // Moderate
            else if (data.pm25 <= 37.5)
                pm25Level = 3; // Unhealthy for sensitive
            else if (data.pm25 <= 75)
                pm25Level = 4; // Unhealthy
            else
                pm25Level = 5; // Very unhealthy
        }
        if (data.pm10 !== null) {
            if (data.pm10 <= 25)
                pm10Level = 1; // Good
            else if (data.pm10 <= 50)
                pm10Level = 2; // Moderate
            else if (data.pm10 <= 90)
                pm10Level = 3; // Unhealthy for sensitive
            else if (data.pm10 <= 180)
                pm10Level = 4; // Unhealthy
            else
                pm10Level = 5; // Very unhealthy
        }
        // Take the worst level between PM2.5 and PM10
        const maxLevel = Math.max(pm25Level, pm10Level);
        switch (maxLevel) {
            case 1:
                return {
                    status: "TỐT",
                    color: "#4CAF50",
                    label: "Chất lượng không khí tốt",
                };
            case 2:
                return {
                    status: "TRUNG BÌNH",
                    color: "#FFC107",
                    label: "Chất lượng không khí ở mức chấp nhận được",
                };
            case 3:
                return {
                    status: "KÉM",
                    color: "#FF9800",
                    label: "Có thể gây hại cho nhóm nhạy cảm",
                };
            case 4:
                return {
                    status: "XẤU",
                    color: "#F44336",
                    label: "Có thể gây hại cho sức khỏe",
                };
            case 5:
                return {
                    status: "RẤT XẤU",
                    color: "#9C27B0",
                    label: "Nguy hiểm cho sức khỏe",
                };
            default:
                return {
                    status: "TỐT",
                    color: "#4CAF50",
                    label: "Chất lượng không khí tốt",
                };
        }
    };
    // Render loading state
    if (isLoading && !sensorData) {
        return (react_1.default.createElement("div", { className: `iot-panel loading ${className}` },
            react_1.default.createElement("div", { className: "iot-header" },
                react_1.default.createElement("div", { className: "iot-title" }, "THI\u1EBET B\u1ECA \u0110O")),
            react_1.default.createElement("div", { className: "iot-loading" },
                react_1.default.createElement("div", { className: "loading-spinner" }),
                react_1.default.createElement("div", { className: "loading-text" }, "\u0110ang k\u1EBFt n\u1ED1i..."))));
    }
    // Render error state
    if (!eraIotService || (!sensorData && connectionStatus === "error")) {
        return (react_1.default.createElement("div", { className: `iot-panel error ${className}` },
            react_1.default.createElement("div", { className: "iot-header" },
                react_1.default.createElement("div", { className: "iot-title" }, "THI\u1EBET B\u1ECA \u0110O")),
            react_1.default.createElement("div", { className: "iot-error" },
                react_1.default.createElement("div", { className: "error-icon" }, "!"),
                react_1.default.createElement("div", { className: "error-text" }, !eraIotService ? "Chưa cấu hình" : "Lỗi kết nối"),
                eraIotService && (react_1.default.createElement("button", { className: "retry-button", onClick: handleRefresh }, "Th\u1EED l\u1EA1i")))));
    }
    // Render offline state
    if (!sensorData) {
        return (react_1.default.createElement("div", { className: `iot-panel offline ${className}` },
            react_1.default.createElement("div", { className: "iot-header" },
                react_1.default.createElement("div", { className: "iot-title" }, "THI\u1EBET B\u1ECA \u0110O")),
            react_1.default.createElement("div", { className: "iot-offline" },
                react_1.default.createElement("div", { className: "offline-icon" }, "X"),
                react_1.default.createElement("div", { className: "offline-text" }, "Kh\u00F4ng c\u00F3 d\u1EEF li\u1EC7u"),
                react_1.default.createElement("button", { className: "retry-button", onClick: handleRefresh }, "K\u1EBFt n\u1ED1i l\u1EA1i"))));
    }
    const sensors = formatSensorData(sensorData);
    const airQuality = calculateAirQuality(sensorData);
    return (react_1.default.createElement("div", { className: `iot-panel active ${connectionStatus} ${className}` },
        react_1.default.createElement("div", { className: "iot-header" },
            react_1.default.createElement("div", { className: "iot-title" }, "THI\u1EBET B\u1ECA \u0110O"),
            react_1.default.createElement("div", { className: `connection-indicator ${connectionStatus}` })),
        sensorData.status !== "success" && (react_1.default.createElement("div", { className: `status-banner ${sensorData.status}` }, sensorData.status === "partial"
            ? "Một số cảm biến offline"
            : "Lỗi kết nối")),
        react_1.default.createElement("div", { className: "sensors-grid" }, sensors.map((sensor, index) => (react_1.default.createElement("div", { key: index, className: "sensor-item" },
            react_1.default.createElement("div", { className: "sensor-content" },
                react_1.default.createElement("div", { className: "sensor-label" }, sensor.label),
                react_1.default.createElement("div", { className: "sensor-value-container" },
                    react_1.default.createElement("span", { className: "sensor-value" }, sensor.value),
                    react_1.default.createElement("span", { className: "sensor-unit" }, sensor.unit))))))),
        react_1.default.createElement("div", { className: "air-quality-container" },
            react_1.default.createElement("div", { className: `air-quality-indicator air-quality-${airQuality.status
                    .toLowerCase()
                    .replace(/\s/g, "-")}`, style: { backgroundColor: airQuality.color } }, airQuality.status)),
        react_1.default.createElement("div", { className: "iot-footer" },
            react_1.default.createElement("div", { className: "last-updated" }, sensorData.lastUpdated.toLocaleTimeString("vi-VN"))),
        isLoading && (react_1.default.createElement("div", { className: "refresh-overlay" },
            react_1.default.createElement("div", { className: "refresh-spinner" })))));
};
exports.default = IoTPanel;
