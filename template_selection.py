"""
Selects a template to use by calling Heidi api using a prompt and a session as context
"""

#!/usr/bin/env python3
"""
Simple Heidi Open API helper script.

- Gets a JWT using your Heidi API key
- Fetches a session by session_id
- Fetches the transcript
- (Optionally) fetches documents and clinical codes

Run:
  python heidi_session_dump.py
"""

import os
import textwrap
import requests
import json

BASE_URL = "https://registrar.api.heidihealth.com/api/v2/ml-scribe/open-api"

# ---- CONFIG: FILL THESE IN ----
HEIDI_API_KEY = os.environ.get("HEIDI_API_KEY", "HIztzs28cXhQ3m4rMKYylG77i0bC283U")
EMAIL = os.environ.get("HEIDI_EMAIL", "ferdinantodaniel@gmail.com")
THIRD_PARTY_ID = os.environ.get("HEIDI_THIRD_PARTY_ID", "12345")

# From the browser URL:
# https://scribe.heidihealth.com/scribe/session/3320...55160#...
SESSION_ID = os.environ.get(
    "HEIDI_SESSION_ID",
    # "75033324869996810677299265415934259470"
    "209429578973190336673242710141917128963"
)


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

def get_transcript_text(jwt_token, session_id):
    transcript_data = get_transcript(jwt_token, session_id)
    transcript_text = transcript_data.get("transcript") or transcript_data.get("data")
    return transcript_text

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

def get_document_templates(jwt_token):
    """
    GET /templates/document-templates
    Returns global Consult Note + Document templates.
    """
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{BASE_URL}/templates/document-templates"

    print("\nFetching global document templates...")
    resp = requests.get(url, headers=headers, timeout=60)

    if resp.status_code != 200:
        raise RuntimeError(
            f"Template request failed: {resp.status_code} {resp.text}"
        )

    return resp.json()

def post_document(jwt_token, session_id, template_id=None, voice_style="GOLDILOCKS",
                  brain="LEFT", content_type="MARKDOWN"):
    """
    POST /sessions/{session_id}/documents
    Creates an empty document for the session.
    
    Parameters:
        jwt_token (str): Your authentication token
        session_id (str): The session to create the document in
        template_id (str, optional): Required if generation_method is TEMPLATE
        voice_style (str, optional): GOLDILOCKS, DETAILED, BRIEF, SUPER_DETAILED, MY_VOICE
        brain (str, optional): LEFT or RIGHT
        content_type (str, optional): MARKDOWN or HTML
    """
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "document_tab_type": "DOCUMENT",
        "generation_method": "TEMPLATE",
        "brain": brain,
        "content_type": content_type
    }

    if template_id:
        payload["template_id"] = template_id
    if voice_style:
        payload["voice_style"] = voice_style

    url = f"{BASE_URL}/sessions/{session_id}/documents"

    print(f"\nCreating document in session {session_id}...")
    resp = requests.post(url, headers=headers, json=payload, timeout=60)

    if resp.status_code != 200 and resp.status_code != 201:
        print(f"Document creation failed: {resp.status_code} {resp.text}")
        return None

    print("Document created successfully!")
    return resp.json()

def ask_heidi(jwt_token, session_id, command_text, content=""):
    """
    POST /sessions/{session_id}/ask-ai
    Streams AI output.
    """
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }

    url = f"{BASE_URL}/sessions/{session_id}/ask-ai"

    payload = {
        "ai_command_text": command_text,
        "content": content,
        "content_type": "MARKDOWN"
    }

    print("\nSending Ask Heidi request...")

    resp = requests.post(url, headers=headers, json=payload, stream=True)

    if resp.status_code != 200:
        raise RuntimeError(
            f"Ask Heidi failed: {resp.status_code} {resp.text}"
        )

    # Collect streamed chunks
    final_output = ""

    for line in resp.iter_lines():
        if not line:
            continue

        decoded = line.decode("utf-8")

        # Heidi streams as Server-Sent Events:  data: {...}
        if decoded.startswith("data: "):
            decoded = decoded.replace("data: ", "", 1)

        try:
            json_line = json.loads(decoded)
            if "data" in json_line:
                final_output += json_line["data"]
        except json.JSONDecodeError:
            print("Skipping malformed chunk:", decoded)
            continue

    return final_output

def generate_template(jwt_token, session_id):
    transcript = get_transcript_text(jwt_token, session_id)
    template = ask_heidi(jwt_token, session_id, "Generate an appropriate template for the following transcript to be attached to an email:", transcript)
    return template



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

    # print("\n--- Session summary ---")
    # print(f"Session ID : {session.get('session_id')}")
    # print(f"Name       : {session.get('session_name')}")
    # print(f"Created at : {session.get('created_at')}")
    # patient = session.get("patient") or {}
    # print(f"Patient    : {patient.get('name')}  (DOB: {patient.get('dob')})")

    # Try to show consult note if present
    # consult_note = session.get("consult_note") or {}
    # note_text = consult_note.get("result")
    # if note_text:
    #     print("\n--- Consult note (first 1200 chars) ---")
    #     print(textwrap.shorten(note_text, width=1200, placeholder=" ... [truncated]"))
    # else:
    #     print("\n(No consult note in this session.)")

    # 3. Fetch transcript
    # transcript_data = get_transcript(jwt_token, SESSION_ID)
    # transcript_text = transcript_data.get("transcript") or transcript_data.get("data")
    # if transcript_text:
    #     print("\n--- Transcript (first 600 chars) ---")
    #     # print(transcript_text)
    #     print(textwrap.shorten(transcript_text, width=1000, placeholder=" ... [truncated]"))
    # else:
    #     print("\n(No transcript text returned.)")

    # 4. Fetch documents (optional)
    # documents_data = get_documents(jwt_token, SESSION_ID)
    # if documents_data and documents_data.get("documents"):
    #     print("\n--- Documents ---")
    #     for doc in documents_data["documents"]:
    #         print(f"- Document ID   : {doc.get('id')}")
    #         print(f"  Name          : {doc.get('name')}")
    #         print(f"  Template ID   : {doc.get('template_id')}")
    #         print(f"  Content       : {doc.get('content', '')[:80]}...")  # show first 80 chars
    #         print(f"  Session ID    : {SESSION_ID}\n")
    # else:
    #     print("\n(No documents found.)")


    # 5. Fetch clinical codes (optional)
    # codes_data = get_clinical_codes(jwt_token, SESSION_ID)
    # if codes_data and codes_data.get("clinical_entities"):
    #     print("\n--- Clinical codes (first few) ---")
    #     for ent in codes_data["clinical_entities"][:5]:
    #         primary = ent.get("primary_code") or {}
    #         print(
    #             f"- {primary.get('code')} "
    #             f"({primary.get('coding_system')}): "
    #             f"{primary.get('description')}"
    #         )
    # else:
    #     print("\n(No clinical codes found or coding not enabled.)")

    # 6. Fetch global templates
    # templates_data = get_document_templates(jwt_token)

    # templates = templates_data.get("templates", [])
    # if templates:
    #     print("\n--- Available Global Templates ---")
    #     for t in templates:
    #         print(f"- {t['name']} (ID: {t['id']})")
    #         print(f"  Category: {t.get('template_category')}")
    #         print(f"  Preview: {t.get('structure_template', '')[:80]}...\n")
    # else:
    #     print("\n(No global templates returned.)")

    # 7. Ask Heidi to generate an email for X-ray appointment
    # email_prompt = (
    #     "Summarize the following piece of text."
    # )

    # prompt_content = """

    # """

    # email_template = ask_heidi(jwt_token, SESSION_ID, email_prompt, prompt_content)

    # print("\n--- Generated Patient Email Template ---\n")
    # print(email_template)

    # 8. Upload a document to the session
    # template_id = "692200549bc42131a13f4379"  # provided template ID

    # uploaded_doc = post_document(
    #     jwt_token=jwt_token,
    #     session_id=SESSION_ID,
    #     template_id=template_id,
    #     voice_style="GOLDILOCKS",   # optional, can change
    #     brain="LEFT",               # optional, can change
    #     content_type="MARKDOWN"     # optional, can change
    # )

    # if uploaded_doc:
    #     print("\n--- Document Uploaded Successfully ---")
    #     print(f"Document ID: {uploaded_doc.get('id')}")
    #     print(f"Document URL: {uploaded_doc.get('url', 'N/A')}")
    # else:
    #     print("\nDocument upload failed.")


    from task_to_action_parsing import process_task

    mock_task_1 = "Arrange staging CT scan to determine extent of cancer"
    mock_task_2 = "Refer patient to oncology unit to discuss chemotherapy"
    mock_task_3 = "Schedule CT scan as soon as possible"

    for task in [mock_task_1, mock_task_2, mock_task_3]:
        print(f"\n=== Task: {task} ===")

        valid_actions, invalid_actions = process_task(task)

        print("\nVALID ACTIONS:")
        for action_instruction in valid_actions:
            print("-", action_instruction)

            # --- NEW: Directly use action_instruction as the command_text ---
            template_output = ask_heidi(
                jwt_token,
                SESSION_ID,
                command_text=action_instruction,
                content=""           # empty content
            )

            print("\n--- Heidi Output ---")
            print(template_output)
            print("--------------------------------------------------")

        print("\nINVALID ACTIONS:")
        for entry in invalid_actions:
            print("-", entry)


    print("\n=== Done ===")


if __name__ == "__main__":
    main()
