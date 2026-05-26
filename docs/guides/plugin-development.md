# Plugin Development

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
