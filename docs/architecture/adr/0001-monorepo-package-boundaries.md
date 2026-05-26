# ADR 0001: Monorepo Package Boundaries

## Status

Accepted

## Context

OpenForge Core needs a modular architecture that supports a web editor, backend APIs, runtime execution, simulation, connectors, debugging, and reusable templates.

## Decision

Use a pnpm workspace with `apps/*`, `packages/*`, and `examples/*`.

## Consequences

- Shared contracts live in `@openforge/schema`.
- Runtime, simulator, debugger, connectors, and templates can evolve independently.
- Examples can depend on the same package contracts as the product code.
