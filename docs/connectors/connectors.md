# Connector Layer

The connector layer keeps protocol details outside the runtime and workflow editor.

## Phase 1 Protocols

- MQTT
- REST API
- WebSocket

## Phase 2 Protocols

- OPC UA
- Modbus TCP

Each connector implementation should expose a common runtime contract for connect, disconnect, publish, and subscribe operations.
