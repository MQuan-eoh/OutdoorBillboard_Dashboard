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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// EraIotConfig.tsx - Configuration component for E-Ra IoT Platform settings
const react_1 = __importStar(require("react"));
const eraIotService_1 = __importDefault(require("../services/eraIotService"));
require("./EraIotConfig.css");
const EraIotConfigComponent = ({ onConfigUpdated, }) => {
    const [config, setConfig] = (0, react_1.useState)({
        authToken: "Token f7d2fe19-587d-471d-a7ff-273bb32c5d6a", // Real E-Ra AUTHTOKEN format
        baseUrl: "https://backend.eoh.io",
        sensorConfigs: {
            temperature: 138997,
            humidity: 138998,
            pm25: 138999,
            pm10: 139000,
        },
        updateInterval: 5,
        timeout: 15000,
        retryAttempts: 3,
        retryDelay: 2000,
    });
    const [isVisible, setIsVisible] = (0, react_1.useState)(false);
    const [isTesting, setIsTesting] = (0, react_1.useState)(false);
    const [testResult, setTestResult] = (0, react_1.useState)(null);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    const [saveResult, setSaveResult] = (0, react_1.useState)(null);
    // Load configuration on component mount
    (0, react_1.useEffect)(() => {
        loadConfiguration();
    }, []);
    // Toggle configuration panel visibility with Ctrl+E
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (event) => {
            if (event.ctrlKey && event.key.toLowerCase() === "e") {
                event.preventDefault();
                setIsVisible((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
    const loadConfiguration = () => {
        try {
            // Try to load from localStorage first
            const storedConfig = localStorage.getItem("eraIotConfig");
            if (storedConfig) {
                const parsedConfig = JSON.parse(storedConfig);
                setConfig((prevConfig) => ({ ...prevConfig, ...parsedConfig }));
            }
            // Try to access config from electron main process
            if (typeof window !== "undefined" && window.electronAPI) {
                const electronConfig = window.electronAPI.getConfig?.();
                if (electronConfig?.eraIot) {
                    setConfig((prevConfig) => ({
                        ...prevConfig,
                        authToken: electronConfig.eraIot.authToken || prevConfig.authToken,
                        baseUrl: electronConfig.eraIot.baseUrl || prevConfig.baseUrl,
                        sensorConfigs: electronConfig.eraIot.sensorConfigs || prevConfig.sensorConfigs,
                        updateInterval: electronConfig.eraIot.updateInterval || prevConfig.updateInterval,
                        timeout: electronConfig.eraIot.timeout || prevConfig.timeout,
                        retryAttempts: electronConfig.eraIot.retryAttempts || prevConfig.retryAttempts,
                        retryDelay: electronConfig.eraIot.retryDelay || prevConfig.retryDelay,
                    }));
                }
            }
        }
        catch (error) {
            console.error("EraIotConfig: Failed to load configuration:", error);
        }
    };
    const saveConfiguration = async () => {
        setIsSaving(true);
        try {
            // Save to localStorage
            localStorage.setItem("eraIotConfig", JSON.stringify(config));
            // Save to electron config if available
            if (typeof window !== "undefined" &&
                window.electronAPI?.updateEraIotConfig) {
                await window.electronAPI.updateEraIotConfig({
                    ...config,
                    enabled: !!config.authToken,
                });
            }
            else if (typeof window !== "undefined" &&
                window.electronAPI?.saveConfig) {
                // Fallback to general config update
                await window.electronAPI.saveConfig({
                    eraIot: {
                        ...config,
                        enabled: !!config.authToken,
                    },
                });
            }
            console.log("EraIotConfig: Configuration saved successfully");
            // Show success message
            setSaveResult({
                success: true,
                message: "Cấu hình đã được lưu và áp dụng thành công!",
            });
            // Clear success message after 3 seconds
            setTimeout(() => setSaveResult(null), 3000);
            // Notify parent component immediately to trigger service reload
            if (onConfigUpdated) {
                onConfigUpdated(config);
            }
        }
        catch (error) {
            console.error("EraIotConfig: Failed to save configuration:", error);
            setSaveResult({
                success: false,
                message: `Lỗi khi lưu cấu hình: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
            // Clear error message after 5 seconds
            setTimeout(() => setSaveResult(null), 5000);
        }
        finally {
            setIsSaving(false);
        }
    };
    const testConnection = async () => {
        if (!config.authToken) {
            setTestResult({
                success: false,
                message: "Vui lòng nhập AUTHTOKEN trước khi test",
            });
            return;
        }
        setIsTesting(true);
        setTestResult(null);
        try {
            const testService = new eraIotService_1.default(config);
            const result = await testService.testConnection();
            setTestResult(result);
            testService.destroy();
        }
        catch (error) {
            setTestResult({
                success: false,
                message: `Lỗi test kết nối: ${error.message}`,
            });
        }
        finally {
            setIsTesting(false);
        }
    };
    const handleInputChange = (field, value) => {
        if (field.includes(".")) {
            // Handle nested fields like sensorConfigs.temperature
            const [parent, child] = field.split(".");
            setConfig((prev) => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: value,
                },
            }));
        }
        else {
            setConfig((prev) => ({
                ...prev,
                [field]: value,
            }));
        }
    };
    if (!isVisible) {
        return (react_1.default.createElement("div", { className: "era-config-trigger" },
            react_1.default.createElement("div", { className: "config-hint" }, "Nh\u1EA5n Ctrl+E \u0111\u1EC3 c\u1EA5u h\u00ECnh E-Ra IoT")));
    }
    return (react_1.default.createElement("div", { className: "era-config-overlay" },
        react_1.default.createElement("div", { className: "era-config-panel" },
            react_1.default.createElement("div", { className: "era-config-header" },
                react_1.default.createElement("h3", null, "C\u1EA5u h\u00ECnh E-Ra IoT Platform"),
                react_1.default.createElement("button", { className: "era-config-close", onClick: () => setIsVisible(false) }, "\u00D7")),
            react_1.default.createElement("div", { className: "era-config-content" },
                react_1.default.createElement("div", { className: "era-config-section" },
                    react_1.default.createElement("label", null, "AUTHTOKEN *"),
                    react_1.default.createElement("input", { type: "password", value: config.authToken, onChange: (e) => handleInputChange("authToken", e.target.value), placeholder: "Nh\u1EADp AUTHTOKEN t\u1EEB E-Ra Platform", className: "era-config-input" }),
                    react_1.default.createElement("small", null, "L\u1EA5y t\u1EEB Profile \u2192 AUTHTOKEN tr\u00EAn app.e-ra.io (bao g\u1ED3m \"Token \" prefix)")),
                react_1.default.createElement("div", { className: "era-config-section" },
                    react_1.default.createElement("label", null, "Base URL"),
                    react_1.default.createElement("input", { type: "url", value: config.baseUrl, onChange: (e) => handleInputChange("baseUrl", e.target.value), className: "era-config-input", title: "E-Ra IoT Platform API Base URL", placeholder: "https://backend.eoh.io" })),
                react_1.default.createElement("div", { className: "era-config-section" },
                    react_1.default.createElement("label", null, "Sensor Config IDs"),
                    react_1.default.createElement("div", { className: "era-config-grid" },
                        react_1.default.createElement("div", null,
                            react_1.default.createElement("label", null, "Nhi\u1EC7t \u0111\u1ED9"),
                            react_1.default.createElement("input", { type: "number", value: config.sensorConfigs.temperature || "", onChange: (e) => handleInputChange("sensorConfigs.temperature", parseInt(e.target.value) || null), className: "era-config-input small", title: "Config ID cho c\u1EA3m bi\u1EBFn nhi\u1EC7t \u0111\u1ED9", placeholder: "Enter config ID" })),
                        react_1.default.createElement("div", null,
                            react_1.default.createElement("label", null, "\u0110\u1ED9 \u1EA9m"),
                            react_1.default.createElement("input", { type: "number", value: config.sensorConfigs.humidity || "", onChange: (e) => handleInputChange("sensorConfigs.humidity", parseInt(e.target.value) || null), className: "era-config-input small", title: "Config ID cho c\u1EA3m bi\u1EBFn \u0111\u1ED9 \u1EA9m", placeholder: "Enter config ID" })),
                        react_1.default.createElement("div", null,
                            react_1.default.createElement("label", null, "PM2.5"),
                            react_1.default.createElement("input", { type: "number", value: config.sensorConfigs.pm25 || "", onChange: (e) => handleInputChange("sensorConfigs.pm25", parseInt(e.target.value) || null), className: "era-config-input small", title: "Config ID cho c\u1EA3m bi\u1EBFn PM2.5", placeholder: "Enter config ID" })),
                        react_1.default.createElement("div", null,
                            react_1.default.createElement("label", null, "PM10"),
                            react_1.default.createElement("input", { type: "number", value: config.sensorConfigs.pm10 || "", onChange: (e) => handleInputChange("sensorConfigs.pm10", parseInt(e.target.value) || null), className: "era-config-input small", title: "Config ID cho c\u1EA3m bi\u1EBFn PM10", placeholder: "Enter config ID" })))),
                react_1.default.createElement("div", { className: "era-config-section" },
                    react_1.default.createElement("label", null, "Update Interval (ph\u00FAt) - Legacy"),
                    react_1.default.createElement("input", { type: "number", value: config.updateInterval, onChange: (e) => handleInputChange("updateInterval", parseInt(e.target.value)), min: "1", max: "60", className: "era-config-input small", title: "Ch\u1EC9 d\u00F9ng cho compatibility - MQTT s\u1EED d\u1EE5ng real-time streaming", placeholder: "5" }),
                    react_1.default.createElement("small", null, "MQTT s\u1EED d\u1EE5ng real-time updates, kh\u00F4ng c\u1EA7n polling interval")),
                testResult && (react_1.default.createElement("div", { className: `era-config-test-result ${testResult.success ? "success" : "error"}` },
                    testResult.success ? "[SUCCESS]" : "[ERROR]",
                    " ",
                    testResult.message)),
                saveResult && (react_1.default.createElement("div", { className: `era-config-test-result ${saveResult.success ? "success" : "error"}` },
                    saveResult.success ? "[SAVED]" : "[SAVE ERROR]",
                    " ",
                    saveResult.message))),
            react_1.default.createElement("div", { className: "era-config-footer" },
                react_1.default.createElement("button", { onClick: testConnection, disabled: isTesting || !config.authToken, className: "era-config-button test" }, isTesting ? "Đang test..." : "Test kết nối"),
                react_1.default.createElement("button", { onClick: saveConfiguration, disabled: isSaving || !config.authToken, className: "era-config-button save" }, isSaving ? "Đang lưu..." : "Lưu cấu hình")),
            react_1.default.createElement("div", { className: "era-config-help" },
                react_1.default.createElement("h4", null, "H\u01B0\u1EDBng d\u1EABn c\u1EA5u h\u00ECnh E-RA MQTT:"),
                react_1.default.createElement("ol", null,
                    react_1.default.createElement("li", null,
                        "\u0110\u0103ng nh\u1EADp v\u00E0o",
                        " ",
                        react_1.default.createElement("a", { href: "https://app.e-ra.io", target: "_blank", rel: "noopener noreferrer" }, "app.e-ra.io")),
                    react_1.default.createElement("li", null, "V\u00E0o Profile v\u00E0 copy AUTHTOKEN (bao g\u1ED3m \"Token \" prefix)"),
                    react_1.default.createElement("li", null, "Paste v\u00E0o tr\u01B0\u1EDDng AUTHTOKEN \u1EDF tr\u00EAn"),
                    react_1.default.createElement("li", null, "Click \"Test k\u1EBFt n\u1ED1i\" \u0111\u1EC3 ki\u1EC3m tra MQTT connection"),
                    react_1.default.createElement("li", null, "Click \"L\u01B0u c\u1EA5u h\u00ECnh\" \u0111\u1EC3 \u00E1p d\u1EE5ng")),
                react_1.default.createElement("p", null,
                    react_1.default.createElement("strong", null, "MQTT Info:"),
                    " H\u1EC7 th\u1ED1ng s\u1EED d\u1EE5ng mqtt1.eoh.io:1883 v\u1EDBi real-time streaming"),
                react_1.default.createElement("p", null, "Sensor Config IDs \u0111\u00E3 \u0111\u01B0\u1EE3c c\u00E0i \u0111\u1EB7t s\u1EB5n cho Device billboard 1")))));
};
exports.default = EraIotConfigComponent;
