from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Union

import json

# Import your logic here
from extract_from_sesh import extract_from_session
from doctor_finder import find_nearby_doctors
from template_selection import run_task_with_heidi, get_jwt_token, SESSION_ID


app = FastAPI()

# Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # You can restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ACTION_TO_TASK_TYPE = {
    "generate_pamphlet": "documentation",
    "print_document": "store",
    "send_to_lab": "order",
    "create_prescription": "order",
    "notify_patient": "reminder",
    "write_referral_letter": "referrals",
    "send_email": "send",
    "book_appointment": "book",
    "order_test": "order",
    "generate_document": "documentation",
}

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
        "sessionId": SESSION_ID,
    }


@app.get("/api/tasks")
def human_title(action_name: str) -> str:
    return action_name.replace("_", " ").title()

def get_tasks():
    """
    Build the task list from Heidi + LLM pipeline.
    We only use valid_actions from run_task_with_heidi().
    """
    # 1) Get a JWT for Heidi
    jwt_token = get_jwt_token()

    # 2) Define the high-level task you want to decompose.
    #    For a demo, you can hardcode or later derive from transcript.
    high_level_task = "Generate follow-up actions for this consultation"

    data = run_task_with_heidi(high_level_task, SESSION_ID, jwt_token)

    valid_actions = data.get("valid_actions", [])

    tasks = []

    for idx, (action_name, output_json_str) in enumerate(valid_actions, start=1):
        task_type = ACTION_TO_TASK_TYPE.get(action_name, "documentation")

        # Optionally, parse the Heidi JSON for a nicer description
        try:
            parsed = json.loads(output_json_str)
            desc = parsed.get("description") or parsed.get("content") or output_json_str[:140]
        except Exception:
            desc = output_json_str[:140]

        tasks.append({
            "id": f"task-{idx}",
            "title": human_title(action_name),   # e.g. "Write Referral Letter"
            "type": task_type,                  # must be one of your TaskType strings
            "description": desc,
        })

    return tasks


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

