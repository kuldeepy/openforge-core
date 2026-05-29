export type OpenForgeId = string;

export type SignalType = "digital" | "analog" | "string" | "object";
export type EdgeKind = "data" | "control" | "event" | "error";
export type ExecutionMode = "validate" | "simulate" | "live";
export type ValidationSeverity = "info" | "warning" | "error";
export type Protocol = "simulation" | "mqtt" | "rest" | "websocket" | "opcua" | "modbus-tcp" | "serial" | "custom";

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
  connectionProfiles?: ConnectionProfile[];
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
  bindings?: ProtocolBinding[];
  disabled?: boolean;
  ports: Port[];
}

export type NodeInstance = WorkflowNode;

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
  kind?: EdgeKind;
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
  icon?: string;
  runtimeHandler?: OpenForgeId;
  paletteGroup?: string;
}

export interface NodeDefinition extends Template {
  propertySchema?: PropertySchema[];
  validationRules?: string[];
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
  type: PropertyType;
  defaultValue?: unknown;
  required?: boolean;
  options?: string[];
  description?: string;
  bindingRole?: "profile" | "tag" | "topic" | "address" | "expression" | "script";
}

export type PropertyType = "boolean" | "number" | "string" | "enum" | "object";
export type PropertySchema = TemplateParameter;

export interface RuntimeState {
  workflowId: OpenForgeId;
  status: "idle" | "running" | "paused" | "completed" | "faulted";
  tick: number;
  nodeStates: Record<OpenForgeId, Record<string, unknown>>;
  signals: Record<OpenForgeId, Signal>;
  nodeRunStates?: Record<OpenForgeId, NodeRunState>;
}

export interface RuntimeEvent {
  id: OpenForgeId;
  workflowId: OpenForgeId;
  tick: number;
  timestamp: string;
  type: "workflow-started" | "node-executed" | "signal-emitted" | "state-changed" | "alarm-raised" | "workflow-stopped" | "log" | "error";
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
  protocol: Protocol;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ConnectionProfile {
  id: OpenForgeId;
  metadata: Metadata;
  protocol: Protocol;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ProtocolBinding {
  profileId: OpenForgeId;
  resource: string;
  operation: "read" | "write" | "publish" | "subscribe" | "call" | "browse";
  dataType?: SignalType;
  required?: boolean;
}

export interface ValidationIssue {
  id: OpenForgeId;
  severity: ValidationSeverity;
  message: string;
  location?: {
    workflowId?: OpenForgeId;
    nodeId?: OpenForgeId;
    edgeId?: OpenForgeId;
    propertyId?: OpenForgeId;
  };
  suggestedFix?: string;
}

export interface RuntimeLogEntry {
  id: OpenForgeId;
  runId: OpenForgeId;
  workflowId: OpenForgeId;
  timestamp: string;
  tick: number;
  level: "debug" | "info" | "warning" | "error";
  message: string;
  nodeId?: OpenForgeId;
  payload?: Record<string, unknown>;
}

export interface NodeRunState {
  status: "idle" | "pending" | "running" | "success" | "failed" | "skipped" | "disabled";
  startedAt?: string;
  completedAt?: string;
  lastEventId?: OpenForgeId;
  error?: string;
  outputs?: Record<string, unknown>;
}

export interface ExecutionRun {
  id: OpenForgeId;
  projectId?: OpenForgeId;
  workflowId: OpenForgeId;
  scenarioId?: OpenForgeId;
  mode: ExecutionMode;
  status: "created" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  state: RuntimeState;
  events: RuntimeEvent[];
  logs: RuntimeLogEntry[];
  validationIssues: ValidationIssue[];
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
