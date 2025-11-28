#!/usr/bin/env python3
"""
Heidi + Groq: Create Prescribing-Style Letter (AU context)

NOT a legal prescription. Draft summary only.
"""

import os
import re
import json
import textwrap
from datetime import date
from typing import Any, Dict, List, Optional

import requests
from groq import Groq

print("[DEBUG] prescribe_letter.py module imported")

# ================== CONFIG ==================

# --- Groq key: from config.test_key OR GROQ_API_KEY env ---
print("[DEBUG] Resolving Groq API key...")
try:
    from config import test_key as GROQ_API_KEY
    print("[DEBUG] Using config.test_key for GROQ_API_KEY")
except ImportError:
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    print("[DEBUG] Using env GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError(
        "Groq API key not found. "
        "Add test_key to config.py OR set GROQ_API_KEY in your environment."
    )

groq_client = Groq(api_key=GROQ_API_KEY)

# --- Heidi ---
BASE_URL = "https://registrar.api.heidihealth.com/api/v2/ml-scribe/open-api"

HEIDI_API_KEY = os.environ.get("HEIDI_API_KEY", "HIztzs28cXhQ3m4rMKYylG77i0bC283U")
EMAIL = os.environ.get("HEIDI_EMAIL", "cher.lyandar@gmail.com")
THIRD_PARTY_ID = os.environ.get("HEIDI_THIRD_PARTY_ID", "1234")

SESSION_ID = os.environ.get(
    "HEIDI_SESSION_ID",
    "337851254565527952685384877024185083869",
)

TASK_STRING = "Create prescription for appropriate medicines for this patient."

PRESCRIBER_INFO = {
    "name": "Dr Example Clinician",
    "practice_name": "Example Medical Centre",
    "address": "1 Lygon St, Carlton VIC 3053",
    "phone": "(03) 9000 0000",
    "provider_number": "123456A",
    "prescriber_number": "123456",
}

MOCK_PATIENT_ADDRESS = {
    "address_line1": "123 Rathdowne St",
    "suburb": "Carlton North",
    "state": "VIC",
    "postcode": "3054",
    "country": "Australia",
}
USE_MOCK_ADDRESS_IF_EMPTY = True

# ================== GROQ HELPERS ==================

def ask_llm(prompt: str) -> str:
    print("[DEBUG] Calling Groq LLM...")
    chat = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
    )
    return chat.choices[0].message.content

DECOMPOSE_PROMPT_TEMPLATE = """
You are a task planner. Convert the following clinical task
into an array of executable actions.

Rules:
1. Only use these action types: {action_types}
2. For each action, use exactly the arguments listed below.
   - create_prescription: medication (required)

IMPORTANT:
- Output exactly one JSON array of objects.
- Each object must have "action" and "args".
- Do NOT include explanations, notes, or anything else.

Example:
[
  {{
    "action": "create_prescription",
    "args": {{ "medication": "example medicine" }}
  }}
]

Task: "{task}"
"""

ACTION_PROMPTS = {
    "create_prescription": "Create prescription of {medication}. "
                           "Consider the session context provided below. "
                           "Return ONLY a JSON object with keys: "
                           "'medication', 'dose', 'instructions'.",
}

ACTION_SCHEMA = {
    "create_prescription": {"medication": True},
}

def extract_json_array(raw_text: str) -> str:
    match = re.search(r"(\[\s*{.*?}\s*\])", raw_text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON array found in LLM output:\n{raw_text}")
    return match.group(1)

def extract_json_object(raw_text: str) -> Dict[str, Any]:
    match = re.search(r"({.*})", raw_text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in LLM output:\n{raw_text}")
    return json.loads(match.group(1))

def decompose_task(task: str) -> List[Dict[str, Any]]:
    prompt = DECOMPOSE_PROMPT_TEMPLATE.format(
        action_types="create_prescription",
        task=task,
    )
    raw = ask_llm(prompt)
    json_text = extract_json_array(raw)
    return json.loads(json_text)

def run_create_prescription_actions(task: str, session_context: str) -> List[Dict[str, Any]]:
    print("[DEBUG] Decomposing task into actions...")
    actions = decompose_task(task)
    print(f"[DEBUG] Actions: {actions}")

    prescriptions: List[Dict[str, Any]] = []
    for a in actions:
        if a.get("action") != "create_prescription":
            continue

        args = a.get("args", {}) or {}
        med_name = args.get("medication")
        if not med_name:
            continue

        template = ACTION_PROMPTS["create_prescription"]
        base_prompt = template.format(medication=med_name)

        full_prompt = (
            f"{base_prompt}\n\n"
            f"--- SESSION CONTEXT START ---\n"
            f"{session_context}\n"
            f"--- SESSION CONTEXT END ---\n"
        )

        raw = ask_llm(full_prompt)
        presc_obj = extract_json_object(raw)
        prescriptions.append(presc_obj)

    return prescriptions

# ================== HEIDI HELPERS ==================

def get_jwt_token() -> str:
    print("[DEBUG] Getting Heidi JWT...")
    if not HEIDI_API_KEY or HEIDI_API_KEY == "YOUR_REAL_API_KEY_HERE":
        raise RuntimeError("Please set HEIDI_API_KEY.")

    params = {"email": EMAIL, "third_party_internal_id": THIRD_PARTY_ID}
    headers = {"Heidi-Api-Key": HEIDI_API_KEY}
    resp = requests.get(f"{BASE_URL}/jwt", params=params, headers=headers, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"JWT request failed: {resp.status_code} {resp.text}")
    data = resp.json()
    token = data.get("token")
    if not token:
        raise RuntimeError(f"No 'token' field in JWT response: {data}")
    print("[DEBUG] Got Heidi JWT.")
    return token

def get_session(jwt_token: str, session_id: str) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/sessions/{session_id}"
    print(f"[DEBUG] Fetching session {session_id}...")
    resp = requests.get(url, headers=headers, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Session request failed: {resp.status_code} {resp.text}")
    return resp.json()

def get_transcript(jwt_token: str, session_id: str) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/sessions/{session_id}/transcript"
    print(f"[DEBUG] Fetching transcript for {session_id}...")
    resp = requests.get(url, headers=headers, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Transcript request failed: {resp.status_code} {resp.text}")
    return resp.json()

def normalise_patient(patient: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalise Heidi's patient object into the fields our letter expects:
      - name
      - dob
      - address_line1, suburb, state, postcode, country (if present)
    We DO NOT overwrite real data with mock data.
    """
    if patient is None:
        patient = {}
    p = dict(patient)  # shallow copy

    # --- Name ---
    name = (
        p.get("name")
        or p.get("full_name")
        or " ".join(x for x in [p.get("first_name"), p.get("last_name")] if x)
    )
    if name:
        p["name"] = name  # ensure 'name' is filled for the letter

    # --- DOB ---
    dob = p.get("dob") or p.get("date_of_birth")
    if dob:
        p["dob"] = dob  # normalise key

    # You can extend here if Heidi uses other keys, e.g. 'birth_date'

    return p


# ================== PATIENT & LETTER HELPERS ==================

def apply_mock_address_if_missing(patient: Dict[str, Any]) -> Dict[str, Any]:
    if not USE_MOCK_ADDRESS_IF_EMPTY:
        return patient
    enriched = dict(patient)
    has_any = any(
        enriched.get(k) for k in ("address_line1", "suburb", "state", "postcode", "country")
    )
    if not has_any:
        for k, v in MOCK_PATIENT_ADDRESS.items():
            enriched.setdefault(k, v)
    return enriched

def map_heidi_prescription_to_med_item(p: Dict[str, Any]) -> Dict[str, Any]:
    med_name = p.get("medication") or "[medicine name]"
    dose = p.get("dose") or ""
    instructions = p.get("instructions") or ""
    if dose and instructions:
        directions = f"{dose}. {instructions}"
    else:
        directions = dose or instructions or "[dose / instructions]"
    return {
        "name": med_name,
        "strength": "",
        "form": "",
        "directions": directions,
        "quantity": "[quantity]",
        "repeats": "[repeats]",
    }

def build_prescribing_letter(
    patient: Dict[str, Any],
    prescriber: Dict[str, Any],
    consult_note_text: Optional[str],
    medications: List[Dict[str, Any]],
) -> str:
    prescriber_name = prescriber.get("name") or ""
    practice_name = prescriber.get("practice_name") or ""
    prescriber_address = prescriber.get("address") or ""
    prescriber_phone = prescriber.get("phone") or ""
    provider_number = prescriber.get("provider_number") or ""
    prescriber_number = prescriber.get("prescriber_number") or ""

    patient_name = patient.get("name") or "[Patient name]"
    patient_dob = patient.get("dob") or "[DOB]"

    addr_parts = [
        patient.get("address_line1"),
        patient.get("suburb"),
        patient.get("state"),
        patient.get("postcode"),
        patient.get("country"),
    ]
    patient_addr_str = ", ".join(p for p in addr_parts if p) or "[Address]"

    pbs_status = "[PBS/RPBS/general patient – to be confirmed]"
    today_str = date.today().strftime("%d/%m/%Y")

    if not medications:
        meds_block = (
            "1. [Medicine name] [strength] [form]\n"
            "   Sig: [dose, route, frequency, timing]\n"
            "   Qty: [quantity]     Repeats: [number of repeats]\n"
            "\n"
            "   (Add additional items as required.)"
        )
    else:
        lines: List[str] = []
        for idx, m in enumerate(medications, start=1):
            name = m.get("name", "[name]")
            strength = m.get("strength", "")
            form = m.get("form", "")
            line1 = " ".join(part for part in [name, strength, form] if part)
            lines.append(f"{idx}. {line1}")
            directions = m.get("directions", "[dose/route/frequency]")
            lines.append(f"   Sig: {directions}")
            qty = m.get("quantity", "[qty]")
            repeats = m.get("repeats", "[repeats]")
            lines.append(f"   Qty: {qty}     Repeats: {repeats}")
            lines.append("")
        meds_block = "\n".join(lines).rstrip()

    if consult_note_text:
        context_block = textwrap.shorten(
            consult_note_text.replace("\n", " "),
            width=800,
            placeholder=" ... [truncated]",
        )
    else:
        context_block = "[Brief clinical context / indication for treatment]"

    out: List[str] = []
    out.append(f"{practice_name}")
    out.append(f"{prescriber_address}")
    out.append(f"Phone: {prescriber_phone}")
    out.append("")
    out.append(f"Date: {today_str}")
    out.append("")
    out.append(f"Prescriber: {prescriber_name}")
    out.append(f"Provider number: {provider_number}")
    out.append(f"Prescriber number: {prescriber_number}")
    out.append("")
    out.append("=" * 60)
    out.append(" PRESCRIBING SUMMARY (NOT A LEGAL PRESCRIPTION)")
    out.append("=" * 60)
    out.append("")
    out.append("Patient")
    out.append(f"  Name   : {patient_name}")
    out.append(f"  DOB    : {patient_dob}")
    out.append(f"  Address: {patient_addr_str}")
    out.append(f"  PBS status: {pbs_status}")
    out.append("")
    out.append("Prescribed medicine(s)")
    out.append(meds_block)
    out.append("")
    out.append("Clinical context / indication")
    out.append(context_block)
    out.append("")
    out.append("Administrative")
    out.append(f"  Date written : {today_str}")
    out.append("  Signature    : _______________________________")
    out.append("")
    out.append(
        "Note: This document is a generated prescribing-style summary based "
        "on the consultation record and AI-extracted prescription data. "
        "A valid prescription must be issued and signed via an approved "
        "prescribing system."
    )

    return "\n".join(out)

# ================== MAIN ==================

def main() -> None:
    print("=== Heidi Prescription Letter Generator ===")
    print(f"[DEBUG] Using email: {EMAIL}")
    print(f"[DEBUG] Using session_id: {SESSION_ID}")

    jwt_token = get_jwt_token()
    session_data = get_session(jwt_token, SESSION_ID)
    session = session_data.get("session", session_data)

    raw_patient = session.get("patient") or {}

    # First normalise whatever Heidi gave us (name, dob, etc.)
    patient_norm = normalise_patient(raw_patient)

    # Then (optionally) inject mock address ONLY if no address present
    patient = apply_mock_address_if_missing(patient_norm)


    print("\n--- Session summary ---")
    print(f"Session ID : {session.get('session_id')}")
    print(f"Name       : {session.get('session_name')}")
    print(f"Patient    : {patient.get('name')}  (DOB: {patient.get('dob')})")

    consult_note = session.get("consult_note") or {}
    consult_text = consult_note.get("result")
    if consult_text:
        print("\n--- Consult note (first 200 chars) ---")
        print(textwrap.shorten(consult_text, width=200, placeholder=" ... [truncated]"))
    else:
        print("\n(No consult note in this session.)")

    transcript_data = get_transcript(jwt_token, SESSION_ID)
    transcript_text = transcript_data.get("transcript") or transcript_data.get("data") or ""
    if transcript_text:
        print("\n--- Transcript (first 200 chars) ---")
        print(textwrap.shorten(transcript_text, width=200, placeholder=" ... [truncated]"))
    else:
        print("\n(No transcript text returned.)")

    context_pieces = []
    if consult_text:
        context_pieces.append("Consult note:\n" + consult_text)
    if transcript_text:
        context_pieces.append("Transcript excerpt:\n" + transcript_text[:2000])
    session_context = "\n\n".join(context_pieces) or "No additional context."

    print("\n--- Calling Groq to create prescription(s) ---")
    prescription_objs = run_create_prescription_actions(TASK_STRING, session_context)
    print(f"[DEBUG] Prescriptions JSON from Groq: {prescription_objs}")

    medications = [map_heidi_prescription_to_med_item(p) for p in prescription_objs]

    letter_text = build_prescribing_letter(
        patient=patient,
        prescriber=PRESCRIBER_INFO,
        consult_note_text=consult_text,
        medications=medications,
    )

    print("\n--- Prescribing-style letter (draft) ---\n")
    print(letter_text)
    print("\n=== Done ===")

if __name__ == "__main__":
    try:
        print("[DEBUG] __main__ entry reached, calling main()...")
        main()
    except Exception as e:
        import traceback
        print("\n[ERROR] Unhandled exception in prescribe_letter.py:")
        traceback.print_exc()
