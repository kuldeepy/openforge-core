# MQTT Signal Integration Demo

The MQTT connector is declared in `examples/conveyor-demo/workflow.json` as `connector.mqtt.local`.

## Behavior

The connector layer includes a real MQTT adapter built on the `mqtt` client package. The local demo runs in dry-run mode by default so the repository validates without a broker.

## Run Dry-Run Demo

```powershell
pnpm build
pnpm demo:mqtt
```

## Planned Run Path

1. Start a local MQTT broker on `localhost:1883`.
2. Enable `connector.mqtt.local`.
3. Run the connector without `--dry-run`.
4. Publish runtime signals under `openforge/conveyor-demo`.

## Expected Topics

- `openforge/conveyor-demo/signals/start`
- `openforge/conveyor-demo/signals/stop`
- `openforge/conveyor-demo/events/runtime`
