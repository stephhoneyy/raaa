#!/usr/bin/env python3
"""
Heidi + Groq: Create Prescribing-Style Letter (AU context)

- Fetches session + transcript from Heidi
- Uses existing task_to_action_parsing.decompose_task() to get actions
- Extracts create_prescription actions and builds a prescribing-style letter
  (NOT a legal prescription).

Dose and instructions are OPTIONAL:
- If the LLM can't safely infer them, it should set them to null or omit them.
"""

import os
import json
import textwrap
from datetime import date
from typing import Any, Dict, List, Optional

import requests

from task_to_action_parsing import decompose_task
from heidi_secrets import (
    HEIDI_API_KEY,
    HEIDI_EMAIL,
    HEIDI_THIRD_PARTY_ID,
    DEFAULT_SESSION_ID,
)

# ================== CONFIG ==================

BASE_URL = "https://registrar.api.heidihealth.com/api/v2/ml-scribe/open-api"

# Allow overriding these via environment variables if you want
EMAIL = os.environ.get("HEIDI_EMAIL", HEIDI_EMAIL)
THIRD_PARTY_ID = os.environ.get("HEIDI_THIRD_PARTY_ID", HEIDI_THIRD_PARTY_ID)
SESSION_ID = os.environ.get("HEIDI_SESSION_ID", DEFAULT_SESSION_ID)

# High-level instruction to the LLM
TASK_STRING = "Create prescription for appropriate medicines for this patient."

# ---- Prescriber details (non-secret sample data; replace with real if needed) ----
PRESCRIBER_INFO = {
    "name": "Dr Example Clinician",
    "practice_name": "Example Medical Centre",
    "address": "1 Lygon St, Carlton VIC 3053",
    "phone": "(03) 9000 0000",
    "provider_number": "123456A",
    "prescriber_number": "123456",
}

# ---- Mock address for testing only ----
MOCK_PATIENT_ADDRESS = {
    "address_line1": "123 Rathdowne St",
    "suburb": "Carlton North",
    "state": "VIC",
    "postcode": "3054",
    "country": "Australia",
}
USE_MOCK_ADDRESS_IF_EMPTY = True

# Limit how many meds we keep from the LLM
MAX_PRESCRIPTIONS = 5

# ================== HEIDI HELPERS ==================


def get_jwt_token() -> str:
    if not HEIDI_API_KEY or HEIDI_API_KEY == "YOUR_REAL_HEIDI_API_KEY":
        raise RuntimeError("Please set HEIDI_API_KEY in secrets.py or .env")
    params = {"email": EMAIL, "third_party_internal_id": THIRD_PARTY_ID}
    headers = {"Heidi-Api-Key": HEIDI_API_KEY}
    resp = requests.get(f"{BASE_URL}/jwt", params=params, headers=headers, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"JWT request failed: {resp.status_code} {resp.text}")
    data = resp.json()
    token = data.get("token")
    if not token:
        raise RuntimeError(f"No 'token' field in JWT response: {data}")
    return token


def get_session(jwt_token: str, session_id: str) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/sessions/{session_id}"
    resp = requests.get(url, headers=headers, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Session request failed: {resp.status_code} {resp.text}")
    return resp.json()


def get_transcript(jwt_token: str, session_id: str) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/sessions/{session_id}/transcript"
    resp = requests.get(url, headers=headers, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Transcript request failed: {resp.status_code} {resp.text}")
    return resp.json()


# ================== PATIENT HELPERS ==================


def normalise_patient(patient: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalise Heidi's patient object into:
      - name
      - dob
      - address_line1 / suburb / state / postcode / country (if present)
    """
    if patient is None:
        patient = {}
    p = dict(patient)

    # Name
    name = (
        p.get("name")
        or p.get("full_name")
        or " ".join(x for x in [p.get("first_name"), p.get("last_name")] if x)
    )
    if name:
        p["name"] = name

    # DOB
    dob = p.get("dob") or p.get("date_of_birth") or p.get("birth_date")
    if dob:
        p["dob"] = dob

    return p


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


# ================== PRESCRIPTION HELPERS ==================


def get_prescriptions_from_llm(task: str, session_context: str) -> List[Dict[str, Any]]:
    """
    Uses task_to_action_parsing.decompose_task() with the session context
    baked into the task string. Then:

    - Keeps only create_prescription actions
    - Requires medication name to appear in the context (to reduce hallucinations)
    - Drops entries with neither dose nor instructions
    - Deduplicates by medication name
    - Caps total meds at MAX_PRESCRIPTIONS
    """
    combined_task = f"{task}\n\nSESSION CONTEXT:\n{session_context}"
    actions = decompose_task(combined_task)

    context_l = session_context.lower()
    seen_names: set[str] = set()
    meds: List[Dict[str, Any]] = []

    for a in actions:
        if a.get("action") != "create_prescription":
            continue

        args = a.get("args") or {}
        med = (args.get("medication") or "").strip()
        if not med:
            continue

        med_l = med.lower()

        # Require that the med name appears in the context at least once
        if med_l not in context_l:
            continue

        # Dose / instructions are optional
        dose_raw = args.get("dose")
        # The schema has a typo "instruction" so we check both
        instr_raw = args.get("instructions") or args.get("instruction")

        dose = "" if dose_raw is None else str(dose_raw).strip()
        instr = "" if instr_raw is None else str(instr_raw).strip()

        # Drop entries with neither dose nor instructions
        if not dose and not instr:
            continue

        if med_l in seen_names:
            continue
        seen_names.add(med_l)

        meds.append(
            {
                "medication": med,
                "dose": dose,
                "instructions": instr,
            }
        )

        if len(meds) >= MAX_PRESCRIPTIONS:
            break

    return meds


def map_prescription_to_med_item(p: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map create_prescription JSON into the letter medication line.
    dose/instructions are optional.
    """
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


# ================== LETTER BUILDER ==================


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

    patient_name = patient.get("name") or ""
    patient_dob = patient.get("dob") or ""

    addr_parts = [
        patient.get("address_line1"),
        patient.get("suburb"),
        patient.get("state"),
        patient.get("postcode"),
        patient.get("country"),
    ]
    patient_addr_str = ", ".join(p for p in addr_parts if p) or "[Address]"
    today_str = date.today().strftime("%d/%m/%Y")

    # Medications block
    if not medications:
        meds_block = "No medication prescribed."
    else:
        lines: List[str] = []
        for idx, m in enumerate(medications, start=1):
            name = m.get("name", "[name]"
            )
            strength = m.get("strength", "")
            form = m.get("form", "")
            line1 = " ".join(part for part in [name, strength, form] if part)
            lines.append(f"{idx}. {line1}")
            directions = m.get("directions", "[dose/route/frequency]")
            lines.append(f"   Sig: {directions}")
            lines.append(f"   Qty:           Repeats:      ")
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

    # 1. Heidi: session + transcript
    jwt_token = get_jwt_token()
    session_data = get_session(jwt_token, SESSION_ID)
    session = session_data.get("session", session_data)

    raw_patient = session.get("patient") or {}
    patient_norm = normalise_patient(raw_patient)
    patient = apply_mock_address_if_missing(patient_norm)

    consult_note = session.get("consult_note") or {}
    consult_text = consult_note.get("result") or ""

    transcript_data = get_transcript(jwt_token, SESSION_ID)
    transcript_text = transcript_data.get("transcript") or transcript_data.get("data") or ""

    # Debug summary
    print("\n--- Session summary ---")
    print(f"Session ID : {session.get('session_id')}")
    print(f"Session name : {session.get('session_name')}")
    print(f"Patient    : {patient.get('name')}  (DOB: {patient.get('dob')})")

    if consult_text:
        print("\n--- Consult note (first 200 chars) ---")
        print(textwrap.shorten(consult_text, width=500, placeholder=" ... [truncated]"))

    if transcript_text:
        print("\n--- Transcript (first 200 chars) ---")
        print(textwrap.shorten(transcript_text, width=500, placeholder=" ... [truncated]"))

    # 2. Build context for LLM
    context_pieces = []
    if consult_text:
        context_pieces.append("Consult note:\n" + consult_text)
    if transcript_text:
        context_pieces.append("Transcript excerpt:\n" + transcript_text[:2000])
    session_context = "\n\n".join(context_pieces) or "No additional context."

    # 3. Single LLM call via decompose_task → prescriptions
    print("\n--- Calling Groq (via task_to_action_parsing) to create prescription actions ---")
    prescription_objs = get_prescriptions_from_llm(TASK_STRING, session_context)

    medications = [map_prescription_to_med_item(p) for p in prescription_objs]

    # 4. Build letter
    letter_text = build_prescribing_letter(
        patient=patient,
        prescriber=PRESCRIBER_INFO,
        consult_note_text=consult_text,
        medications=medications,
    )

    print("\n--- Prescribing-style letter ---\n")
    print(letter_text)
    print("\n=== Done ===")


if __name__ == "__main__":
    main()
