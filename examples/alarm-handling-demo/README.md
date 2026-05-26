# Alarm Handling Demo

This demo is represented by the `scenario.jam-recovery` scenario in `examples/conveyor-demo/workflow.json`.

## Workflow Explanation

The jam sensor emits a digital signal. The signal triggers the alarm node and starts the restart timer path. The current MVP records the alarm state and trace events; future runtime work will add timer expiration semantics.

## Run

```powershell
pnpm build
pnpm --filter @openforge/conveyor-demo simulate scenario.jam-recovery
```

## Expected Behavior

- Tick 1 starts the conveyor.
- Tick 4 activates the jam sensor.
- Alarm active state becomes `true`.
- Runtime trace shows jam signal propagation to alarm and timer.
