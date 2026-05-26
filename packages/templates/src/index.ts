import type { Template } from "@openforge/schema";

export const coreTemplates: Template[] = [
  {
    id: "template.digital-input",
    metadata: { name: "Digital Input", version: "0.1.0", description: "Boolean input signal from a simulated or physical source." },
    category: "io",
    ports: [{ id: "out", name: "Output", direction: "output", signalType: "digital" }]
  },
  {
    id: "template.digital-output",
    metadata: { name: "Digital Output", version: "0.1.0", description: "Boolean output signal to a simulated or physical sink." },
    category: "io",
    ports: [{ id: "in", name: "Input", direction: "input", signalType: "digital", required: true }]
  },
  {
    id: "template.analog-input",
    metadata: { name: "Analog Input", version: "0.1.0", description: "Numeric input signal from a simulated or physical source." },
    category: "io",
    ports: [{ id: "out", name: "Output", direction: "output", signalType: "analog" }]
  },
  {
    id: "template.analog-output",
    metadata: { name: "Analog Output", version: "0.1.0", description: "Numeric output signal to a simulated or physical sink." },
    category: "io",
    ports: [{ id: "in", name: "Input", direction: "input", signalType: "analog", required: true }]
  },
  {
    id: "template.motor",
    metadata: { name: "Motor", version: "0.1.0", description: "Motor actuator with run and fault inputs." },
    category: "actuator",
    ports: [
      { id: "run", name: "Run", direction: "input", signalType: "digital" },
      { id: "fault", name: "Fault", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.conveyor",
    metadata: { name: "Conveyor", version: "0.1.0", description: "Conveyor section abstraction backed by a motor and sensors." },
    category: "actuator",
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
    ports: [{ id: "trigger", name: "Trigger", direction: "input", signalType: "digital" }]
  },
  {
    id: "template.timer",
    metadata: { name: "Timer", version: "0.1.0", description: "Simulation timer block for delayed actions." },
    category: "timing",
    parameters: [{ id: "durationMs", name: "Duration", type: "number", defaultValue: 1000, required: true }],
    ports: [
      { id: "start", name: "Start", direction: "input", signalType: "digital" },
      { id: "done", name: "Done", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.counter",
    metadata: { name: "Counter", version: "0.1.0", description: "Counts rising digital events during simulation." },
    category: "timing",
    parameters: [{ id: "preset", name: "Preset", type: "number", defaultValue: 1 }],
    ports: [
      { id: "count", name: "Count", direction: "input", signalType: "digital" },
      { id: "done", name: "Done", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.condition",
    metadata: { name: "Condition Block", version: "0.1.0", description: "Evaluates a boolean condition and forwards the result." },
    category: "logic",
    ports: [
      { id: "in", name: "Input", direction: "input", signalType: "digital" },
      { id: "out", name: "Output", direction: "output", signalType: "digital" }
    ]
  },
  {
    id: "template.state-machine",
    metadata: { name: "State Machine", version: "0.1.0", description: "State transition block for deterministic workflow behavior." },
    category: "state-machine",
    parameters: [{ id: "initialState", name: "Initial State", type: "string", defaultValue: "idle" }],
    ports: [
      { id: "transition", name: "Transition", direction: "input", signalType: "string" },
      { id: "state", name: "State", direction: "output", signalType: "string" }
    ]
  },
  {
    id: "template.emergency-stop",
    metadata: { name: "Emergency Stop", version: "0.1.0", description: "Safety input that forces downstream equipment to stop in simulation." },
    category: "safety",
    ports: [{ id: "active", name: "Active", direction: "output", signalType: "digital" }]
  }
];

export class TemplateRegistry {
  private readonly templates = new Map<string, Template>();

  public constructor(initialTemplates: Template[] = coreTemplates) {
    for (const template of initialTemplates) {
      this.register(template);
    }
  }

  public register(template: Template): void {
    this.templates.set(template.id, template);
  }

  public get(id: string): Template | undefined {
    return this.templates.get(id);
  }

  public list(): Template[] {
    return [...this.templates.values()];
  }
}
