from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Union
import json

# Your imports
from extract_from_sesh import extract_from_session
from doctor_finder import find_nearby_doctors
from template_selection import run_task_with_heidi, get_jwt_token, SESSION_ID


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Task type mapping
# -----------------------------
ACTION_TO_TASK_TYPE = {
    "generate_pamphlet": "documentation",
    "print_document": "store",
    "send_to_lab": "order",
    "create_prescription": "order",
    "notify_patient": "reminder",
    "write_referral_letter": "referrals",
    "send_email": "email",        # so /api/tasks/generate hits your email branch
    "book_appointment": "book",
    "order_test": "order",
    "generate_document": "documentation",
}

# -----------------------------
# Pydantic models
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
# Helpers
# -----------------------------
def human_title(action_name: str) -> str:
    return action_name.replace("_", " ").title()

def clean_markdown_json(md_block: Any) -> str:
    """
    Accepts either:
      - a raw JSON string
      - a ```json fenced block
      - or even a dict/list

    Returns a JSON *string* we can json.loads.
    """
    # If it's already a dict/list/etc., just dump to string
    if not isinstance(md_block, str):
        try:
            return json.dumps(md_block)
        except Exception:
            return str(md_block)

    s = md_block.strip()

    # Strip leading ```xxx
    if s.startswith("```"):
        first_newline = s.find("\n")
        if first_newline != -1:
            s = s[first_newline + 1 :]

    # Strip trailing ```
    if s.endswith("```"):
        s = s[:-3]

    return s.strip()

def build_tasks_from_valid_actions(valid_actions: list) -> List[Task]:
    """
    valid_actions structure (from run_task_with_heidi):

      [
        ["write_referral_letter", "```json\n{...}\n```"],
        ["generate_document", "```json\n{...}\n```"],
        ...
      ]
    """
    tasks: List[Task] = []

    for idx, item in enumerate(valid_actions, start=1):
        # Ensure each item looks like [action_name, output]
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            continue

        action_name, output = item
        action_name_str = str(action_name)

        task_type = ACTION_TO_TASK_TYPE.get(action_name_str, "documentation")

        parsed = None

        # Try to normalise + parse the output as JSON
        try:
            if isinstance(output, dict):
                parsed = output
            else:
                json_str = clean_markdown_json(output)
                parsed = json.loads(json_str)
        except Exception:
            parsed = None

        # Try to find a nice human description
        desc = None
        if isinstance(parsed, dict):
            desc = (
                parsed.get("description")
                or parsed.get("content")
                or parsed.get("message")
                or parsed.get("body")
                or parsed.get("notes")
            )

        # Fallback: just use a truncated string version
        if not desc:
            try:
                desc = str(output)[:200]
            except Exception:
                desc = "Task output available but could not be displayed."

        tasks.append(
            Task(
                id=f"task-{idx}",
                title=human_title(action_name_str),
                type=task_type,
                description=desc,
            )
        )

    return tasks

# -----------------------------
# Endpoints
# -----------------------------
@app.get("/api/patient")
def get_patient():
    return {
        "id": "patient-001",
        "name": "John Doe",
        "dateOfBirth": "1980-03-15",
        "sessionId": SESSION_ID,
    }

@app.get("/api/tasks", response_model=List[Task])
def list_tasks():
    """
    Call Heidi to get valid_actions, convert them into Task objects, and
    return a simple list that the frontend can render.
    """
    jwt_token = get_jwt_token()
    high_level_task = "Generate follow-up actions for this consultation"
    print("HERE")
    data = run_task_with_heidi(high_level_task, SESSION_ID, jwt_token)

    # data should be: { "valid_actions": [...], "invalid_actions": [...] }
    valid_actions = data.get("valid_actions", [])

    tasks = build_tasks_from_valid_actions(valid_actions)
    return tasks

@app.post("/api/tasks/generate")
def generate_task_content(req: GenerateRequest):
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
        specialty, postcode = extract_from_session()
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


