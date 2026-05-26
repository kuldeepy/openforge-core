import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { WorkflowRuntime } from "../../packages/runtime/dist/index.js";

const workflowPath = resolve(import.meta.dirname, "workflow.json");
const project = JSON.parse(await readFile(workflowPath, "utf8"));
const workflow = project.workflows.find((item) => item.id === "workflow.conveyor-control");
const requestedScenario = process.argv[2] ?? "scenario.nominal-start-stop";
const scenario = project.simulationScenarios.find((item) => item.id === requestedScenario);

if (!workflow || !scenario) {
  throw new Error("Conveyor workflow or scenario is missing.");
}

const runtime = new WorkflowRuntime({
  idFactory: (() => {
    let id = 0;
    return (prefix) => `${prefix}-${++id}`;
  })(),
  now: () => new Date("2026-01-01T00:00:00.000Z")
});

let state = runtime.createInitialState(workflow);
const scheduledSignals = scenario.scheduledSignals ?? [];

console.log(`Running ${scenario.metadata.name}`);
console.log(`Workflow: ${workflow.metadata.name}`);

for (let tick = 1; tick <= (scenario.maxTicks ?? 10); tick += 1) {
  const inputs = scheduledSignals.filter((entry) => entry.tick === tick).map((entry) => entry.signal);
  const result = runtime.tick(workflow, state, inputs);
  state = result.state;

  for (const event of result.events) {
    const signal = event.payload?.signal;
    if (signal) {
      console.log(
        `tick ${event.tick}: ${event.type} ${signal.sourceNodeId ?? "external"}.${signal.sourcePortId ?? "unknown"} = ${signal.value}`
      );
    }
  }
}

console.log(`Final runtime status: ${state.status}`);
console.log(`Final tick: ${state.tick}`);
console.log(`Final conveyor running: ${state.nodeStates["node.conveyor"]?.running ?? false}`);
console.log(`Final alarm active: ${state.nodeStates["node.alarm"]?.active ?? false}`);
