import type {
  Edge,
  ExecutionRun,
  NodeDefinition,
  NodeRunState,
  RuntimeEvent,
  RuntimeLogEntry,
  RuntimeState,
  Signal,
  SimulationScenario,
  ValidationIssue,
  Workflow,
  WorkflowNode
} from "@openforge/schema";

export interface RuntimeExecutionResult {
  state: RuntimeState;
  events: RuntimeEvent[];
  logs: RuntimeLogEntry[];
}

interface InternalNodeExecution {
  outputs: Signal[];
  events: RuntimeEvent[];
  logs: RuntimeLogEntry[];
}

export interface RuntimeOptions {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  nodeRegistry?: NodeRuntimeRegistry;
  definitions?: NodeDefinition[];
}

export interface NodeExecutionContext {
  workflow: Workflow;
  node: WorkflowNode;
  state: Record<string, unknown>;
  signal: Signal;
  tick: number;
  timestamp: string;
  emitSignal(sourcePortId: string, type: Signal["type"], value: unknown): Signal;
  log(level: RuntimeLogEntry["level"], message: string, payload?: Record<string, unknown>): void;
}

export interface NodeExecutionResult {
  outputs: Signal[];
  events?: RuntimeEvent[];
}

export type NodeRuntimeHandler = (context: NodeExecutionContext) => NodeExecutionResult;

export class NodeRuntimeRegistry {
  private readonly handlers = new Map<string, NodeRuntimeHandler>();

  public register(handlerId: string, handler: NodeRuntimeHandler): void {
    this.handlers.set(handlerId, handler);
  }

  public get(handlerId: string): NodeRuntimeHandler | undefined {
    return this.handlers.get(handlerId);
  }
}

export function createCoreNodeRuntimeRegistry(): NodeRuntimeRegistry {
  const registry = new NodeRuntimeRegistry();
  registry.register("handler.pass-through-source", () => ({ outputs: [] }));
  registry.register("handler.sink", ({ state, signal, log }) => {
    state.value = signal.value;
    log("info", `Output received ${String(signal.value)}.`);
    return { outputs: [] };
  });
  registry.register("handler.conveyor", ({ state, signal, emitSignal }) => {
    if (signal.sourcePortId === "start" && signal.value === true) {
      state.running = true;
    } else if (signal.sourcePortId === "stop" && signal.value === true) {
      state.running = false;
    } else {
      return { outputs: [] };
    }
    return { outputs: [emitSignal("running", "digital", Boolean(state.running))] };
  });
  registry.register("handler.motor", ({ state, signal }) => {
    if (signal.sourcePortId === "run") {
      state.running = Boolean(signal.value);
    }
    return { outputs: [] };
  });
  registry.register("handler.alarm", ({ state, signal, workflow, node, tick, timestamp }) => {
    if (signal.sourcePortId !== "trigger") {
      return { outputs: [] };
    }
    state.active = Boolean(signal.value);
    const events = state.active
      ? [event(`evt-alarm-${node.id}-${tick}`, workflow.id, tick, timestamp, "alarm-raised", node.id, { message: node.metadata.name, severity: "warning" })]
      : [];
    return { outputs: [], events };
  });
  registry.register("handler.timer", ({ state, signal, tick }) => {
    if (signal.sourcePortId === "start") {
      const durationMs = Number(signal.value === false ? 0 : state.durationMs ?? 1000);
      state.active = Boolean(signal.value);
      state.done = false;
      state.dueTick = tick + Math.max(1, Math.ceil(durationMs / 1000));
    }
    return { outputs: [] };
  });
  registry.register("handler.counter", ({ state, node, signal, emitSignal }) => {
    if (signal.sourcePortId !== "count" || signal.value !== true) {
      return { outputs: [] };
    }
    const count = Number(state.count ?? 0) + 1;
    state.count = count;
    const preset = Number(node.parameters?.preset ?? 1);
    return { outputs: [emitSignal("done", "digital", count >= preset)] };
  });
  registry.register("handler.condition", ({ signal, emitSignal }) => ({ outputs: [emitSignal("out", "digital", Boolean(signal.value))] }));
  registry.register("handler.state-machine", ({ state, signal, emitSignal }) => {
    if (signal.sourcePortId !== "transition") {
      return { outputs: [] };
    }
    state.current = String(signal.value);
    return { outputs: [emitSignal("state", "string", state.current)] };
  });
  registry.register("handler.protocol-publish", ({ node, signal, log }) => {
    log("info", `Prepared publish to ${String(node.parameters?.topic ?? "unconfigured topic")}.`, { signal });
    return { outputs: [] };
  });
  registry.register("handler.log", ({ node, signal, log }) => {
    log("info", String(node.parameters?.message ?? "Trace marker"), { signal });
    return { outputs: [] };
  });
  return registry;
}

export class WorkflowRuntime {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly nodeRegistry: NodeRuntimeRegistry;
  private readonly definitions = new Map<string, NodeDefinition>();

  public constructor(options: RuntimeOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? ((prefix) => `${prefix}-${crypto.randomUUID()}`);
    this.nodeRegistry = options.nodeRegistry ?? createCoreNodeRuntimeRegistry();
    for (const definition of options.definitions ?? []) {
      this.definitions.set(definition.id, definition);
    }
  }

  public createInitialState(workflow: Workflow): RuntimeState {
    return {
      workflowId: workflow.id,
      status: "idle",
      tick: 0,
      nodeStates: Object.fromEntries(workflow.nodes.map((node) => [node.id, { ...(node.parameters ?? {}) }])),
      signals: {},
      nodeRunStates: Object.fromEntries(workflow.nodes.map((node) => [node.id, { status: node.disabled ? "disabled" : "idle" } satisfies NodeRunState]))
    };
  }

  public tick(workflow: Workflow, state: RuntimeState, inputSignals: Signal[] = []): RuntimeExecutionResult {
    const tick = state.tick + 1;
    const timestamp = this.now().toISOString();
    const signals = { ...state.signals };
    const nodeStates = structuredClone(state.nodeStates);
    const nodeRunStates = { ...(state.nodeRunStates ?? {}) };
    const events: RuntimeEvent[] = [];
    const logs: RuntimeLogEntry[] = [];
    const queue = [...this.timerDueSignals(workflow, nodeStates, tick, timestamp), ...inputSignals];

    while (queue.length > 0) {
      const signal = queue.shift();
      if (!signal) continue;
      signals[signal.id] = signal;
      events.push(this.event(workflow.id, tick, timestamp, "signal-emitted", signal.sourceNodeId, { signal }));

      const execution = this.executeNode(workflow, nodeStates, nodeRunStates, logs, signal, tick, timestamp);
      events.push(...execution.events);
      logs.push(...execution.logs);
      for (const output of execution.outputs) {
        signals[output.id] = output;
        events.push(this.event(workflow.id, tick, timestamp, "node-executed", output.sourceNodeId, { signal: output }));
        queue.push(output);
      }

      for (const edge of this.outgoingEdges(workflow.edges, signal)) {
        if ((edge.kind ?? "data") === "error") continue;
        const propagated = this.propagateSignal(edge, signal, timestamp);
        signals[propagated.id] = propagated;
        queue.push(propagated);
      }
    }

    return {
      state: { ...state, status: "running", tick, nodeStates, signals, nodeRunStates },
      events,
      logs
    };
  }

  private outgoingEdges(edges: Edge[], signal: Signal): Edge[] {
    if (!signal.sourceNodeId || !signal.sourcePortId) return [];
    return edges.filter((edge) => edge.sourceNodeId === signal.sourceNodeId && edge.sourcePortId === signal.sourcePortId);
  }

  private propagateSignal(edge: Edge, signal: Signal, timestamp: string): Signal {
    return {
      ...signal,
      id: this.idFactory("sig"),
      timestamp,
      sourceNodeId: edge.targetNodeId,
      sourcePortId: edge.targetPortId
    };
  }

  private timerDueSignals(workflow: Workflow, nodeStates: RuntimeState["nodeStates"], tick: number, timestamp: string): Signal[] {
    return workflow.nodes
      .filter((node) => node.templateId === "template.timer")
      .flatMap((node) => {
        const state = nodeStates[node.id];
        if (!state?.active || Number(state.dueTick) > tick) return [];
        state.active = false;
        state.done = true;
        return [{ id: this.idFactory("sig"), type: "digital" as const, value: true, timestamp, sourceNodeId: node.id, sourcePortId: "done" }];
      });
  }

  private executeNode(
    workflow: Workflow,
    nodeStates: RuntimeState["nodeStates"],
    nodeRunStates: Record<string, NodeRunState>,
    logs: RuntimeLogEntry[],
    signal: Signal,
    tick: number,
    timestamp: string
  ): InternalNodeExecution {
    const node = workflow.nodes.find((item) => item.id === signal.sourceNodeId);
    if (!node || node.disabled) return { outputs: [], events: [], logs: [] };

    const state = nodeStates[node.id] ?? {};
    const before = JSON.stringify(state);
    nodeStates[node.id] = state;
    nodeRunStates[node.id] = { status: "running", startedAt: timestamp };
    const localLogs: RuntimeLogEntry[] = [];
    const definition = this.definitions.get(node.templateId);
    const handlerId = definition?.runtimeHandler ?? legacyRuntimeHandler(node.templateId);
    const handler = this.nodeRegistry.get(handlerId);

    if (!handler) {
      const message = `No runtime handler registered for ${node.templateId}.`;
      nodeRunStates[node.id] = { status: "failed", completedAt: timestamp, error: message };
      return { outputs: [], events: [this.event(workflow.id, tick, timestamp, "error", node.id, { message })], logs: [this.log(workflow.id, "error", message, tick, timestamp, node.id)] };
    }

    const result = handler({
      workflow,
      node,
      state,
      signal,
      tick,
      timestamp,
      emitSignal: (sourcePortId, type, value) => ({ id: this.idFactory("sig"), type, value, timestamp, sourceNodeId: node.id, sourcePortId }),
      log: (level, message, payload) => localLogs.push(this.log(workflow.id, level, message, tick, timestamp, node.id, payload))
    });

    const events = [...(result.events ?? [])];
    if (before !== JSON.stringify(state)) {
      events.push(this.event(workflow.id, tick, timestamp, "state-changed", node.id, { state: { ...state } }));
    }
    if (localLogs.length > 0) {
      events.push(...localLogs.map((entry) => this.event(workflow.id, tick, timestamp, "log", node.id, { log: entry })));
    }
    nodeRunStates[node.id] = {
      status: "success",
      completedAt: timestamp,
      outputs: Object.fromEntries(result.outputs.map((output) => [output.sourcePortId ?? "out", output.value]))
    };
    return { outputs: result.outputs, events, logs: localLogs };
  }

  private event(workflowId: string, tick: number, timestamp: string, type: RuntimeEvent["type"], nodeId?: string, payload?: Record<string, unknown>): RuntimeEvent {
    return event(this.idFactory("evt"), workflowId, tick, timestamp, type, nodeId, payload);
  }

  private log(workflowId: string, level: RuntimeLogEntry["level"], message: string, tick: number, timestamp: string, nodeId?: string, payload?: Record<string, unknown>): RuntimeLogEntry {
    return { id: this.idFactory("log"), runId: "active-run", workflowId, timestamp, tick, level, message, nodeId, payload };
  }
}

export interface SimulationRunnerOptions extends RuntimeOptions {
  projectId?: string;
}

export class SimulationRunner {
  private readonly runtime: WorkflowRuntime;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly projectId?: string;

  public constructor(options: SimulationRunnerOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? ((prefix) => `${prefix}-${crypto.randomUUID()}`);
    this.runtime = new WorkflowRuntime(options);
    this.projectId = options.projectId;
  }

  public run(workflow: Workflow, scenario?: SimulationScenario, validationIssues: ValidationIssue[] = []): ExecutionRun {
    const startedAt = this.now().toISOString();
    const runId = this.idFactory("run");
    let state = this.runtime.createInitialState(workflow);
    const events: RuntimeEvent[] = [event(this.idFactory("evt"), workflow.id, 0, startedAt, "workflow-started")];
    const logs: RuntimeLogEntry[] = [];
    const scheduledSignals = scenario?.scheduledSignals ?? [];

    for (let tick = 1; tick <= (scenario?.maxTicks ?? 10); tick += 1) {
      const inputs = scheduledSignals.filter((entry) => entry.tick === tick).map((entry) => entry.signal);
      const result = this.runtime.tick(workflow, state, inputs);
      state = result.state;
      events.push(...result.events);
      logs.push(...result.logs.map((entry) => ({ ...entry, runId })));
    }

    const completedAt = this.now().toISOString();
    events.push(event(this.idFactory("evt"), workflow.id, state.tick, completedAt, "workflow-stopped"));
    return {
      id: runId,
      projectId: this.projectId,
      workflowId: workflow.id,
      scenarioId: scenario?.id,
      mode: "simulate",
      status: validationIssues.some((issue) => issue.severity === "error") ? "failed" : "completed",
      startedAt,
      completedAt,
      state: { ...state, status: "completed" },
      events,
      logs,
      validationIssues
    };
  }
}

export function validateWorkflow(workflow: Workflow, definitions: NodeDefinition[] = [], profileIds: string[] = []): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
  const profiles = new Set(profileIds);

  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push(issue("error", `Duplicate node id ${node.id}.`, workflow.id, node.id, undefined, "Use unique node IDs."));
    }
    nodeIds.add(node.id);
    const definition = definitionMap.get(node.templateId);
    if (definitions.length > 0 && !definition) {
      issues.push(issue("error", `${node.metadata.name} has unknown template ${node.templateId}.`, workflow.id, node.id));
    }
    for (const property of definition?.propertySchema ?? definition?.parameters ?? []) {
      if (property.required && isEmpty(node.parameters?.[property.id])) {
        issues.push(issue("error", `${node.metadata.name} is missing required property ${property.name}.`, workflow.id, node.id, undefined, `Set ${property.name} in the inspector.`));
      }
      if (property.bindingRole === "profile" && node.parameters?.[property.id] && profiles.size > 0 && !profiles.has(String(node.parameters[property.id]))) {
        issues.push(issue("error", `${node.metadata.name} references an unknown connection profile.`, workflow.id, node.id, undefined, "Select an existing connection profile."));
      }
    }
  }

  for (const edge of workflow.edges) {
    const sourceNode = workflow.nodes.find((node) => node.id === edge.sourceNodeId);
    const targetNode = workflow.nodes.find((node) => node.id === edge.targetNodeId);
    if (!sourceNode) issues.push(issue("error", `${edge.id} has missing source node.`, workflow.id, undefined, edge.id));
    if (!targetNode) issues.push(issue("error", `${edge.id} has missing target node.`, workflow.id, undefined, edge.id));
    const sourcePort = sourceNode?.ports.find((port) => port.id === edge.sourcePortId);
    const targetPort = targetNode?.ports.find((port) => port.id === edge.targetPortId);
    if (sourceNode && !sourcePort) issues.push(issue("error", `${edge.id} has missing source port ${edge.sourcePortId}.`, workflow.id, sourceNode.id, edge.id));
    if (targetNode && !targetPort) issues.push(issue("error", `${edge.id} has missing target port ${edge.targetPortId}.`, workflow.id, targetNode.id, edge.id));
    if (sourcePort && targetPort && sourcePort.signalType !== targetPort.signalType) {
      issues.push(issue("error", `${edge.id} connects ${sourcePort.signalType} to ${targetPort.signalType}.`, workflow.id, undefined, edge.id, "Connect compatible port types."));
    }
    if (edge.kind && !["data", "control", "event", "error"].includes(edge.kind)) {
      issues.push(issue("error", `${edge.id} has invalid edge kind ${edge.kind}.`, workflow.id, undefined, edge.id));
    }
  }

  for (const node of workflow.nodes) {
    for (const port of node.ports.filter((item) => item.direction === "input" && item.required)) {
      if (!workflow.edges.some((edge) => edge.targetNodeId === node.id && edge.targetPortId === port.id)) {
        issues.push(issue("warning", `${node.metadata.name}.${port.name} is required but not connected.`, workflow.id, node.id, undefined, "Connect a source signal or mark it optional."));
      }
    }
  }

  return issues.length ? issues : [issue("info", "Workflow passes validation.", workflow.id)];
}

function legacyRuntimeHandler(templateId: string): string {
  return ({
    "template.conveyor": "handler.conveyor",
    "template.motor": "handler.motor",
    "template.alarm": "handler.alarm",
    "template.timer": "handler.timer",
    "template.counter": "handler.counter",
    "template.condition": "handler.condition",
    "template.state-machine": "handler.state-machine",
    "template.digital-output": "handler.sink",
    "template.analog-output": "handler.sink",
    "template.mqtt-publish": "handler.protocol-publish",
    "template.log": "handler.log"
  }[templateId] ?? "handler.pass-through-source");
}

function event(id: string, workflowId: string, tick: number, timestamp: string, type: RuntimeEvent["type"], nodeId?: string, payload?: Record<string, unknown>): RuntimeEvent {
  return { id, workflowId, tick, timestamp, type, nodeId, payload };
}

function issue(severity: ValidationIssue["severity"], message: string, workflowId?: string, nodeId?: string, edgeId?: string, suggestedFix?: string): ValidationIssue {
  return {
    id: `issue.${severity}.${Math.abs(hashCode(`${workflowId ?? ""}${nodeId ?? ""}${edgeId ?? ""}${message}`))}`,
    severity,
    message,
    location: { workflowId, nodeId, edgeId },
    suggestedFix
  };
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function hashCode(value: string): number {
  return [...value].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}
