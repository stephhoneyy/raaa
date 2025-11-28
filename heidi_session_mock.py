#!/usr/bin/env python3
"""
Simple Heidi Open API helper script.

- Gets a JWT using your Heidi API key
- Fetches a session by session_id
- Fetches the transcript
- (Optionally) fetches documents and clinical codes
- Extracts mock patient location from profile text / structured address
- Extracts suggested specialties from consult note + transcript

Run:
  python heidi_session_dump.py
"""

import os
import re
import textwrap
from collections import Counter

import requests

BASE_URL = "https://registrar.api.heidihealth.com/api/v2/ml-scribe/open-api"

# ---- CONFIG: FILL THESE IN ----
HEIDI_API_KEY = os.environ.get("HEIDI_API_KEY", "HIztzs28cXhQ3m4rMKYylG77i0bC283U")
EMAIL = os.environ.get("HEIDI_EMAIL", "cher.lyandar@gmail.com")
THIRD_PARTY_ID = os.environ.get("HEIDI_THIRD_PARTY_ID", "1234")

# From the browser URL:
# https://scribe.heidihealth.com/scribe/session/3320...55160#...
SESSION_ID = os.environ.get(
    "HEIDI_SESSION_ID",
    "337851254565527952685384877024185083869"
)

# ---- MOCK ADDRESS ONLY (for dev/testing) ----
# We will keep all *real* patient fields from Heidi, and only use this
# when there is no address on the patient.
MOCK_PATIENT_ADDRESS = {
    "address_line1": "123 Rathdowne St",
    "suburb": "Carlton North",
    "state": "VIC",
    "postcode": "3054",
    "country": "Australia",
}

# ---- SPECIALTY KEYWORDS FOR SIMPLE MAPPING ----
SPECIALTY_KEYWORDS = {
    "infectious diseases": [
        "antiretroviral", "hiv", "abacavir", "tenofovir", "dolutegravir"
    ],
    "oncology": [
        "chemotherapy", "chemotherapeutic", "abemaciclib", "tumour", "tumor", "cancer"
    ],
    "cardiology": [
        "cardiovascular", "heart failure", "beta-blocker", "ace inhibitor",
        "hypertension", "atrial fibrillation", "angina"
    ],
    "psychiatry": [
        "antidepressant", "antipsychotic", "mood stabiliser", "mood stabilizer",
        "bipolar", "anxiety", "depression", "benzodiazepine", "alprazolam"
    ],
    "clinical pharmacology / medication review": [
        "polypharmacy", "medication review", "medication reconciliation",
        "deprescribing"
    ],
    "endocrinology / bone health": [
        "osteoporosis", "fracture risk", "bisphosphonate", "alendronate",
        "denosumab"
    ],
}


# ---- HELPERS FOR LOCATION & SPECIALTIES ----

def apply_mock_address_if_missing(patient: dict) -> dict:
    """
    Return a copy of the patient dict, adding mock address fields only if
    no structured address is present.
    """
    if patient is None:
        patient = {}

    enriched = dict(patient)  # shallow copy

    has_any_address_field = any(
        enriched.get(k) for k in ("address_line1", "suburb", "state", "postcode", "country")
    )

    if not has_any_address_field:
        for k, v in MOCK_PATIENT_ADDRESS.items():
            enriched.setdefault(k, v)

    return enriched


def extract_location_from_patient(patient: dict) -> dict | None:
    """
    Pulls out rough location info (suburb, postcode) from the patient's
    structured address fields first, then from demographic_string / additional_context.

    For now: very simple regex-based parsing on AU-like postcodes and "Suburb VIC 3054".
    """
    if not patient:
        return None

    # 1) Prefer structured address fields if present (real or mock)
    suburb = patient.get("suburb")
    postcode = patient.get("postcode")

    demo = patient.get("demographic_string") or ""
    ctx = patient.get("additional_context") or ""
    text = f"{demo} {ctx}"

    if suburb or postcode:
        return {
            "suburb": suburb,
            "postcode": postcode,
            "raw_text": text,
        }

    # 2) Fallback: parse from demographic_string / additional_context
    if not text.strip():
        return None

    # Naive AU postcode matcher: 2000–6999
    m_pc = re.search(r"\b(2|3|4|5|6)\d{3}\b", text)
    postcode = m_pc.group(0) if m_pc else None

    suburb = None
    if postcode:
        # e.g. "Carlton North VIC 3054"
        m_suburb = re.search(
            r"\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+VIC\s+" + re.escape(postcode),
            text,
        )
        if m_suburb:
            suburb = m_suburb.group(1)

    if not postcode and not suburb:
        return None

    return {
        "suburb": suburb,
        "postcode": postcode,
        "raw_text": text,
    }


def suggest_specialties_from_text(text: str, max_specialties: int = 3) -> list[str]:
    """
    Very simple keyword-based specialty inference from text.

    Looks for keywords defined in SPECIALTY_KEYWORDS and returns up to
    `max_specialties` specialties ranked by match count.
    """
    text_l = text.lower()
    scores = Counter()

    for specialty, keywords in SPECIALTY_KEYWORDS.items():
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw.lower()) + r"\b", text_l):
                scores[specialty] += 1

    if not scores:
        return []

    return [s for s, _ in scores.most_common(max_specialties)]


# ---- HEIDI API HELPERS ----

def get_jwt_token():
    """
    Call /jwt to get a JWT token.
    """
    if not HEIDI_API_KEY or HEIDI_API_KEY == "YOUR_REAL_API_KEY_HERE":
        raise RuntimeError("Please set HEIDI_API_KEY in the script or as an env var.")

    params = {
        "email": EMAIL,
        "third_party_internal_id": THIRD_PARTY_ID,
    }

    headers = {"Heidi-Api-Key": HEIDI_API_KEY}

    print("Requesting JWT token...")
    resp = requests.get(f"{BASE_URL}/jwt", params=params, headers=headers, timeout=30)

    if resp.status_code != 200:
        raise RuntimeError(
            f"JWT request failed: {resp.status_code} {resp.text}"
        )

    data = resp.json()
    token = data.get("token")
    if not token:
        raise RuntimeError(f"No 'token' field in JWT response: {data}")

    print("Got JWT token.")
    return token


def get_session(jwt_token, session_id):
    """
    GET /sessions/{session_id}
    """
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/sessions/{session_id}"
    print(f"\nFetching session details for {session_id}...")
    resp = requests.get(url, headers=headers, timeout=30)

    if resp.status_code != 200:
        raise RuntimeError(
            f"Session request failed: {resp.status_code} {resp.text}"
        )

    return resp.json()


def get_transcript(jwt_token, session_id):
    """
    GET /sessions/{session_id}/transcript
    """
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/sessions/{session_id}/transcript"
    print(f"\nFetching transcript for {session_id}...")
    resp = requests.get(url, headers=headers, timeout=60)

    if resp.status_code != 200:
        raise RuntimeError(
            f"Transcript request failed: {resp.status_code} {resp.text}"
        )

    return resp.json()


def get_documents(jwt_token, session_id):
    """
    GET /sessions/{session_id}/documents
    """
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/sessions/{session_id}/documents"
    print(f"\nFetching documents for {session_id}...")
    resp = requests.get(url, headers=headers, timeout=60)

    if resp.status_code != 200:
        # It's okay if there are no documents, so just log and return None
        print(f"Documents request failed: {resp.status_code} {resp.text}")
        return None

    return resp.json()


def get_clinical_codes(jwt_token, session_id):
    """
    GET /sessions/{session_id}/clinical-codes
    (will only return data if coding is enabled for your org)
    """
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/sessions/{session_id}/clinical-codes"
    print(f"\nFetching clinical codes for {session_id}...")
    resp = requests.get(url, headers=headers, timeout=60)

    if resp.status_code != 200:
        print(f"Clinical codes request failed: {resp.status_code} {resp.text}")
        return None

    return resp.json()


def main():
    print("=== Heidi Session Extract ===")

    print(f"Using email: {EMAIL}")
    print(f"Using third_party_internal_id: {THIRD_PARTY_ID}")
    print(f"Using session_id: {SESSION_ID}")

    # 1. Get JWT token
    jwt_token = get_jwt_token()

    # 2. Fetch session details
    session_data = get_session(jwt_token, SESSION_ID)
    session = session_data.get("session", session_data)

    # Always start from the real patient (if any)
    raw_patient = session.get("patient") or {}
    # Only add mock address fields if real patient has none
    patient = apply_mock_address_if_missing(raw_patient)

    print("\n--- Session summary ---")
    print(f"Session ID : {session.get('session_id')}")
    print(f"Name       : {session.get('session_name')}")
    print(f"Created at : {session.get('created_at')}")
    print(f"Patient    : {patient.get('name')}  (DOB: {patient.get('dob')})")
    print(f"Patient demographic_string : {patient.get('demographic_string')}")
    print(f"Patient additional_context : {patient.get('additional_context')}")

    # Pretty-print patient address (real or mock)
    addr_parts = [
        patient.get("address_line1"),
        patient.get("suburb"),
        patient.get("state"),
        patient.get("postcode"),
        patient.get("country"),
    ]
    addr_str = ", ".join(p for p in addr_parts if p)

    print("\n--- Patient address (structured, real or mock) ---")
    if addr_str:
        print(addr_str)
    else:
        print("No structured address fields on patient.")

    # Extract patient location from profile/address
    loc_info = extract_location_from_patient(patient)
    print("\n--- Patient location extracted ---")
    if loc_info:
        print(f" Suburb   : {loc_info.get('suburb')}")
        print(f" Postcode : {loc_info.get('postcode')}")
    else:
        print(" No location info found on patient.")

    # Try to show clinician notes if present
    clinician_notes = session.get("clinician_notes") or []

    if clinician_notes:
        all_notes_text = " | ".join(str(n) for n in clinician_notes)
        print("\n--- Clinician notes (combined) ---")
        print(textwrap.shorten(all_notes_text, width=2000, placeholder=" ... [truncated]"))
    else:
        print("\n(No clinician notes in this session.)")

    # Try to show consult note if present
    consult_note = session.get("consult_note") or {}
    note_text = consult_note.get("result")
    if note_text:
        print("\n--- Consult note (first 600 chars) ---")
        print(textwrap.shorten(note_text, width=4000, placeholder=" ... [truncated]"))
    else:
        print("\n(No consult note in this session.)")

    # 3. Fetch transcript
    transcript_data = get_transcript(jwt_token, SESSION_ID)
    transcript_text = transcript_data.get("transcript") or transcript_data.get("data")
    if transcript_text:
        print("\n--- Transcript (first 600 chars) ---")
        print(textwrap.shorten(transcript_text, width=600, placeholder=" ... [truncated]"))
    else:
        print("\n(No transcript text returned.)")

    # 3b. Use consult note + transcript to suggest specialties
    combined_text = (note_text or "") + " " + (transcript_text or "")
    specialties = suggest_specialties_from_text(combined_text, max_specialties=3)

    print("\n--- Suggested specialties from consult note + transcript ---")
    if specialties:
        for s in specialties:
            print(" -", s)
    else:
        print(" No specialty keywords detected in text.")

    # 4. Fetch documents (optional)
    documents_data = get_documents(jwt_token, SESSION_ID)
    if documents_data and documents_data.get("documents"):
        print("\n--- Documents ---")
        for doc in documents_data["documents"]:
            print(f"- {doc.get('id')} : {doc.get('name')}")
    else:
        print("\n(No documents found.)")

    # 5. Fetch clinical codes (optional)
    codes_data = get_clinical_codes(jwt_token, SESSION_ID)
    if codes_data and codes_data.get("clinical_entities"):
        print("\n--- Clinical codes (first few) ---")
        for ent in codes_data["clinical_entities"][:5]:
            primary = ent.get("primary_code") or {}
            print(
                f"- {primary.get('code')} "
                f"({primary.get('coding_system')}): "
                f"{primary.get('description')}"
            )
    else:
        print("\n(No clinical codes found or coding not enabled.)")

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
