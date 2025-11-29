from flask import Flask, redirect, request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import os, pathlib, base64

from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
import base64

from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus.flowables import Flowable
from io import BytesIO

import requests

from heidi_client import *

from typing import List

def create_pdf_bytes(text: str) -> bytes:
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    
    doc = SimpleDocTemplate(buffer)
    content = [Paragraph(text, styles["Normal"])]

    # Tell the type checker this is a list of Flowable
    story: List[Flowable] = [
        Paragraph(text, styles["Normal"])
    ]


    doc.build(story)

    # Get the raw PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

app = Flask(__name__)
app.secret_key = "random_secret"

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

GOOGLE_CLIENT_SECRET_FILE = "client_secret.json"
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
REDIRECT_URI = "http://localhost:8000/auth/callback"

flow = Flow.from_client_secrets_file(
    GOOGLE_CLIENT_SECRET_FILE, scopes=SCOPES, redirect_uri=REDIRECT_URI
)

creds = None  # store temporarily


@app.get("/auth/google")
def auth_google():
    authorization_url, _ = flow.authorization_url(prompt="consent")
    return redirect(authorization_url)


@app.get("/auth/callback")
def auth_callback():
    global creds
    flow.fetch_token(authorization_response=request.url)
    creds = flow.credentials
    return "Success! You can close this tab and click 'Send Email' in your test page."

@app.post("/send")
def send_email():
    global creds
    if creds is None:
        return "No credentials — click Connect Gmail first."

    data = request.json
    if not data:
        return "Expected JSON body.", 400

    to = data.get("recipient")
    subject = data.get("subject_line")
    content_text = data.get("content")
    pdf_body_text = data.get("body")

    if not to or not subject or not content_text or not pdf_body_text:
        return "Missing one or more required fields.", 400

    # Build Gmail service
    service = build("gmail", "v1", credentials=creds)

    # Create email container
    message = MIMEMultipart()
    message["to"] = to
    message["subject"] = subject

    # Add email body
    message.attach(MIMEText(content_text, "plain"))

    # Generate PDF bytes with the text in "body"
    pdf_bytes = create_pdf_bytes(pdf_body_text)

    # Attach PDF
    pdf_part = MIMEApplication(pdf_bytes, _subtype="pdf")
    pdf_part.add_header("Content-Disposition", "attachment", filename="attachment.pdf")
    message.attach(pdf_part)

    # Encode message for Gmail API
    encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

    send_result = service.users().messages().send(
        userId="me",
        body={"raw": encoded_message}
    ).execute()

    return "Email sent successfully!"


if __name__ == "__main__":
    app.run(port=8000, debug=True)
