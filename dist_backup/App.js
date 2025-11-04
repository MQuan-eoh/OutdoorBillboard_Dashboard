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
// App.tsx - Main component of the application
const react_1 = __importStar(require("react"));
const BillboardLayout_1 = __importDefault(require("./components/BillboardLayout"));
const EraIotConfig_1 = __importDefault(require("./components/EraIotConfig"));
const logoManifestService_1 = __importDefault(require("./services/logoManifestService"));
/**
 * App Component - Root component of the application
 * Fixed size: 384x384 pixels corresponding to LED screen
 */
const App = () => {
    const [configUpdateTrigger, setConfigUpdateTrigger] = (0, react_1.useState)(0);
    const [logoManifestService, setLogoManifestService] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        // Initialize Logo Manifest Service
        const initializeLogoService = async () => {
            try {
                const manifestConfig = {
                    enabled: true,
                    manifestUrl: "https://mquan-eoh.github.io/billboard-logos-cdn/manifest.json",
                    pollInterval: 30, // 30 seconds
                    downloadPath: "./downloads",
                    maxCacheSize: 100 * 1024 * 1024, // 100MB
                    retryAttempts: 3,
                    retryDelay: 5000,
                };
                const service = new logoManifestService_1.default(manifestConfig);
                const initialized = await service.initialize();
                if (initialized) {
                    console.log("App: Logo Manifest Service initialized successfully");
                    // Set up logo update listener
                    service.onLogoUpdate((logos) => {
                        console.log("App: Logo manifest updated, triggering UI refresh");
                        setConfigUpdateTrigger((prev) => prev + 1);
                    });
                    setLogoManifestService(service);
                }
                else {
                    console.warn("App: Logo Manifest Service failed to initialize");
                }
            }
            catch (error) {
                console.error("App: Error initializing Logo Manifest Service:", error);
            }
        };
        initializeLogoService();
        // Listen for logo manifest updates from web admin
        const handleLogoManifestUpdate = (event) => {
            console.log("App: Received logo manifest update event:", event.detail);
            if (logoManifestService) {
                logoManifestService.forcSync();
            }
            setConfigUpdateTrigger((prev) => prev + 1);
        };
        window.addEventListener("logo-manifest-updated", handleLogoManifestUpdate);
        return () => {
            window.removeEventListener("logo-manifest-updated", handleLogoManifestUpdate);
            if (logoManifestService) {
                logoManifestService.destroy();
            }
        };
    }, []);
    // Handle config updates from EraIotConfig component
    const handleConfigUpdated = (config) => {
        console.log("App: E-Ra IoT config updated, triggering service refresh");
        // Trigger BillboardLayout to reinitialize service
        setConfigUpdateTrigger((prev) => prev + 1);
    };
    // Style for main container
    const appStyle = {
        width: "384px",
        height: "384px",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        fontFamily: "Arial, sans-serif",
    };
    return (react_1.default.createElement("div", { style: appStyle },
        react_1.default.createElement(BillboardLayout_1.default, { configUpdateTrigger: configUpdateTrigger, logoManifestService: logoManifestService }),
        react_1.default.createElement(EraIotConfig_1.default, { onConfigUpdated: handleConfigUpdated })));
};
exports.default = App;
