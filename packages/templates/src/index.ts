import type { NodeDefinition, Template } from "@openforge/schema";

export const coreTemplates: NodeDefinition[] = [
  {
    id: "template.digital-input",
    metadata: { name: "Digital Input", version: "0.1.0", description: "Boolean input signal from a simulated or physical source." },
    category: "io",
    icon: "toggle-left",
    paletteGroup: "I/O",
    runtimeHandler: "handler.pass-through-source",
    ports: [{ id: "out", name: "Output", direction: "output", signalType: "digital" }]
  },
  {
    id: "template.digital-output",
    metadata: { name: "Digital Output", version: "0.1.0", description: "Boolean output signal to a simulated or physical sink." },
    category: "io",
    icon: "toggle-right",
    paletteGroup: "I/O",
    runtimeHandler: "handler.sink",
    ports: [{ id: "in", name: "Input", direction: "input", signalType: "digital", required: true }]
  },
  {
    id: "template.analog-input",
    metadata: { name: "Analog Input", version: "0.1.0", description: "Numeric input signal from a simulated or physical source." },
    category: "io",
    icon: "activity",
    paletteGroup: "I/O",
    runtimeHandler: "handler.pass-through-source",
    ports: [{ id: "out", name: "Output", direction: "output", signalType: "analog" }]
  },
  {
    id: "template.analog-output",
    metadata: { name: "Analog Output", version: "0.1.0", description: "Numeric output signal to a simulated or physical sink." },
    category: "io",
    icon: "gauge",
    paletteGroup: "I/O",
    runtimeHandler: "handler.sink",
    ports: [{ id: "in", name: "Input", direction: "input", signalType: "analog", required: true }]
  },
  {
    id: "template.motor",
    metadata: { name: "Motor", version: "0.1.0", description: "Motor actuator with run and fault inputs." },
    category: "actuator",
    icon: "settings",
    paletteGroup: "Actuators",
    runtimeHandler: "handler.motor",
    ports: [
      { id: "run", name: "Run", direction: "input", signalType: "digital" },
      { id: "fault", name: "Fault", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.conveyor",
    metadata: { name: "Conveyor", version: "0.1.0", description: "Conveyor section abstraction backed by a motor and sensors." },
    category: "actuator",
    icon: "move-right",
    paletteGroup: "Actuators",
    runtimeHandler: "handler.conveyor",
    ports: [
      { id: "start", name: "Start", direction: "input", signalType: "digital" },
      { id: "stop", name: "Stop", direction: "input", signalType: "digital" },
      { id: "running", name: "Running", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.alarm",
    metadata: { name: "Alarm", version: "0.1.0", description: "Alarm block that raises an event when its trigger is active." },
    category: "alarm",
    icon: "bell",
    paletteGroup: "Safety",
    runtimeHandler: "handler.alarm",
    ports: [{ id: "trigger", name: "Trigger", direction: "input", signalType: "digital" }]
  },
  {
    id: "template.timer",
    metadata: { name: "Timer", version: "0.1.0", description: "Simulation timer block for delayed actions." },
    category: "timing",
    icon: "timer",
    paletteGroup: "Flow",
    runtimeHandler: "handler.timer",
    parameters: [{ id: "durationMs", name: "Duration (ms)", type: "number", defaultValue: 1000, required: true, description: "Delay before emitting done." }],
    propertySchema: [{ id: "durationMs", name: "Duration (ms)", type: "number", defaultValue: 1000, required: true }],
    ports: [
      { id: "start", name: "Start", direction: "input", signalType: "digital" },
      { id: "done", name: "Done", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.counter",
    metadata: { name: "Counter", version: "0.1.0", description: "Counts rising digital events during simulation." },
    category: "timing",
    icon: "hash",
    paletteGroup: "Flow",
    runtimeHandler: "handler.counter",
    parameters: [{ id: "preset", name: "Preset", type: "number", defaultValue: 1 }],
    propertySchema: [{ id: "preset", name: "Preset", type: "number", defaultValue: 1 }],
    ports: [
      { id: "count", name: "Count", direction: "input", signalType: "digital" },
      { id: "done", name: "Done", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.condition",
    metadata: { name: "Condition Block", version: "0.1.0", description: "Evaluates a boolean condition and forwards the result." },
    category: "logic",
    icon: "git-branch",
    paletteGroup: "Logic",
    runtimeHandler: "handler.condition",
    parameters: [{ id: "expression", name: "Expression", type: "string", defaultValue: "input == true", bindingRole: "expression" }],
    propertySchema: [{ id: "expression", name: "Expression", type: "string", defaultValue: "input == true", bindingRole: "expression" }],
    ports: [
      { id: "in", name: "Input", direction: "input", signalType: "digital" },
      { id: "out", name: "Output", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.state-machine",
    metadata: { name: "State Machine", version: "0.1.0", description: "State transition block for deterministic workflow behavior." },
    category: "state-machine",
    icon: "workflow",
    paletteGroup: "Logic",
    runtimeHandler: "handler.state-machine",
    parameters: [{ id: "initialState", name: "Initial State", type: "string", defaultValue: "idle" }],
    propertySchema: [{ id: "initialState", name: "Initial State", type: "string", defaultValue: "idle" }],
    ports: [
      { id: "transition", name: "Transition", direction: "input", signalType: "string" },
      { id: "state", name: "State", direction: "output", signalType: "string" }
    ]
  },
  {
    id: "template.emergency-stop",
    metadata: { name: "Emergency Stop", version: "0.1.0", description: "Safety input that forces downstream equipment to stop in simulation." },
    category: "safety",
    icon: "octagon-alert",
    paletteGroup: "Safety",
    runtimeHandler: "handler.pass-through-source",
    ports: [{ id: "active", name: "Active", direction: "output", signalType: "digital" }]
  },
  {
    id: "template.mqtt-publish",
    metadata: { name: "MQTT Publish", version: "0.1.0", description: "Publishes an incoming signal to a configured MQTT topic in simulation or connector dry-run." },
    category: "io",
    icon: "send",
    paletteGroup: "Protocols",
    runtimeHandler: "handler.protocol-publish",
    parameters: [
      { id: "profileId", name: "Connection Profile", type: "string", required: true, bindingRole: "profile" },
      { id: "topic", name: "Topic", type: "string", required: true, bindingRole: "topic" }
    ],
    propertySchema: [
      { id: "profileId", name: "Connection Profile", type: "string", required: true, bindingRole: "profile" },
      { id: "topic", name: "Topic", type: "string", required: true, bindingRole: "topic" }
    ],
    ports: [{ id: "in", name: "Input", direction: "input", signalType: "object", required: true }]
  },
  {
    id: "template.log",
    metadata: { name: "Log Marker", version: "0.1.0", description: "Writes a trace marker during simulation for diagnostics." },
    category: "logic",
    icon: "list",
    paletteGroup: "Diagnostics",
    runtimeHandler: "handler.log",
    parameters: [{ id: "message", name: "Message", type: "string", defaultValue: "Trace marker" }],
    propertySchema: [{ id: "message", name: "Message", type: "string", defaultValue: "Trace marker" }],
    ports: [{ id: "in", name: "Input", direction: "input", signalType: "digital" }]
  }
];

export class TemplateRegistry {
  private readonly templates = new Map<string, NodeDefinition>();

  public constructor(initialTemplates: NodeDefinition[] = coreTemplates) {
    for (const template of initialTemplates) {
      this.register(template);
    }
  }

  public register(template: NodeDefinition): void {
    this.templates.set(template.id, template);
  }

  public get(id: string): NodeDefinition | undefined {
    return this.templates.get(id);
  }

  public list(): NodeDefinition[] {
    return [...this.templates.values()];
  }

  public groups(): Record<string, NodeDefinition[]> {
    return this.list().reduce<Record<string, NodeDefinition[]>>((groups, template) => {
      const group = template.paletteGroup ?? template.category;
      groups[group] = [...(groups[group] ?? []), template];
      return groups;
    }, {});
  }
}

export function toLegacyTemplates(definitions: NodeDefinition[] = coreTemplates): Template[] {
  return definitions;
}
