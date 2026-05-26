# Runtime Architecture

The runtime is event-driven and simulation-first. A workflow tick accepts input signals, propagates them across matching edges, updates runtime state, and emits runtime events for the debugger.

## Current Capabilities

- Create an initial runtime state for a workflow.
- Advance workflow execution by tick.
- Accept scheduled or external input signals.
- Emit signal events.
- Propagate signals across connected edges.

## Planned Capabilities

- Stateful template execution.
- Deterministic state machine blocks.
- Timer and counter semantics.
- Runtime replay from persisted traces.
- Error and alarm event normalization.
