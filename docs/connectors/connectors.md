# Connector Layer

The connector layer keeps protocol details outside the runtime and workflow editor.

OpenForge separates reusable connection profiles from workflow edges. Profiles store how to reach an external system. Nodes decide what operation to perform through that profile. Edges only describe workflow data, control, event, or error flow.

## Phase 1 Protocols

- MQTT
- REST API
- WebSocket

## Phase 2 Protocols

- OPC UA
- Modbus TCP

Each connector implementation should expose a common runtime contract for connect, disconnect, publish, and subscribe operations.

## Adapter Contract

Protocol adapters should expose:

- `testConnection(profile)`
- `validateBinding(profile, binding)`
- optional `browse(profile, resource)`
- optional `read(profile, binding)`
- optional `write(profile, binding, value)`
- optional `subscribe(profile, binding, handler)`
- optional `publish(profile, binding, value)`

The open-source first slice proves this with simulation and MQTT. OPC UA and Modbus should be added after the binding model is stable.
