# Workflow Editor

The workflow editor renders OpenForge workflows as an industrial automation designer. JSON remains available for import, export, and diagnostics, but the default authoring experience is drag/drop, form configuration, validation, simulation, and logs.

## MVP Requirements

- Create nodes from registered templates.
- Connect compatible ports.
- Move nodes on a canvas.
- Support zoom, pan, and minimap.
- Validate missing required inputs and incompatible signal types.
- Save and export Git-friendly project JSON.
- Configure nodes through registry-driven property forms.
- Use top menu, toolbar, and right-click actions for validate, simulate, duplicate, delete, logs, and export.
- Show validation, logs, run history, diagnostics, and JSON preview in the bottom panel.

## Planned Stack

- React
- TypeScript
- React Flow
- Tailwind CSS

The editor must treat `@openforge/schema` as the source of truth for projects, workflows, nodes, edges, ports, and templates.

## Layout

- Top menu: File, Import, Export, Run, Simulate, View, Tools, Help.
- Toolbar: save, validate, simulate, stop, export, fit.
- Left panel: grouped node palette from `@openforge/templates`.
- Center: React Flow canvas with custom industrial nodes.
- Right panel: node inspector rendered from property schema.
- Bottom panel: validation, logs, run history, diagnostics, JSON preview.
