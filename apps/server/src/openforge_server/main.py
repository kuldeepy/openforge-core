import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request

app = FastAPI(title="OpenForge Core API", version="0.1.0")
REPO_ROOT = Path(__file__).resolve().parents[4]
CONVEYOR_WORKFLOW = REPO_ROOT / "examples" / "conveyor-demo" / "workflow.json"
PROJECT_STORE = REPO_ROOT / "data" / "projects"


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
def get_template_summary() -> list[dict[str, str]]:
    return [
        {"id": "template.digital-input", "name": "Digital Input", "category": "io"},
        {"id": "template.digital-output", "name": "Digital Output", "category": "io"},
        {"id": "template.analog-input", "name": "Analog Input", "category": "io"},
        {"id": "template.analog-output", "name": "Analog Output", "category": "io"},
        {"id": "template.motor", "name": "Motor", "category": "actuator"},
        {"id": "template.conveyor", "name": "Conveyor", "category": "actuator"},
        {"id": "template.alarm", "name": "Alarm", "category": "alarm"},
        {"id": "template.timer", "name": "Timer", "category": "timing"},
        {"id": "template.counter", "name": "Counter", "category": "timing"},
        {"id": "template.emergency-stop", "name": "Emergency Stop", "category": "safety"},
        {"id": "template.condition", "name": "Condition Block", "category": "logic"},
        {"id": "template.state-machine", "name": "State Machine", "category": "state-machine"},
    ]


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
