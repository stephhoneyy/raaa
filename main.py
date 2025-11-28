from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Optional
import json

from extract_from_sesh import extract_from_session
from doctor_finder import find_nearby_doctors
from template_selection import get_actions_from_task, get_data_of_action, get_jwt_token, SESSION_ID


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Pydantic models
# -----------------------------
class Task(BaseModel):
    title: str           # Human-readable title (from action name)
    type: str 
    prompt: str           # RAW action name from Heidi, e.g. "write_referral_letter"
    description: Optional[str] = None  # AI agent output as text


class GenerateRequest(BaseModel):
    taskId: str | None = None   # <-- make optional
    taskType: str
    taskDetails: Any


class ExecuteItem(BaseModel):
    taskId: str
    taskType: str        # RAW action name
    content: Any


class ExecuteBatchRequest(BaseModel):
    tasks: List[ExecuteItem]
    executedAt: str


# -----------------------------
# Helpers
# -----------------------------
def human_title(action_name: str) -> str:
    """Turn 'write_referral_letter' into 'Write Referral Letter'."""
    return action_name.replace("_", " ").title()


def clean_markdown_json(md_block: str) -> str:
    """
    Takes a string which might be:

      ```json
      { ... }
      ```

    or just raw JSON, and returns just the JSON part as a string.
    """
    s = md_block.strip()

    # Strip leading ```... line if present
    if s.startswith("```"):
        first_newline = s.find("\n")
        if first_newline != -1:
            s = s[first_newline + 1 :]

    # Strip trailing ``` if present
    if s.endswith("```"):
        s = s[:-3]

    return s.strip()


def normalise_output_to_text(output: Any) -> str:
    """
    Convert Heidi's output (string, dict, list, etc.) to a readable text
    for the Task.description field.
    """
    # Already a string -> clean markdown fences
    if isinstance(output, str):
        return clean_markdown_json(output)[:500]

    # Dict or list -> pretty JSON
    try:
        return json.dumps(output, indent=2)[:500]
    except Exception:
        return str(output)[:500]


# def build_tasks_from_valid_actions(valid_actions: list) -> List[Task]:
#     """
#     valid_actions structure from run_task_with_heidi:

#       [
#         ["write_referral_letter", "```json\\n{...}\\n```"],
#         ["generate_document",    "```json\\n{...}\\n```"],
#         ...
#       ]

#     We:
#       - use the first element as both the raw type AND to build the title
#       - use the second element (AI output) as description (textified).
#     """
#     tasks: List[Task] = []

#     for idx, item in enumerate(valid_actions, start=1):
#         if not isinstance(item, (list, tuple)) or len(item) != 2:
#             # Skip malformed entries
#             continue

#         action_name, output = item
#         action_name_str = str(action_name)

#         desc_text = normalise_output_to_text(output)

#         tasks.append(
#             Task(
#                 title=human_title(action_name_str),
#                 type=action_name_str,      # <-- RAW action name, no mapping
#                 prompt=
#                 description=desc_text,
#             )
#         )

#     return tasks


# -----------------------------
# Endpoints
# -----------------------------
@app.get("/api/patient")
def get_patient():
    # You can replace these with real values later
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

    Each Task has:
      - id: "task-1", "task-2", ...
      - title: humanised action (e.g. "Write Referral Letter")
      - type: RAW action name (e.g. "write_referral_letter")
      - description: AI output as text
    """
    jwt_token = get_jwt_token()
    high_level_task = "Generate follow-up actions for this consultation"

    data = get_actions_from_task(high_level_task)
    valid_actions = data

    return valid_actions


@app.post("/api/tasks/generate")
def generate_task_content(req: GenerateRequest):
    """
    Generate preview content for a specific task.

    req.taskType is the RAW action name from Heidi, e.g. "write_referral_letter".
    We branch on substrings instead of using a separate mapping.
    """
    action = req.taskType

    # Simple heuristics based on action name
    action_lower = action.lower()

    if "referral" in action_lower:
        # Use your extract_from_session + find_nearby_doctors helper
        specialty, postcode = extract_from_session()
        doctors = find_nearby_doctors(specialty, postcode)
        return {
            "type": "Nearby Specialists",
            "content": doctors,
        }

    if "email" in action_lower or "send" in action_lower:
        return {
            "type": "Email",
            "content": f"Generated email for: {req.taskDetails.get('title', 'this task')}",
        }

    if "document" in action_lower or "note" in action_lower or "pamphlet" in action_lower:
        return {
            "type": "Document",
            "content": f"Generated document for: {req.taskDetails.get('title', 'this task')}",
        }

    if "order" in action_lower or "test" in action_lower or "prescription" in action_lower:
        return {
            "type": "Order",
            "content": f"Generated order for: {req.taskDetails.get('title', 'this task')}",
        }

    if "book" in action_lower or "appointment" in action_lower:
        return {
            "type": "Appointment",
            "content": f"Generated appointment details for: {req.taskDetails.get('title', 'this task')}",
        }

    # Fallback generic preview
    return {
        "type": "Preview",
        "content": f"Generated content for action: {action}",
    }


@app.post("/api/tasks/execute-batch")
def execute_tasks(req: ExecuteBatchRequest):
    """
    Execute a batch of approved tasks.

    For now this just returns a simple status per task. You can later plug in
    real email sending, EMR upload, etc.
    """
    results = []
    for task in req.tasks:
        results.append({
            "taskId": task.taskId,
            "status": f"Executed {task.taskType}",
        })

    return {
        "status": "ok",
        "executedCount": len(req.tasks),
        "results": results,
    }
