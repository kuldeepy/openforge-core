import { MqttConnectorRuntime } from "../../packages/connectors/dist/index.js";

const connector = {
  id: "connector.mqtt.local",
  metadata: { name: "Local MQTT Dry Run" },
  protocol: "mqtt",
  enabled: true,
  config: {
    brokerUrl: "mqtt://localhost:1883",
    topicPrefix: "openforge/conveyor-demo",
    dryRun: process.argv.includes("--dry-run")
  }
};

const runtime = new MqttConnectorRuntime(connector);
await runtime.connect();
await runtime.subscribeSignals((signal) => {
  console.log(`received ${signal.sourceNodeId}.${signal.sourcePortId} = ${signal.value}`);
});
await runtime.publishSignal({
  id: "sig.mqtt.start",
  type: "digital",
  value: true,
  timestamp: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  sourceNodeId: "node.start-button",
  sourcePortId: "out"
});
await runtime.disconnect();

console.log(`published ${runtime.getPublishedSignals().length} signal(s)`);
