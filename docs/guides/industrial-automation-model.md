# Industrial Automation Model

OpenForge is designed around concepts that should feel familiar to automation engineers while staying open-source and vendor neutral.

## Core Concepts

- Connection profiles represent plant systems and communication endpoints.
- Nodes represent actions, logic, diagnostics, and protocol operations.
- Edges represent data, control, event, or error flow between nodes.
- Property forms are the primary configuration surface for engineers.
- JSON is the portable project format, not the main editing experience.

## Simulation First

Simulation is the default path before live execution. A workflow should be validated, simulated, logged, and replayed before any live write operation is introduced.

## Live Execution Boundary

Live execution should reuse the same node definitions, validation issues, run state, logs, and protocol bindings proven by simulation. Safety-sensitive writes should be guarded by validation, clear node status, and auditable logs.
