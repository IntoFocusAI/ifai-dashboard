#!/usr/bin/env python3
"""Print an https URL for a local file that Google Drive can download.

Stdout is the URL and nothing else. The Project Manager passes that URL to
google_drive-update-file. The bytes at the URL match the local file.

The host keeps the file for about an hour. Do not print the URL in a reply.

A network error, timeout, dropped connection, SSL error, HTTP 5xx, 408, or
429, or a download that does not match is retried after 5, 15, and 45
seconds. Retry notes go to stderr. After the last attempt it prints one
error line and exits 1. Any other 4xx upload answer fails at once with the
host's message: the host refuses some file names (a one-letter name such as
f.docx gets "Invalid file name."), and retrying will not change that.
"""

from __future__ import annotations

import hashlib
import http.client
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

UPLOAD_URL = "https://tmpfiles.org/api/v1/upload"
USER_AGENT = "Mozilla/5.0"
DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
RETRY_DELAYS = (5, 15, 45)


class StageError(Exception):
    def __init__(self, message: str, retry: bool = True):
        super().__init__(message)
        self.retry = retry


def http_error(step: str, status: int, raw: bytes) -> StageError:
    try:
        detail = json.loads(raw.decode()).get("message", "")
    except (ValueError, AttributeError):
        detail = ""
    message = f"{step} failed with HTTP {status}" + (f": {detail}" if detail else "")
    return StageError(message, retry=status >= 500 or status in (408, 429))


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def request(url: str, data: bytes | None = None, headers: dict[str, str] | None = None) -> tuple[int, str, bytes]:
    req_headers = {"User-Agent": USER_AGENT}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            body = response.read()
            return response.status, response.headers.get("content-type", ""), body
    except urllib.error.HTTPError as error:
        try:
            body = error.read()
        except (http.client.HTTPException, OSError):
            body = b""
        return error.code, error.headers.get("content-type", ""), body
    except (http.client.HTTPException, OSError) as error:
        reason = getattr(error, "reason", None) or error
        raise StageError(f"request failed: {type(reason).__name__}: {reason}") from error


def upload(path: str) -> str:
    filename = os.path.basename(path)
    payload = open(path, "rb").read()
    boundary = "----stageDesignDocx"
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            (
                f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                f"Content-Type: {DOCX_TYPE}\r\n\r\n"
            ).encode(),
            payload,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    status, _content_type, raw = request(
        UPLOAD_URL,
        body,
        {"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    if not 200 <= status < 300:
        raise http_error("upload", status, raw)
    try:
        page = json.loads(raw.decode())["data"]["url"]
    except (json.JSONDecodeError, KeyError, TypeError):
        raise StageError("upload response had no page URL")
    if not isinstance(page, str) or not page.startswith("https://tmpfiles.org/"):
        raise StageError("upload response page URL was not usable")
    return page


def direct_url(page_url: str) -> str:
    status, _content_type, raw = request(page_url)
    if status != 200:
        raise StageError(f"download page failed with HTTP {status}")
    match = re.search(r"https://tmpfiles\.org/dl/[^\"'\s<]+", raw.decode("utf-8", "replace"))
    if not match:
        raise StageError("download page had no direct file link")
    return match.group(0).replace("&amp;", "&")


def assert_same_bytes(url: str, path: str) -> None:
    expected = open(path, "rb").read()
    status, content_type, actual = request(url)
    if status != 200:
        raise StageError(f"direct download failed with HTTP {status}")
    if "html" in content_type.lower() or not actual.startswith(b"PK"):
        raise StageError("direct download was not the docx")
    if hashlib.sha256(actual).digest() != hashlib.sha256(expected).digest():
        raise StageError("direct download did not match the local file")


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: python3 scripts/stage-design-docx.py path/to/file.docx")
    path = sys.argv[1]
    if not os.path.isfile(path):
        fail(f"file not found: {path}")
    attempts = len(RETRY_DELAYS) + 1
    last_error = "upload did not produce a matching download"
    for attempt in range(1, attempts + 1):
        try:
            url = direct_url(upload(path))
            assert_same_bytes(url, path)
            print(url)
            return
        except StageError as error:
            last_error = " ".join(str(error).split())
            if not error.retry:
                fail(f"staging failed: {last_error}")
        if attempt < attempts:
            delay = RETRY_DELAYS[attempt - 1]
            print(f"attempt {attempt} of {attempts} failed: {last_error}. Retrying in {delay}s.", file=sys.stderr)
            time.sleep(delay)
    fail(f"staging failed after {attempts} attempts: {last_error}")


if __name__ == "__main__":
    main()
