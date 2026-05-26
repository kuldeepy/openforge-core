# Architecture Overview

OpenForge Core is organized around stable project schemas, a deterministic runtime, reusable industrial templates, simulation tools, connector adapters, and debugging traces.

```mermaid
flowchart TB
  Editor["Visual Workflow Editor"] --> Schema["Project Schema"]
  Schema --> Runtime["Runtime Engine"]
  Templates["Template Registry"] --> Editor
  Templates --> Runtime
  Simulator["Simulator"] --> Runtime
  Runtime --> Debugger["Trace and Replay"]
  Runtime --> Connectors["Connector Layer"]
  Connectors --> External["MQTT / REST / WebSocket / OPC UA / Modbus"]
```

## Principles

- Keep workflow definitions JSON/YAML friendly.
- Keep protocols behind connector interfaces.
- Keep runtime behavior transparent and replayable.
- Treat simulation as the default local development path.
- Keep AI-readiness in the data model, not as an MVP feature dependency.
