import type { Connector, Signal } from "@openforge/schema";
import mqtt, { type MqttClient } from "mqtt";

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
