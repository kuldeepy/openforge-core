# OpenForge Web

Browser-based workflow editor for OpenForge Core.

## Run

```powershell
pnpm build
pnpm dev:web
```

Open the URL printed by the dev server. It starts at `http://localhost:4173` and automatically tries the next free port if needed.

## Current Features

- Workflow graph rendering from `examples/conveyor-demo/workflow.json`
- Node selection and inspection
- Template catalog
- Workflow validation
- Runtime signal dashboard
- Simulation timeline
- Playback highlighting
- Import/export of project JSON

The long-term target remains React, TypeScript, React Flow, and Tailwind. The current implementation is dependency-light so the MVP is runnable immediately.
