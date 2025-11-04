// App.tsx - Main component of the application
import React, { useState, useEffect } from "react";
import BillboardLayout from "./components/BillboardLayout";
import EraIotConfig from "./components/EraIotConfig";
import { EraIotConfig as EraIotConfigType } from "./services/eraIotService";
import LogoManifestService, { LogoItem } from "./services/logoManifestService";

/**
 * App Component - Root component of the application
 * Fixed size: 384x384 pixels corresponding to LED screen
 */
const App: React.FC = () => {
  const [configUpdateTrigger, setConfigUpdateTrigger] = useState<number>(0);
  const [logoManifestService, setLogoManifestService] =
    useState<LogoManifestService | null>(null);

  useEffect(() => {
    // Initialize Logo Manifest Service
    const initializeLogoService = async () => {
      try {
        const manifestConfig = {
          enabled: true,
          manifestUrl:
            "https://mquan-eoh.github.io/billboard-logos-cdn/manifest.json",
          pollInterval: 30, // 30 seconds
          downloadPath: "./downloads",
          maxCacheSize: 100 * 1024 * 1024, // 100MB
          retryAttempts: 3,
          retryDelay: 5000,
        };

        const service = new LogoManifestService(manifestConfig);
        const initialized = await service.initialize();

        if (initialized) {
          console.log("App: Logo Manifest Service initialized successfully");

          // Set up logo update listener
          service.onLogoUpdate((logos: LogoItem[]) => {
            console.log("App: Logo manifest updated, triggering UI refresh");
            setConfigUpdateTrigger((prev) => prev + 1);
          });

          setLogoManifestService(service);
        } else {
          console.warn("App: Logo Manifest Service failed to initialize");
        }
      } catch (error) {
        console.error("App: Error initializing Logo Manifest Service:", error);
      }
    };

    initializeLogoService();

    // Listen for logo manifest updates from web admin
    const handleLogoManifestUpdate = (event: CustomEvent) => {
      console.log("App: Received logo manifest update event:", event.detail);
      if (logoManifestService) {
        logoManifestService.forcSync();
      }
      setConfigUpdateTrigger((prev) => prev + 1);
    };

    window.addEventListener(
      "logo-manifest-updated",
      handleLogoManifestUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "logo-manifest-updated",
        handleLogoManifestUpdate as EventListener
      );
      if (logoManifestService) {
        logoManifestService.destroy();
      }
    };
  }, []);

  // Handle config updates from EraIotConfig component
  const handleConfigUpdated = (config: EraIotConfigType) => {
    console.log("App: E-Ra IoT config updated, triggering service refresh");
    // Trigger BillboardLayout to reinitialize service
    setConfigUpdateTrigger((prev) => prev + 1);
  };

  // Style for main container
  const appStyle: React.CSSProperties = {
    width: "384px",
    height: "384px",
    margin: 0,
    padding: 0,
    overflow: "hidden",
    fontFamily: "Arial, sans-serif",
  };

  return (
    <div style={appStyle}>
      <BillboardLayout
        configUpdateTrigger={configUpdateTrigger}
        logoManifestService={logoManifestService}
      />
      <EraIotConfig onConfigUpdated={handleConfigUpdated} />
    </div>
  );
};

export default App;
