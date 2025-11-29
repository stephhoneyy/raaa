import json
from groq import Groq
from config import test_key # I put key here

client = Groq(api_key=test_key)

def ask_llm(prompt):
    chat = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", 
                   "content": prompt}]
    )
    return chat.choices[0].message.content


DECOMPOSE_PROMPT_TEMPLATE = """
You are a task planner. Convert the following clinical task
into an array of executable actions.

Rules:
1. Only use these action types: {action_types}
2. For each action if chosen, use **exactly the arguments listed below**.
   - print_document: title (required), body (optional)
   - send_to_lab: specimen_type (required), test (required)
   - create_prescription: medication (required), dose (optional), instructions (optional)
   - write_referral_letter: to (required), purpose (required)
   - send_email: to (required), subject (required)
   - book_appointment: clinic (optional), date (required), reason (optional)
   - order_test: test_name (required)

IMPORTANT:
- Output **exactly one JSON array** of objects.
- Each object must have "action" and "args".
- Only 5 objects of "action" and "args" can be returned.
- Do NOT include explanations, notes, or anything aside from these objects.
- Do not invent new argument names.
- Be strict with chosen action types, any action not explicitely mentioned should be carefully considered.
- Example:
[
  {{
    "action": "action_name",
    "args": {{ "arg1": "value", "arg2": "value" }}
  }}
]

Task: "{task}"
"""

ACTION_PROMPTS = {
    "print_document": "Print document titled {title}{body}. "\
                      "Consider the session context. "\
                      "Return a JSON object with keys: 'title', 'body'.",

    "send_to_lab": "Send {specimen_type} to lab for {test}. "\
                   "Include session context. "\
                   "Return a JSON object with keys: 'specimen_type', 'test'.",

    "create_prescription": "Create prescription of {medication}. "\
                           "Consider the session context. "\
                           "Return a JSON object with keys: 'medication', 'dose', 'instructions'.",

    "write_referral_letter": "Write referral letter to {to} for {purpose}. "\
                             "Consider the session context. "\
                             "Return a JSON object with keys: 'recipient', 'purpose', 'notes'.",

    "send_email": "Send email to {to} considering the subject of {subject}. "\
                  "Consider session context. "\
                  "Return a JSON object with keys: 'subject_line', 'body'.",

    "book_appointment": "Book appointment with {clinic}, {date} for {reason}. "\
                        "Consider session context. "\
                        "Return a JSON object with keys: 'clinic', 'date', 'reason'.",

    "order_test": "Order test {test_name}. "\
                  "Include session context. "\
                  "Return a JSON object with keys: 'test_name', 'patient_id'.",
}


ACTION_SCHEMA = {
    "print_document": {"title": True, "body": False},  # body optional
    "send_to_lab": {"specimen_type": True, "test": True},  # both required
    "create_prescription": {"medication": True, "dose": False, "instruction": False},  # only medication used in template
    "write_referral_letter": {"to": True, "purpose": True},  # template uses recipient & specialty
    "send_email": {"to": True, "subject": True},  # matches template
    "book_appointment": {"clinic": True, "date": True, "reason": False},  # template uses clinic, date, reason
    "order_test": {"test_name": True},  # template uses test_name only
}


import re
import json

def extract_json_array(raw_text):
    """
    Extract the first JSON array from raw LLM output.
    Raises an error if none found.
    """
    # Look for the first [ ... ] block
    match = re.search(r"(\[\s*{.*?}\s*\])", raw_text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON array found in LLM output:\n{raw_text}")
    return match.group(1)

def decompose_task(task):
    prompt = DECOMPOSE_PROMPT_TEMPLATE.format(
        action_types=", ".join(ACTION_SCHEMA.keys()),
        task=task
    )
    # print("Sending to llm prompt:")
    # print(prompt)
    raw = ask_llm(prompt)
    json_text = extract_json_array(raw)  # <-- safely extract
    # print("Resulting json actions")
    # print(json_text)
    return json.loads(json_text)

def render_action(action):
    """
    Returns:
    - rendered instruction if action is valid (exists in ACTION_PROMPTS and all required args are present)
    - None if invalid
    Also returns list of missing required args or reason for invalidity.
    """
    action_name = action.get("action")
    args = action.get("args", {})

    # Check if action type is recognized
    if action_name not in ACTION_PROMPTS:
        return None, ["invalid_action_type"]

    template = ACTION_PROMPTS[action_name]

    filled_args = {}
    missing_args = []

    for arg_name, required in ACTION_SCHEMA[action_name].items():
        val = args.get(arg_name)
        if val is None:
            if required:
                missing_args.append(arg_name)
                filled_args[arg_name] = ""  # still fill with empty string
            else:
                filled_args[arg_name] = ""
        else:
            # Wrap optional text in parentheses if needed
            if not required:
                filled_args[arg_name] = f" ({val})"
            else:
                filled_args[arg_name] = val

    if missing_args:
        return None, missing_args
    else:
        return template.format(**filled_args), None



# ------------------------------

# task = "Write referral letter to Melvin Associates for endocrinology appointment"

# actions = decompose_task(task)  # Uses LLM

# valid_instructions = []
# invalid_actions = []

# for a in actions:
#     instr, missing = render_action(a)
#     if missing:
#         invalid_actions.append({
#             "action": a,
#             "issues": missing  # can be missing args or "invalid_action_type"
#         })
#     else:
#         valid_instructions.append(instr)

# # Print valid instructions
# print("VALID ACTIONS:")
# for instr in valid_instructions:
#     print("-", instr)

# # Print invalid actions
# print("\nINVALID ACTIONS:")
# for entry in invalid_actions:
#     action_name = entry["action"].get("action", "<missing>")
#     print(f"- Action: {action_name}, Issues: {entry['issues']}")


def process_task(task: str):
    """
    Takes a task string, runs LLM decomposition, renders actions,
    and returns (valid_instructions, invalid_actions).

    valid_instructions: list[(action_dict, instruction_str)]
    invalid_actions: list[{"action": {...}, "issues": [...]}]
    """

    actions = decompose_task(task)  # Uses LLM

    valid_instructions = []
    invalid_actions = []

    for a in actions:
        instr, missing = render_action(a)
        if missing:
            invalid_actions.append({
                "action": a.get('action', "ERROR"),
                "issues": missing
            })
        else:
            # Store both the original action AND the instruction
            valid_instructions.append((a.get('action', "ERROR"), instr))

    return valid_instructions, invalid_actions


    