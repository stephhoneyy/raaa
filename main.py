from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Union

# Import your logic here
from extract_from_sesh import extract_from_session
from doctor_finder import find_nearby_doctors

app = FastAPI()

# Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # You can restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Pydantic Models (match frontend)
# -----------------------------

class Task(BaseModel):
    id: str
    title: str
    type: str
    description: Union[str, None] = None

class GenerateRequest(BaseModel):
    taskId: str
    taskType: str
    taskDetails: Any

class ExecuteItem(BaseModel):
    taskId: str
    taskType: str
    content: Any

class ExecuteBatchRequest(BaseModel):
    tasks: List[ExecuteItem]
    executedAt: str

# -----------------------------
# Endpoints
# -----------------------------

@app.get("/api/patient")
def get_patient():
    """
    TODO:
    Replace this with your Heidi session data.
    """
    return {
        "id": "patient-001",
        "name": "John Doe",
        "dateOfBirth": "1980-03-15",
        "sessionId": "SESSION-1234",
    }


@app.get("/api/tasks")
def get_tasks():
    """
    TODO:
    Replace with your real tasks extracted from Heidi transcript / logic.
    """
    return [
        {
            "id": "task-1",
            "title": "Create session note",
            "type": "documentation",
            "description": "Generate a session note from transcript."
        },
        {
            "id": "task-2",
            "title": "Refer to specialist",
            "type": "referrals",
            "description": "Find a specialist based on condition."
        }
    ]


@app.post("/api/tasks/generate")
def generate_task_content(req: GenerateRequest):
    """
    TODO:
    Connect real logic.
    """
    if req.taskType == "documentation":
        return {
            "type": "Session Note",
            "content": f"Generated session note for: {req.taskDetails['title']}"
        }
    
    if req.taskType == "email":
        return {
            "type": "Email",
            "content": f"Generated email for: {req.taskDetails['title']}"
        }

    if req.taskType == "referrals":
        specialty, postcode = extract_from_session()  # you already have this!
        doctors = find_nearby_doctors(specialty, postcode)
        return {
            "type": "Nearby Specialists",
            "content": doctors
        }

    return {
        "type": "Preview",
        "content": f"Generated content for task type: {req.taskType}"
    }


@app.post("/api/tasks/execute-batch")
def execute_tasks(req: ExecuteBatchRequest):
    """
    TODO:
    Actually execute tasks (emails, upload EMR, etc.)
    """
    results = []
    for task in req.tasks:
        results.append({
            "taskId": task.taskId,
            "status": f"Executed {task.taskType}"
        })

    return {
        "status": "ok",
        "executedCount": len(req.tasks),
        "results": results
    }

