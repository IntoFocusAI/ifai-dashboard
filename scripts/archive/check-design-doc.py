#!/usr/bin/env python3
"""Confirm a public Google Doc export matches a local docx.

Usage:
  python3 scripts/check-design-doc.py FILE_ID path/to/file.docx

Exit 0 prints the first paragraph. Exit 1 prints the first difference.
Google rewrites zip bytes on export, so this compares paragraph text,
the header, and the footer.
"""

from __future__ import annotations

import sys
import urllib.error
import urllib.request
import zipfile
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
USER_AGENT = "Mozilla/5.0"


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def part_text(archive: zipfile.ZipFile, name: str) -> str:
    if name not in archive.namelist():
        return ""
    root = ET.fromstring(archive.read(name))
    return "".join(node.text or "" for node in root.iter(NS + "t"))


def read_docx(path: str) -> tuple[list[str], str, str]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
        paragraphs = [
            "".join(node.text or "" for node in paragraph.iter(NS + "t"))
            for paragraph in root.iter(NS + "p")
        ]
        headers = "".join(
            part_text(archive, name)
            for name in sorted(archive.namelist())
            if name.startswith("word/header") and name.endswith(".xml")
        )
        footers = "".join(
            part_text(archive, name)
            for name in sorted(archive.namelist())
            if name.startswith("word/footer") and name.endswith(".xml")
        )
    return paragraphs, headers, footers


def download_export(file_id: str, dest: str) -> None:
    url = f"https://docs.google.com/document/d/{file_id}/export?format=docx"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            data = response.read()
    except urllib.error.HTTPError as error:
        fail(f"export failed with HTTP {error.code}")
    if not data.startswith(b"PK"):
        fail("export was not a docx. The Google Doc may not be link-shared.")
    with open(dest, "wb") as handle:
        handle.write(data)


def first_difference(live: list[str], local: list[str]) -> str | None:
    count = max(len(live), len(local))
    for index in range(count):
        left = live[index] if index < len(live) else "<missing>"
        right = local[index] if index < len(local) else "<missing>"
        if left != right:
            return f"paragraph {index}\n  live:  {left[:240]}\n  local: {right[:240]}"
    return None


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: python3 scripts/check-design-doc.py FILE_ID path/to/file.docx")
    file_id, local_path = sys.argv[1], sys.argv[2]
    export_path = "/tmp/design-doc-export.docx"
    download_export(file_id, export_path)
    live_paragraphs, live_header, live_footer = read_docx(export_path)
    local_paragraphs, local_header, local_footer = read_docx(local_path)
    difference = first_difference(live_paragraphs, local_paragraphs)
    if difference:
        fail(difference)
    if live_header != local_header:
        fail("header text differs")
    if live_footer != local_footer:
        fail("footer text differs")
    print(live_paragraphs[0] if live_paragraphs else "")


if __name__ == "__main__":
    main()
