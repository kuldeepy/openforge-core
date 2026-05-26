# OpenForge Server

FastAPI service for project persistence, simulation orchestration, and connector management.

## Local Run

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -e .
.\.venv\Scripts\uvicorn openforge_server.main:app --reload
```

The current API exposes:

- `/health`
- `GET /projects/conveyor-demo`
- `PUT /projects/conveyor-demo`
- `/templates`

Saved projects are written as formatted JSON under `data/projects`. Simulation session, trace, and connector mutation routes will be added after the stateful runtime package stabilizes.
