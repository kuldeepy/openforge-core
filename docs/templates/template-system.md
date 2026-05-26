# Template System

Templates define reusable industrial components. Each template has metadata, a version, a category, ports, optional parameters, and optional composition.

## Initial Templates

- Digital Input
- Digital Output
- Motor
- Conveyor
- Alarm
- Timer
- Emergency Stop

## Design Rules

- Template IDs must remain stable once published.
- Breaking behavior changes require a new version.
- Ports must declare direction and signal type.
- Parameters should have defaults when possible.
- Composite templates should be represented with the same workflow schema used by projects.
