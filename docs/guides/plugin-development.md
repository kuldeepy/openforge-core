# Plugin Development

OpenForge extension points are intentionally aligned with the open-source core. A plugin should add one or more node definitions, runtime handlers, property controls, protocol adapters, examples, or docs without changing the canvas or runtime internals.

## Extension Points

- Node definitions: palette group, ports, property schema, validation rules, runtime handler ID.
- Runtime handlers: deterministic simulation behavior for a node definition.
- Protocol adapters: connection test, binding validation, browse/read/write/subscribe/publish.
- Property controls: specialized form controls for tags, topics, registers, expressions, or scripts.

Plugins should keep protocol details behind adapters and should not encode external system configuration into workflow edges.

OpenForge plugins should extend the platform without requiring changes to core runtime behavior.

## Plugin Types

- Template packs
- Connector adapters
- Workflow validators
- Simulation scenario packs
- Debugger views
- Import and export tools

## Rules

- Plugins must declare stable IDs and versions.
- Plugins should use OpenForge schemas for all persisted data.
- Connector plugins must keep protocol details behind the connector runtime contract.
- Template plugins should document parameters, ports, and expected runtime behavior.
