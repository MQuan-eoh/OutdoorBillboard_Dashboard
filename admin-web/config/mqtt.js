/**
 * MQTT Configuration
 * Broker settings and topics
 */

export const MQTT_BROKERS = {
  // Command broker (HiveMQ - public)
  command: {
    name: "HiveMQ (Public)",
    url: "wss://broker.hivemq.com:8884/mqtt",
    enabled: true,
  },

  // E-Ra IoT broker (private)
  iot: {
    name: "E-Ra IoT",
    url: "wss://era-mqtt-broker:8883/mqtt",
    enabled: false,
  },
};

export const MQTT_TOPICS = {
  // Billboard commands
  commands: "its/billboard/commands",

  // Update messages
  updateStatus: "its/billboard/update/status",
  resetStatus: "its/billboard/reset/status",

  // Logo messages
  bannerUpdate: "its/billboard/banner/update",
  bannerDelete: "its/billboard/banner/delete",
  bannerSync: "its/billboard/banner/sync",
  manifestRefresh: "its/billboard/manifest/refresh",

  // Status
  status: "its/billboard/status",
};

export const MQTT_OPTIONS = {
  connectTimeout: 4000,
  reconnectPeriod: 1000,
  clean: true,
  qos: 1,
  clientId: `billboard_admin_${Math.random()
    .toString(16)
    .substr(2, 8)}_${Date.now()}`,
};
