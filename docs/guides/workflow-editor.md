# Workflow Editor

The workflow editor will render OpenForge workflow JSON as a node graph.

## MVP Requirements

- Create nodes from registered templates.
- Connect compatible ports.
- Move nodes on a canvas.
- Support zoom, pan, and minimap.
- Validate missing required inputs and incompatible signal types.
- Save and export Git-friendly project JSON.

## Planned Stack

- React
- TypeScript
- React Flow
- Tailwind CSS

The editor must treat `@openforge/schema` as the source of truth for projects, workflows, nodes, edges, ports, and templates.
