// EraIotConfig.tsx - Configuration component for E-Ra IoT Platform settings
import React, { useState, useEffect } from "react";
import EraIotService, { EraIotConfig } from "../services/eraIotService";
import "./EraIotConfig.css";

interface EraIotConfigProps {
  onConfigUpdated?: (config: EraIotConfig) => void;
}

const EraIotConfigComponent: React.FC<EraIotConfigProps> = ({
  onConfigUpdated,
}) => {
  const [config, setConfig] = useState<EraIotConfig>({
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

  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Load configuration on component mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  // Toggle configuration panel visibility with Ctrl+E
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const electronConfig = (window as any).electronAPI.getConfig?.();
        if (electronConfig?.eraIot) {
          setConfig((prevConfig) => ({
            ...prevConfig,
            authToken: electronConfig.eraIot.authToken || prevConfig.authToken,
            baseUrl: electronConfig.eraIot.baseUrl || prevConfig.baseUrl,
            sensorConfigs:
              electronConfig.eraIot.sensorConfigs || prevConfig.sensorConfigs,
            updateInterval:
              electronConfig.eraIot.updateInterval || prevConfig.updateInterval,
            timeout: electronConfig.eraIot.timeout || prevConfig.timeout,
            retryAttempts:
              electronConfig.eraIot.retryAttempts || prevConfig.retryAttempts,
            retryDelay:
              electronConfig.eraIot.retryDelay || prevConfig.retryDelay,
          }));
        }
      }
    } catch (error) {
      console.error("EraIotConfig: Failed to load configuration:", error);
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem("eraIotConfig", JSON.stringify(config));

      // Save to electron config if available
      if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.updateEraIotConfig
      ) {
        await (window as any).electronAPI.updateEraIotConfig({
          ...config,
          enabled: !!config.authToken,
        });
      } else if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.saveConfig
      ) {
        // Fallback to general config update
        await (window as any).electronAPI.saveConfig({
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
    } catch (error) {
      console.error("EraIotConfig: Failed to save configuration:", error);
      setSaveResult({
        success: false,
        message: `Lỗi khi lưu cấu hình: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });

      // Clear error message after 5 seconds
      setTimeout(() => setSaveResult(null), 5000);
    } finally {
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
      const testService = new EraIotService(config);
      const result = await testService.testConnection();
      setTestResult(result);
      testService.destroy();
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Lỗi test kết nối: ${error.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleInputChange = (field: string, value: string | number | null) => {
    if (field.includes(".")) {
      // Handle nested fields like sensorConfigs.temperature
      const [parent, child] = field.split(".");
      setConfig((prev) => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value,
        },
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  if (!isVisible) {
    return (
      <div className="era-config-trigger">
        <div className="config-hint">Nhấn Ctrl+E để cấu hình E-Ra IoT</div>
      </div>
    );
  }

  return (
    <div className="era-config-overlay">
      <div className="era-config-panel">
        <div className="era-config-header">
          <h3>Cấu hình E-Ra IoT Platform</h3>
          <button
            className="era-config-close"
            onClick={() => setIsVisible(false)}
          >
            ×
          </button>
        </div>

        <div className="era-config-content">
          <div className="era-config-section">
            <label>AUTHTOKEN *</label>
            <input
              type="password"
              value={config.authToken}
              onChange={(e) => handleInputChange("authToken", e.target.value)}
              placeholder="Nhập AUTHTOKEN từ E-Ra Platform"
              className="era-config-input"
            />
            <small>
              Lấy từ Profile → AUTHTOKEN trên app.e-ra.io (bao gồm "Token "
              prefix)
            </small>
          </div>

          <div className="era-config-section">
            <label>Base URL</label>
            <input
              type="url"
              value={config.baseUrl}
              onChange={(e) => handleInputChange("baseUrl", e.target.value)}
              className="era-config-input"
              title="E-Ra IoT Platform API Base URL"
              placeholder="https://backend.eoh.io"
            />
          </div>

          <div className="era-config-section">
            <label>Sensor Config IDs</label>
            <div className="era-config-grid">
              <div>
                <label>Nhiệt độ</label>
                <input
                  type="number"
                  value={config.sensorConfigs.temperature || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "sensorConfigs.temperature",
                      parseInt(e.target.value) || null
                    )
                  }
                  className="era-config-input small"
                  title="Config ID cho cảm biến nhiệt độ"
                  placeholder="Enter config ID"
                />
              </div>
              <div>
                <label>Độ ẩm</label>
                <input
                  type="number"
                  value={config.sensorConfigs.humidity || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "sensorConfigs.humidity",
                      parseInt(e.target.value) || null
                    )
                  }
                  className="era-config-input small"
                  title="Config ID cho cảm biến độ ẩm"
                  placeholder="Enter config ID"
                />
              </div>
              <div>
                <label>PM2.5</label>
                <input
                  type="number"
                  value={config.sensorConfigs.pm25 || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "sensorConfigs.pm25",
                      parseInt(e.target.value) || null
                    )
                  }
                  className="era-config-input small"
                  title="Config ID cho cảm biến PM2.5"
                  placeholder="Enter config ID"
                />
              </div>
              <div>
                <label>PM10</label>
                <input
                  type="number"
                  value={config.sensorConfigs.pm10 || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "sensorConfigs.pm10",
                      parseInt(e.target.value) || null
                    )
                  }
                  className="era-config-input small"
                  title="Config ID cho cảm biến PM10"
                  placeholder="Enter config ID"
                />
              </div>
            </div>
          </div>

          <div className="era-config-section">
            <label>Update Interval (phút) - Legacy</label>
            <input
              type="number"
              value={config.updateInterval}
              onChange={(e) =>
                handleInputChange("updateInterval", parseInt(e.target.value))
              }
              min="1"
              max="60"
              className="era-config-input small"
              title="Chỉ dùng cho compatibility - MQTT sử dụng real-time streaming"
              placeholder="5"
            />
            <small>
              MQTT sử dụng real-time updates, không cần polling interval
            </small>
          </div>

          {testResult && (
            <div
              className={`era-config-test-result ${
                testResult.success ? "success" : "error"
              }`}
            >
              {testResult.success ? "[SUCCESS]" : "[ERROR]"}{" "}
              {testResult.message}
            </div>
          )}

          {saveResult && (
            <div
              className={`era-config-test-result ${
                saveResult.success ? "success" : "error"
              }`}
            >
              {saveResult.success ? "[SAVED]" : "[SAVE ERROR]"}{" "}
              {saveResult.message}
            </div>
          )}
        </div>

        <div className="era-config-footer">
          <button
            onClick={testConnection}
            disabled={isTesting || !config.authToken}
            className="era-config-button test"
          >
            {isTesting ? "Đang test..." : "Test kết nối"}
          </button>

          <button
            onClick={saveConfiguration}
            disabled={isSaving || !config.authToken}
            className="era-config-button save"
          >
            {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>

        <div className="era-config-help">
          <h4>Hướng dẫn cấu hình E-RA MQTT:</h4>
          <ol>
            <li>
              Đăng nhập vào{" "}
              <a
                href="https://app.e-ra.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                app.e-ra.io
              </a>
            </li>
            <li>Vào Profile và copy AUTHTOKEN (bao gồm "Token " prefix)</li>
            <li>Paste vào trường AUTHTOKEN ở trên</li>
            <li>Click "Test kết nối" để kiểm tra MQTT connection</li>
            <li>Click "Lưu cấu hình" để áp dụng</li>
          </ol>
          <p>
            <strong>MQTT Info:</strong> Hệ thống sử dụng mqtt1.eoh.io:1883 với
            real-time streaming
          </p>
          <p>Sensor Config IDs đã được cài đặt sẵn cho Device billboard 1</p>
        </div>
      </div>
    </div>
  );
};

export default EraIotConfigComponent;
