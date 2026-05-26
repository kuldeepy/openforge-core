# Developer Setup

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer

If `pnpm` is not available, enable it through Corepack:

```powershell
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

## Install

```powershell
pnpm install
```

## Validate Examples

```powershell
pnpm validate:examples
```

## Build Packages

```powershell
pnpm build
```

## Run the Browser MVP

```powershell
pnpm dev:web
```

Open the URL printed by the dev server. It starts at `http://localhost:4173` and automatically tries the next free port if needed.

## Run Terminal Simulation

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

The browser MVP is dependency-light today. React Flow and Tailwind remain the planned production editor stack after the workflow and runtime contracts settle.
