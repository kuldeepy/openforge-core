# Sensor Simulation Demo

This demo uses scheduled signals in `examples/conveyor-demo/workflow.json` to simulate operator inputs and sensor changes.

## Inputs and Outputs

- Digital input nodes provide start, stop, emergency stop, and jam signals.
- Conveyor and alarm nodes expose simulated state for inspection.

## Run

```powershell
pnpm demo:conveyor
```

## Troubleshooting

If no events appear, confirm `simulationScenarios` in the workflow JSON contains scheduled signals.
