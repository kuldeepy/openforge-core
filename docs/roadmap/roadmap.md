# Roadmap

## Milestone 1: Monorepo and Schemas

- Initialize package structure.
- Define project, workflow, node, edge, port, signal, template, runtime state, event, connector, alarm, and simulation scenario contracts.
- Add initial conveyor demo data and documentation.
- Status: implemented.

## Milestone 2: Visual Workflow Editor

- Add React, TypeScript, React Flow, and Tailwind.
- Render workflow nodes and edges from project JSON.
- Add drag/drop node creation, zoom, pan, minimap, and basic validation.
- Status: MVP implemented with a dependency-light browser canvas; React Flow migration remains planned.

## Milestone 3: Template Registry

- Expand reusable industrial templates.
- Add import/export and version compatibility checks.
- Status: initial registry implemented with core industrial templates.

## Milestone 4: Runtime Execution Engine

- Add stateful template execution.
- Add deterministic state transitions.
- Add runtime context management.
- Status: initial stateful runtime implemented for conveyor, alarm, counter, condition, and state-machine blocks.

## Milestone 5: I/O Simulator

- Add digital and analog I/O simulation.
- Add scenario runner.
- Status: scheduled digital signal scenarios implemented; analog helper behavior remains planned.

## Milestone 6: Tracing and Debugging

- Add execution logs, state timeline, and replay.
- Status: runtime trace package and browser timeline/playback implemented.

## Milestone 7: Conveyor Simulation Demo

- Connect editor, runtime, simulator, and debugger in one runnable demo.
- Status: conveyor demo can run in terminal and browser MVP.

## Milestone 8: MQTT Integration

- Add MQTT connector implementation and integration demo.
- Status: protocol-agnostic connector contract and MQTT demo documentation implemented; broker-backed adapter remains planned.

## Milestone 9: Save, Load, Import, Export

- Add local project persistence and Git-friendly export.
- Status: browser import/export of project JSON implemented.

## Milestone 10: Open-Source Release

- Finalize docs, contribution guide, starter issues, CI, and release notes.
- Status: initial open-source release hygiene implemented; CI added for install, build, and example validation.
