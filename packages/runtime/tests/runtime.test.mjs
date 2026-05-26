import assert from "node:assert/strict";
import { test } from "node:test";
import { WorkflowRuntime } from "../dist/index.js";

const workflow = {
  id: "workflow.test",
  metadata: { name: "Runtime Test" },
  nodes: [
    {
      id: "node.start",
      templateId: "template.digital-input",
      metadata: { name: "Start" },
      ports: [{ id: "out", name: "Output", direction: "output", signalType: "digital" }]
    },
    {
      id: "node.stop",
      templateId: "template.digital-input",
      metadata: { name: "Stop" },
      ports: [{ id: "out", name: "Output", direction: "output", signalType: "digital" }]
    },
    {
      id: "node.timer",
      templateId: "template.timer",
      metadata: { name: "Timer" },
      parameters: { durationMs: 2000 },
      ports: [
        { id: "start", name: "Start", direction: "input", signalType: "digital" },
        { id: "done", name: "Done", direction: "output", signalType: "digital" }
      ]
    },
    {
      id: "node.conveyor",
      templateId: "template.conveyor",
      metadata: { name: "Conveyor" },
      ports: [
        { id: "start", name: "Start", direction: "input", signalType: "digital" },
        { id: "stop", name: "Stop", direction: "input", signalType: "digital" },
        { id: "running", name: "Running", direction: "output", signalType: "digital" }
      ]
    },
    {
      id: "node.alarm",
      templateId: "template.alarm",
      metadata: { name: "Alarm" },
      ports: [{ id: "trigger", name: "Trigger", direction: "input", signalType: "digital" }]
    }
  ],
  edges: [
    { id: "edge.start", sourceNodeId: "node.start", sourcePortId: "out", targetNodeId: "node.conveyor", targetPortId: "start", signalType: "digital" },
    { id: "edge.stop", sourceNodeId: "node.stop", sourcePortId: "out", targetNodeId: "node.conveyor", targetPortId: "stop", signalType: "digital" },
    { id: "edge.timer", sourceNodeId: "node.timer", sourcePortId: "done", targetNodeId: "node.conveyor", targetPortId: "start", signalType: "digital" },
    { id: "edge.alarm", sourceNodeId: "node.stop", sourcePortId: "out", targetNodeId: "node.alarm", targetPortId: "trigger", signalType: "digital" }
  ]
};

function runtime() {
  let id = 0;
  return new WorkflowRuntime({
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    idFactory: (prefix) => `${prefix}-${++id}`
  });
}

test("conveyor starts and stops deterministically", () => {
  const engine = runtime();
  let state = engine.createInitialState(workflow);
  state = engine.tick(workflow, state, [signal("node.start", "out", true)]).state;
  assert.equal(state.nodeStates["node.conveyor"].running, true);
  state = engine.tick(workflow, state, [signal("node.stop", "out", true)]).state;
  assert.equal(state.nodeStates["node.conveyor"].running, false);
});

test("alarm emits an alarm-raised event", () => {
  const engine = runtime();
  const state = engine.createInitialState(workflow);
  const result = engine.tick(workflow, state, [signal("node.stop", "out", true)]);
  assert.equal(result.state.nodeStates["node.alarm"].active, true);
  assert.ok(result.events.some((event) => event.type === "alarm-raised"));
});

test("timer emits done signal on due tick", () => {
  const engine = runtime();
  let state = engine.createInitialState(workflow);
  state = engine.tick(workflow, state, [signal("node.timer", "start", true)]).state;
  state = engine.tick(workflow, state).state;
  assert.equal(state.nodeStates["node.conveyor"].running, undefined);
  state = engine.tick(workflow, state).state;
  assert.equal(state.nodeStates["node.conveyor"].running, true);
});

function signal(sourceNodeId, sourcePortId, value) {
  return {
    id: `sig.${sourceNodeId}.${sourcePortId}.${String(value)}`,
    type: "digital",
    value,
    timestamp: "2026-01-01T00:00:00.000Z",
    sourceNodeId,
    sourcePortId
  };
}
