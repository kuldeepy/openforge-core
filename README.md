# OpenForge Core

OpenForge Core is an open-source industrial automation engineering framework. It is designed to sit above existing PLC, SCADA, and industrial device ecosystems while giving teams modern workflow engineering, simulation, reusable templates, observability, and vendor-neutral connectivity.

The project does not aim to replace PLCs in the MVP. The first goal is to prove that automation workflows can be designed, simulated, debugged, and managed with a local-first, Git-friendly engineering platform.

## MVP Focus

- Visual workflow engineering with nodes, ports, and signal connections
- Reusable industrial templates such as digital I/O, motors, conveyors, alarms, timers, counters, and emergency stops
- Deterministic simulation runtime with event logs, traces, replay, and state inspection
- Vendor-neutral connector contracts for MQTT, REST, and WebSocket first
- JSON/YAML project definitions that are easy to diff and review
- AI-ready schemas that future tooling can use to explain, generate, or optimize workflows

## Repository Layout

```text
apps/
  web/                 Browser-based workflow editor
  server/              API service for projects, simulation, and connectors
packages/
  schema/              Shared JSON-friendly data contracts
  runtime/             Event-driven workflow execution engine
  simulator/           Simulation clock and I/O helpers
  templates/           Industrial template registry
  connectors/          Protocol-agnostic connector contracts
  debugger/            Trace and replay utilities
examples/
  conveyor-demo/       Initial conveyor automation simulation
docs/                  Architecture, runtime, connector, template, and contributor docs
```

## Quick Start

```powershell
pnpm install
pnpm build
pnpm validate:examples
pnpm demo:conveyor
pnpm dev:web
```

Then open the URL printed by the dev server. It starts at `http://localhost:4173` and automatically tries the next free port if that port is already occupied.

The current repository includes a runnable MVP foundation: shared schemas, package boundaries, runtime/template/simulator/debugger/connector contracts, a local browser workflow editor/dashboard, documented demo scenarios, and a conveyor simulation.

## Current MVP Capabilities

- Render the conveyor workflow in a browser canvas.
- Inspect nodes, ports, templates, project metadata, connectors, and runtime signals.
- Validate workflow node and edge references.
- Import and export project JSON.
- Run terminal simulation scenarios with runtime event output.
- Build TypeScript packages across the monorepo.
- Serve project and template data from the FastAPI scaffold.

## Run Simulation Scenarios

```powershell
pnpm demo:conveyor
pnpm --filter @openforge/conveyor-demo simulate scenario.jam-recovery
pnpm --filter @openforge/conveyor-demo simulate scenario.emergency-stop
```

## Run the API Scaffold

```powershell
cd apps/server
python -m venv .venv
.\.venv\Scripts\pip install -e .
.\.venv\Scripts\uvicorn openforge_server.main:app --reload
```

Useful endpoints:

- `http://localhost:8000/health`
- `http://localhost:8000/projects/conveyor-demo`
- `http://localhost:8000/templates`

## Roadmap

See [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md).
