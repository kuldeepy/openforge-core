# Debugging and Observability

OpenForge debugging is based on runtime events and trace sessions.

## MVP Debugging Features

- Signal tracing
- Runtime event history
- Workflow execution logs
- Replayable execution timeline
- Runtime state inspection
- Error and event console

The current `@openforge/debugger` package provides a trace container that can collect events by tick or node.
