import type { Edge, RuntimeEvent, RuntimeState, Signal, Workflow } from "@openforge/schema";

export interface RuntimeExecutionResult {
  state: RuntimeState;
  events: RuntimeEvent[];
}

export interface RuntimeOptions {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
}

export class WorkflowRuntime {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;

  public constructor(options: RuntimeOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? ((prefix) => `${prefix}-${crypto.randomUUID()}`);
  }

  public createInitialState(workflow: Workflow): RuntimeState {
    return {
      workflowId: workflow.id,
      status: "idle",
      tick: 0,
      nodeStates: Object.fromEntries(workflow.nodes.map((node) => [node.id, {}])),
      signals: {}
    };
  }

  public tick(workflow: Workflow, state: RuntimeState, inputSignals: Signal[] = []): RuntimeExecutionResult {
    const tick = state.tick + 1;
    const timestamp = this.now().toISOString();
    const signals = { ...state.signals };
    const nodeStates = structuredClone(state.nodeStates);
    const events: RuntimeEvent[] = [];
    const queue = [...this.timerDueSignals(workflow, nodeStates, tick, timestamp), ...inputSignals];

    while (queue.length > 0) {
      const signal = queue.shift();
      if (!signal) {
        continue;
      }
      signals[signal.id] = signal;
      events.push(this.event(workflow.id, tick, timestamp, "signal-emitted", signal.sourceNodeId, { signal }));

      const execution = this.executeNode(workflow, nodeStates, signal, tick, timestamp);
      events.push(...execution.events);
      for (const output of execution.outputs) {
        signals[output.id] = output;
        events.push(this.event(workflow.id, tick, timestamp, "node-executed", output.sourceNodeId, { signal: output }));
        queue.push(output);
      }

      for (const edge of this.outgoingEdges(workflow.edges, signal)) {
        const propagated = this.propagateSignal(edge, signal, timestamp);
        signals[propagated.id] = propagated;
        queue.push(propagated);
      }
    }

    const nextState: RuntimeState = {
      ...state,
      status: "running",
      tick,
      nodeStates,
      signals
    };

    return { state: nextState, events };
  }

  private outgoingEdges(edges: Edge[], signal: Signal): Edge[] {
    if (!signal.sourceNodeId || !signal.sourcePortId) {
      return [];
    }

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
        if (!state?.active || Number(state.dueTick) > tick) {
          return [];
        }

        state.active = false;
        state.done = true;
        return [
          {
            id: this.idFactory("sig"),
            type: "digital" as const,
            value: true,
            timestamp,
            sourceNodeId: node.id,
            sourcePortId: "done"
          }
        ];
      });
  }

  private executeNode(
    workflow: Workflow,
    nodeStates: RuntimeState["nodeStates"],
    signal: Signal,
    tick: number,
    timestamp: string
  ): { outputs: Signal[]; events: RuntimeEvent[] } {
    const node = workflow.nodes.find((item) => item.id === signal.sourceNodeId);
    if (!node) {
      return { outputs: [], events: [] };
    }

    const state = nodeStates[node.id] ?? {};
    const before = JSON.stringify(state);
    nodeStates[node.id] = state;
    const localEvents: RuntimeEvent[] = [];
    const emitStateChanged = () => {
      if (before !== JSON.stringify(state)) {
        localEvents.push(this.event(workflow.id, tick, timestamp, "state-changed", node.id, { state: { ...state } }));
      }
    };

    if (node.templateId === "template.conveyor") {
      if (signal.sourcePortId === "start" && signal.value === true) {
        state.running = true;
      } else if (signal.sourcePortId === "stop" && signal.value === true) {
        state.running = false;
      } else {
        return { outputs: [], events: [] };
      }
      emitStateChanged();
      return {
        outputs: [
        {
          id: this.idFactory("sig"),
          type: "digital",
          value: Boolean(state.running),
          timestamp,
          sourceNodeId: node.id,
          sourcePortId: "running"
        }
        ],
        events: localEvents
      };
    }

    if (node.templateId === "template.motor" && signal.sourcePortId === "run") {
      state.running = Boolean(signal.value);
      emitStateChanged();
      return { outputs: [], events: localEvents };
    }

    if (node.templateId === "template.alarm" && signal.sourcePortId === "trigger") {
      state.active = Boolean(signal.value);
      emitStateChanged();
      if (state.active) {
        localEvents.push(this.event(workflow.id, tick, timestamp, "alarm-raised", node.id, { message: node.metadata.name, severity: "warning" }));
      }
      return { outputs: [], events: localEvents };
    }

    if (node.templateId === "template.timer" && signal.sourcePortId === "start") {
      const durationMs = Number(node.parameters?.durationMs ?? 1000);
      state.active = Boolean(signal.value);
      state.done = false;
      state.dueTick = tick + Math.max(1, Math.ceil(durationMs / 1000));
      emitStateChanged();
      return { outputs: [], events: localEvents };
    }

    if (node.templateId === "template.counter" && signal.sourcePortId === "count" && signal.value === true) {
      const count = Number(state.count ?? 0) + 1;
      state.count = count;
      const preset = Number(node.parameters?.preset ?? 1);
      emitStateChanged();
      return {
        outputs: [
        {
          id: this.idFactory("sig"),
          type: "digital",
          value: count >= preset,
          timestamp,
          sourceNodeId: node.id,
          sourcePortId: "done"
        }
        ],
        events: localEvents
      };
    }

    if (node.templateId === "template.condition" && signal.sourcePortId === "in") {
      return {
        outputs: [
        {
          id: this.idFactory("sig"),
          type: "digital",
          value: Boolean(signal.value),
          timestamp,
          sourceNodeId: node.id,
          sourcePortId: "out"
        }
        ],
        events: []
      };
    }

    if (node.templateId === "template.state-machine" && signal.sourcePortId === "transition") {
      state.current = String(signal.value);
      emitStateChanged();
      return {
        outputs: [
        {
          id: this.idFactory("sig"),
          type: "string",
          value: state.current,
          timestamp,
          sourceNodeId: node.id,
          sourcePortId: "state"
        }
        ],
        events: localEvents
      };
    }

    return { outputs: [], events: [] };
  }

  private event(
    workflowId: string,
    tick: number,
    timestamp: string,
    type: RuntimeEvent["type"],
    nodeId?: string,
    payload?: Record<string, unknown>
  ): RuntimeEvent {
    return {
      id: this.idFactory("evt"),
      workflowId,
      tick,
      timestamp,
      type,
      nodeId,
      payload
    };
  }
}
