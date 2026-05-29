import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request

app = FastAPI(title="OpenForge Core API", version="0.1.0")
REPO_ROOT = Path(__file__).resolve().parents[4]
CONVEYOR_WORKFLOW = REPO_ROOT / "examples" / "conveyor-demo" / "workflow.json"
PROJECT_STORE = REPO_ROOT / "data" / "projects"
RUN_STORE: dict[str, dict] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/projects/conveyor-demo")
def get_conveyor_demo() -> dict:
    saved_project = PROJECT_STORE / "conveyor-demo.json"
    project_path = saved_project if saved_project.exists() else CONVEYOR_WORKFLOW
    if not project_path.exists():
        raise HTTPException(status_code=404, detail="Conveyor demo workflow not found")

    return json.loads(project_path.read_text(encoding="utf-8"))


@app.put("/projects/conveyor-demo")
async def save_conveyor_demo(request: Request) -> dict[str, str]:
    project = await request.json()
    validate_project_shape(project)
    PROJECT_STORE.mkdir(parents=True, exist_ok=True)
    target = PROJECT_STORE / "conveyor-demo.json"
    target.write_text(json.dumps(project, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"status": "saved", "path": str(target.relative_to(REPO_ROOT))}


@app.get("/templates")
def get_template_summary() -> list[dict]:
    return [
        template("template.digital-input", "Digital Input", "io", "I/O"),
        template("template.digital-output", "Digital Output", "io", "I/O"),
        template("template.analog-input", "Analog Input", "io", "I/O"),
        template("template.analog-output", "Analog Output", "io", "I/O"),
        template("template.motor", "Motor", "actuator", "Actuators"),
        template("template.conveyor", "Conveyor", "actuator", "Actuators"),
        template("template.alarm", "Alarm", "alarm", "Safety"),
        template("template.timer", "Timer", "timing", "Flow", [{"id": "durationMs", "name": "Duration (ms)", "type": "number", "required": True}]),
        template("template.counter", "Counter", "timing", "Flow", [{"id": "preset", "name": "Preset", "type": "number"}]),
        template("template.emergency-stop", "Emergency Stop", "safety", "Safety"),
        template("template.condition", "Condition Block", "logic", "Logic", [{"id": "expression", "name": "Expression", "type": "string"}]),
        template("template.state-machine", "State Machine", "state-machine", "Logic", [{"id": "initialState", "name": "Initial State", "type": "string"}]),
        template("template.mqtt-publish", "MQTT Publish", "io", "Protocols", [{"id": "profileId", "name": "Connection Profile", "type": "string", "required": True}, {"id": "topic", "name": "Topic", "type": "string", "required": True}]),
        template("template.log", "Log Marker", "logic", "Diagnostics", [{"id": "message", "name": "Message", "type": "string"}]),
    ]


@app.get("/projects/conveyor-demo/profiles")
def get_conveyor_profiles() -> list[dict]:
    project = get_conveyor_demo()
    return project.get("connectionProfiles") or project.get("connectors") or []


@app.post("/projects/conveyor-demo/validate")
async def validate_conveyor_demo(request: Request) -> dict:
    project = await request.json()
    validate_project_shape(project)
    workflow = project["workflows"][0]
    issues = validate_workflow(workflow, project.get("connectionProfiles") or project.get("connectors") or [])
    return {"workflowId": workflow["id"], "issues": issues}


@app.post("/projects/conveyor-demo/simulate")
async def simulate_conveyor_demo(request: Request) -> dict:
    project = await request.json()
    validate_project_shape(project)
    workflow = project["workflows"][0]
    scenario = (project.get("simulationScenarios") or [{}])[0]
    run_id = f"run.{len(RUN_STORE) + 1}"
    events = []
    logs = []
    max_ticks = scenario.get("maxTicks", 10)
    scheduled = scenario.get("scheduledSignals", [])
    node_states = {node["id"]: {} for node in workflow["nodes"]}

    for tick in range(1, max_ticks + 1):
      for entry in [item for item in scheduled if item.get("tick") == tick]:
          signal = entry.get("signal", {})
          events.append(runtime_event(workflow["id"], tick, "signal-emitted", signal.get("sourceNodeId"), {"signal": signal}))
          logs.append(runtime_log(run_id, workflow["id"], tick, "info", f"Signal {signal.get('sourceNodeId')}.{signal.get('sourcePortId')} = {signal.get('value')}", signal.get("sourceNodeId")))
          for edge in workflow.get("edges", []):
              if edge.get("sourceNodeId") == signal.get("sourceNodeId") and edge.get("sourcePortId") == signal.get("sourcePortId"):
                  events.append(runtime_event(workflow["id"], tick, "node-executed", edge.get("targetNodeId"), {"edgeId": edge.get("id")}))

    run = {
        "id": run_id,
        "projectId": project.get("id"),
        "workflowId": workflow["id"],
        "scenarioId": scenario.get("id"),
        "mode": "simulate",
        "status": "completed",
        "startedAt": "server-local",
        "completedAt": "server-local",
        "state": {"workflowId": workflow["id"], "status": "completed", "tick": max_ticks, "nodeStates": node_states, "signals": {}},
        "events": events,
        "logs": logs,
        "validationIssues": validate_workflow(workflow, project.get("connectionProfiles") or project.get("connectors") or []),
    }
    RUN_STORE[run_id] = run
    return run


@app.get("/runs/{run_id}")
def get_run(run_id: str) -> dict:
    if run_id not in RUN_STORE:
        raise HTTPException(status_code=404, detail="Run not found")
    return RUN_STORE[run_id]


@app.get("/runs/{run_id}/logs")
def get_run_logs(run_id: str) -> list[dict]:
    if run_id not in RUN_STORE:
        raise HTTPException(status_code=404, detail="Run not found")
    return RUN_STORE[run_id]["logs"]


def validate_project_shape(project: dict) -> None:
    if not isinstance(project.get("id"), str):
        raise HTTPException(status_code=400, detail="Project id is required")
    workflows = project.get("workflows")
    if not isinstance(workflows, list) or not workflows:
        raise HTTPException(status_code=400, detail="At least one workflow is required")
    workflow = workflows[0]
    if not isinstance(workflow.get("nodes"), list):
        raise HTTPException(status_code=400, detail="Workflow nodes must be a list")
    if not isinstance(workflow.get("edges"), list):
        raise HTTPException(status_code=400, detail="Workflow edges must be a list")


def validate_workflow(workflow: dict, profiles: list[dict]) -> list[dict]:
    issues = []
    node_ids = set()
    profile_ids = {profile.get("id") for profile in profiles}
    for node in workflow.get("nodes", []):
        if node.get("id") in node_ids:
            issues.append(issue("error", f"Duplicate node id {node.get('id')}", workflow.get("id"), node.get("id")))
        node_ids.add(node.get("id"))
        if node.get("templateId") == "template.mqtt-publish":
            parameters = node.get("parameters") or {}
            if not parameters.get("profileId"):
                issues.append(issue("error", f"{node.get('metadata', {}).get('name', node.get('id'))} is missing a connection profile.", workflow.get("id"), node.get("id")))
            elif profile_ids and parameters.get("profileId") not in profile_ids:
                issues.append(issue("error", f"{node.get('id')} references an unknown connection profile.", workflow.get("id"), node.get("id")))
            if not parameters.get("topic"):
                issues.append(issue("error", f"{node.get('id')} is missing MQTT topic.", workflow.get("id"), node.get("id")))

    for edge in workflow.get("edges", []):
        if edge.get("sourceNodeId") not in node_ids:
            issues.append(issue("error", f"{edge.get('id')} has missing source node.", workflow.get("id"), edge_id=edge.get("id")))
        if edge.get("targetNodeId") not in node_ids:
            issues.append(issue("error", f"{edge.get('id')} has missing target node.", workflow.get("id"), edge_id=edge.get("id")))

    return issues or [issue("info", "Workflow passes server validation.", workflow.get("id"))]


def template(template_id: str, name: str, category: str, palette_group: str, properties: list[dict] | None = None) -> dict:
    return {"id": template_id, "metadata": {"name": name, "version": "0.1.0"}, "category": category, "paletteGroup": palette_group, "propertySchema": properties or []}


def issue(severity: str, message: str, workflow_id: str | None = None, node_id: str | None = None, edge_id: str | None = None) -> dict:
    return {"id": f"server.{severity}.{abs(hash(message))}", "severity": severity, "message": message, "location": {"workflowId": workflow_id, "nodeId": node_id, "edgeId": edge_id}}


def runtime_event(workflow_id: str, tick: int, event_type: str, node_id: str | None = None, payload: dict | None = None) -> dict:
    return {"id": f"evt.{tick}.{len(payload or {})}.{node_id or 'workflow'}", "workflowId": workflow_id, "tick": tick, "timestamp": "server-local", "type": event_type, "nodeId": node_id, "payload": payload or {}}


def runtime_log(run_id: str, workflow_id: str, tick: int, level: str, message: str, node_id: str | None = None) -> dict:
    return {"id": f"log.{tick}.{node_id or 'workflow'}", "runId": run_id, "workflowId": workflow_id, "timestamp": "server-local", "tick": tick, "level": level, "message": message, "nodeId": node_id}
