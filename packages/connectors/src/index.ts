import type { ConnectionProfile, Connector, Protocol, ProtocolBinding, Signal, ValidationIssue } from "@openforge/schema";
import mqtt, { type MqttClient } from "mqtt";

export interface ProtocolAdapter {
  readonly protocol: Protocol;
  testConnection(profile: ConnectionProfile): Promise<ProtocolAdapterResult>;
  validateBinding(profile: ConnectionProfile, binding: ProtocolBinding): ValidationIssue[];
  browse?(profile: ConnectionProfile, resource?: string): Promise<ProtocolResource[]>;
  read?(profile: ConnectionProfile, binding: ProtocolBinding): Promise<unknown>;
  write?(profile: ConnectionProfile, binding: ProtocolBinding, value: unknown): Promise<void>;
  subscribe?(profile: ConnectionProfile, binding: ProtocolBinding, handler: (value: unknown) => void): Promise<void>;
  publish?(profile: ConnectionProfile, binding: ProtocolBinding, value: unknown): Promise<void>;
}

export interface ProtocolAdapterResult {
  ok: boolean;
  message: string;
}

export interface ProtocolResource {
  id: string;
  name: string;
  dataType?: string;
  writable?: boolean;
}

export class ProtocolAdapterRegistry {
  private readonly adapters = new Map<Protocol, ProtocolAdapter>();

  public register(adapter: ProtocolAdapter): void {
    this.adapters.set(adapter.protocol, adapter);
  }

  public get(protocol: Protocol): ProtocolAdapter | undefined {
    return this.adapters.get(protocol);
  }

  public validateProfile(profile: ConnectionProfile): ValidationIssue[] {
    const adapter = this.get(profile.protocol);
    if (!adapter) {
      return [connectorIssue("error", `No protocol adapter registered for ${profile.protocol}.`, profile.id, "Install or register an adapter for this protocol.")];
    }
    return [];
  }
}

export interface ConnectorRuntime {
  readonly connector: Connector;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publishSignal(signal: Signal): Promise<void>;
  subscribeSignals(handler: (signal: Signal) => void): Promise<void>;
}

export interface ConnectorFactory {
  protocol: Connector["protocol"];
  create(connector: Connector): ConnectorRuntime;
}

export class ConnectorRegistry {
  private readonly factories = new Map<Connector["protocol"], ConnectorFactory>();

  public register(factory: ConnectorFactory): void {
    this.factories.set(factory.protocol, factory);
  }

  public create(connector: Connector): ConnectorRuntime {
    const factory = this.factories.get(connector.protocol);
    if (!factory) {
      throw new Error(`No connector factory registered for protocol: ${connector.protocol}`);
    }

    return factory.create(connector);
  }
}

export interface MqttConnectorConfig {
  brokerUrl: string;
  topicPrefix?: string;
  username?: string;
  password?: string;
  dryRun?: boolean;
}

export class MqttConnectorRuntime implements ConnectorRuntime {
  public readonly connector: Connector;
  private client?: MqttClient;
  private readonly config: MqttConnectorConfig;
  private readonly handlers = new Set<(signal: Signal) => void>();
  private readonly publishedSignals: Signal[] = [];

  public constructor(connector: Connector) {
    this.connector = connector;
    this.config = {
      brokerUrl: String(connector.config.brokerUrl ?? "mqtt://localhost:1883"),
      topicPrefix: String(connector.config.topicPrefix ?? "openforge/signals"),
      username: connector.config.username ? String(connector.config.username) : undefined,
      password: connector.config.password ? String(connector.config.password) : undefined,
      dryRun: Boolean(connector.config.dryRun)
    };
  }

  public async connect(): Promise<void> {
    if (this.config.dryRun) {
      return;
    }

    this.client = await new Promise<MqttClient>((resolve, reject) => {
      const client = mqtt.connect(this.config.brokerUrl, {
        username: this.config.username,
        password: this.config.password,
        reconnectPeriod: 0,
        connectTimeout: 5000
      });
      client.once("connect", () => resolve(client));
      client.once("error", reject);
    });

    this.client.on("message", (_topic, payload) => {
      const signal = JSON.parse(payload.toString()) as Signal;
      for (const handler of this.handlers) {
        handler(signal);
      }
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    await new Promise<void>((resolve) => this.client?.end(false, {}, () => resolve()));
    this.client = undefined;
  }

  public async publishSignal(signal: Signal): Promise<void> {
    if (this.config.dryRun) {
      this.publishedSignals.push(signal);
      return;
    }

    if (!this.client) {
      throw new Error("MQTT connector is not connected.");
    }

    await new Promise<void>((resolve, reject) => {
      this.client?.publish(this.signalTopic(signal), JSON.stringify(signal), { qos: 0 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  public async subscribeSignals(handler: (signal: Signal) => void): Promise<void> {
    this.handlers.add(handler);
    if (this.config.dryRun) {
      return;
    }

    if (!this.client) {
      throw new Error("MQTT connector is not connected.");
    }

    await new Promise<void>((resolve, reject) => {
      this.client?.subscribe(`${this.config.topicPrefix}/#`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  public getPublishedSignals(): Signal[] {
    return [...this.publishedSignals];
  }

  private signalTopic(signal: Signal): string {
    const node = signal.sourceNodeId ?? "external";
    const port = signal.sourcePortId ?? "unknown";
    return `${this.config.topicPrefix}/${node}/${port}`;
  }
}

export const mqttConnectorFactory: ConnectorFactory = {
  protocol: "mqtt",
  create(connector: Connector): ConnectorRuntime {
    return new MqttConnectorRuntime(connector);
  }
};

export class MqttProtocolAdapter implements ProtocolAdapter {
  public readonly protocol = "mqtt" as const;

  public async testConnection(profile: ConnectionProfile): Promise<ProtocolAdapterResult> {
    const config = mqttConfig(profile);
    if (config.dryRun) {
      return { ok: true, message: "MQTT dry-run profile is valid." };
    }
    const runtime = new MqttConnectorRuntime(profileToConnector(profile));
    try {
      await runtime.connect();
      await runtime.disconnect();
      return { ok: true, message: "MQTT connection succeeded." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "MQTT connection failed." };
    }
  }

  public validateBinding(profile: ConnectionProfile, binding: ProtocolBinding): ValidationIssue[] {
    const issues = this.validateProfileConfig(profile);
    if (!binding.resource && binding.operation !== "browse") {
      issues.push(connectorIssue("error", "MQTT binding requires a topic resource.", profile.id, "Set a topic on the protocol node."));
    }
    if (!["publish", "subscribe", "browse"].includes(binding.operation)) {
      issues.push(connectorIssue("error", `MQTT does not support ${binding.operation} binding operations.`, profile.id));
    }
    return issues;
  }

  public async publish(profile: ConnectionProfile, binding: ProtocolBinding, value: unknown): Promise<void> {
    const runtime = new MqttConnectorRuntime(profileToConnector(profile));
    await runtime.connect();
    await runtime.publishSignal({
      id: `sig.mqtt.${Date.now()}`,
      type: binding.dataType ?? "object",
      value,
      timestamp: new Date().toISOString(),
      sourceNodeId: "protocol.mqtt",
      sourcePortId: binding.resource
    });
    await runtime.disconnect();
  }

  private validateProfileConfig(profile: ConnectionProfile): ValidationIssue[] {
    const config = mqttConfig(profile);
    const issues: ValidationIssue[] = [];
    if (!config.brokerUrl) {
      issues.push(connectorIssue("error", "MQTT profile requires brokerUrl.", profile.id, "Set brokerUrl in the connection profile."));
    }
    return issues;
  }
}

export class SimulationProtocolAdapter implements ProtocolAdapter {
  public readonly protocol = "simulation" as const;

  public async testConnection(): Promise<ProtocolAdapterResult> {
    return { ok: true, message: "Simulation adapter is always available." };
  }

  public validateBinding(): ValidationIssue[] {
    return [];
  }

  public async read(_profile: ConnectionProfile, binding: ProtocolBinding): Promise<unknown> {
    return { resource: binding.resource, simulated: true };
  }

  public async write(): Promise<void> {
    return;
  }

  public async publish(): Promise<void> {
    return;
  }
}

export function createCoreProtocolAdapterRegistry(): ProtocolAdapterRegistry {
  const registry = new ProtocolAdapterRegistry();
  registry.register(new SimulationProtocolAdapter());
  registry.register(new MqttProtocolAdapter());
  return registry;
}

export function profileToConnector(profile: ConnectionProfile): Connector {
  return {
    id: profile.id,
    metadata: profile.metadata,
    protocol: profile.protocol,
    enabled: profile.enabled,
    config: profile.config
  };
}

export function connectorToProfile(connector: Connector): ConnectionProfile {
  return {
    id: connector.id,
    metadata: connector.metadata,
    protocol: connector.protocol,
    enabled: connector.enabled,
    config: connector.config
  };
}

function mqttConfig(profile: ConnectionProfile | Connector): MqttConnectorConfig {
  return {
    brokerUrl: String(profile.config.brokerUrl ?? ""),
    topicPrefix: String(profile.config.topicPrefix ?? "openforge/signals"),
    username: profile.config.username ? String(profile.config.username) : undefined,
    password: profile.config.password ? String(profile.config.password) : undefined,
    dryRun: Boolean(profile.config.dryRun)
  };
}

function connectorIssue(severity: ValidationIssue["severity"], message: string, profileId: string, suggestedFix?: string): ValidationIssue {
  return {
    id: `connector.${profileId}.${message.toLowerCase().replaceAll(" ", "-").replaceAll(".", "")}`,
    severity,
    message,
    location: { propertyId: profileId },
    suggestedFix
  };
}
