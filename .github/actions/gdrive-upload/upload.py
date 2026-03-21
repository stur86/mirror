#!/usr/bin/env python3
"""Upload a file to Google Drive using a service account."""

import json
import os
import sys
import base64

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2 import service_account


def get_credentials(raw: str) -> service_account.Credentials:
    """Parse credentials from raw JSON or base64-encoded JSON."""
    raw = raw.strip()
    try:
        info = json.loads(raw)
    except json.JSONDecodeError:
        try:
            info = json.loads(base64.b64decode(raw).decode("utf-8"))
        except Exception:
            print("ERROR: Could not parse credentials as JSON or base64-encoded JSON.", file=sys.stderr)
            sys.exit(1)

    scopes = ["https://www.googleapis.com/auth/drive"]
    return service_account.Credentials.from_service_account_info(info, scopes=scopes)


def find_existing_file(service, name: str, folder_id: str) -> str | None:
    """Return the file ID of an existing file with this name in the folder, or None."""
    query = (
        f"name = '{name}' and '{folder_id}' in parents and trashed = false"
    )
    result = service.files().list(q=query, fields="files(id, name)").execute()
    files = result.get("files", [])
    return files[0]["id"] if files else None


def upload(credentials_raw: str, filename: str, folder_id: str, overwrite: bool) -> None:
    creds = get_credentials(credentials_raw)
    service = build("drive", "v3", credentials=creds)

    basename = os.path.basename(filename)
    media = MediaFileUpload(filename, resumable=True)

    existing_id = find_existing_file(service, basename, folder_id)

    if existing_id and overwrite:
        print(f"Overwriting existing file '{basename}' (id={existing_id})")
        file = service.files().update(
            fileId=existing_id,
            media_body=media,
            fields="id, name",
        ).execute()
    else:
        if existing_id:
            print(f"File '{basename}' exists but overwrite=false; uploading new copy.")
        else:
            print(f"Uploading new file '{basename}'.")
        metadata = {"name": basename, "parents": [folder_id]}
        file = service.files().create(
            body=metadata,
            media_body=media,
            fields="id, name",
        ).execute()

    print(f"Done. File id: {file['id']}, name: {file['name']}")


if __name__ == "__main__":
    credentials_raw = os.environ.get("INPUT_CREDENTIALS", "")
    filename = os.environ.get("INPUT_FILENAME", "")
    folder_id = os.environ.get("INPUT_FOLDER_ID", "")
    overwrite = os.environ.get("INPUT_OVERWRITE", "false").lower() in ("true", "1", "yes")

    if not credentials_raw:
        print("ERROR: INPUT_CREDENTIALS is required.", file=sys.stderr)
        sys.exit(1)
    if not filename:
        print("ERROR: INPUT_FILENAME is required.", file=sys.stderr)
        sys.exit(1)
    if not folder_id:
        print("ERROR: INPUT_FOLDER_ID is required.", file=sys.stderr)
        sys.exit(1)

    upload(credentials_raw, filename, folder_id, overwrite)
