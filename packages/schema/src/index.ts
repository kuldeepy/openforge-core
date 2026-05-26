export type OpenForgeId = string;

export type SignalType = "digital" | "analog" | "string" | "object";

export interface Metadata {
  name: string;
  description?: string;
  tags?: string[];
  version?: string;
}

export interface Project {
  id: OpenForgeId;
  metadata: Metadata;
  workflows: Workflow[];
  templates?: Template[];
  devices?: Device[];
  connectors?: Connector[];
  simulationScenarios?: SimulationScenario[];
}

export interface Workflow {
  id: OpenForgeId;
  metadata: Metadata;
  nodes: WorkflowNode[];
  edges: Edge[];
  groups?: WorkflowGroup[];
}

export interface WorkflowGroup {
  id: OpenForgeId;
  metadata: Metadata;
  nodeIds: OpenForgeId[];
}

export interface WorkflowNode {
  id: OpenForgeId;
  templateId: OpenForgeId;
  metadata: Metadata;
  position?: Point;
  parameters?: Record<string, unknown>;
  ports: Port[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Edge {
  id: OpenForgeId;
  sourceNodeId: OpenForgeId;
  sourcePortId: OpenForgeId;
  targetNodeId: OpenForgeId;
  targetPortId: OpenForgeId;
  signalType: SignalType;
}

export interface Port {
  id: OpenForgeId;
  name: string;
  direction: "input" | "output";
  signalType: SignalType;
  required?: boolean;
}

export interface Signal {
  id: OpenForgeId;
  type: SignalType;
  value: unknown;
  timestamp: string;
  sourceNodeId?: OpenForgeId;
  sourcePortId?: OpenForgeId;
}

export interface Template {
  id: OpenForgeId;
  metadata: Metadata & { version: string };
  category: TemplateCategory;
  ports: Port[];
  parameters?: TemplateParameter[];
  composition?: Workflow;
}

export type TemplateCategory =
  | "io"
  | "actuator"
  | "sensor"
  | "logic"
  | "safety"
  | "timing"
  | "alarm"
  | "state-machine";

export interface TemplateParameter {
  id: OpenForgeId;
  name: string;
  type: "boolean" | "number" | "string" | "enum" | "object";
  defaultValue?: unknown;
  required?: boolean;
  options?: string[];
}

export interface RuntimeState {
  workflowId: OpenForgeId;
  status: "idle" | "running" | "paused" | "completed" | "faulted";
  tick: number;
  nodeStates: Record<OpenForgeId, Record<string, unknown>>;
  signals: Record<OpenForgeId, Signal>;
}

export interface RuntimeEvent {
  id: OpenForgeId;
  workflowId: OpenForgeId;
  tick: number;
  timestamp: string;
  type: "workflow-started" | "node-executed" | "signal-emitted" | "state-changed" | "alarm-raised" | "workflow-stopped" | "error";
  nodeId?: OpenForgeId;
  payload?: Record<string, unknown>;
}

export interface Device {
  id: OpenForgeId;
  metadata: Metadata;
  vendor?: string;
  model?: string;
  protocol?: string;
  address?: string;
}

export interface Connector {
  id: OpenForgeId;
  metadata: Metadata;
  protocol: "mqtt" | "rest" | "websocket" | "opcua" | "modbus-tcp" | "custom";
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface Alarm {
  id: OpenForgeId;
  severity: "info" | "warning" | "critical";
  message: string;
  active: boolean;
  sourceNodeId?: OpenForgeId;
  timestamp: string;
}

export interface SimulationScenario {
  id: OpenForgeId;
  metadata: Metadata;
  workflowId: OpenForgeId;
  initialSignals?: Signal[];
  scheduledSignals?: ScheduledSignal[];
  maxTicks?: number;
}

export interface ScheduledSignal {
  tick: number;
  signal: Signal;
}
