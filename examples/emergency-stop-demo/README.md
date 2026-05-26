# Emergency Stop Workflow Demo

This demo is represented by the `scenario.emergency-stop` scenario in `examples/conveyor-demo/workflow.json`.

## Workflow Explanation

The emergency stop node emits a digital safety signal. That signal is wired to the conveyor stop input and to the alarm trigger. During simulation, the conveyor state transitions from running to stopped when the e-stop signal is active.

## Run

```powershell
pnpm build
pnpm --filter @openforge/conveyor-demo simulate scenario.emergency-stop
```

## Expected Behavior

- Tick 1 starts the conveyor.
- Tick 3 activates emergency stop.
- Conveyor running state becomes `false`.
- Alarm active state becomes `true`.
