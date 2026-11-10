#!/usr/bin/env python3
"""One-time conversion of the FDD and TDD Google Docs into Markdown in the repo.

Usage: python3 scripts/design-doc-to-md.py fdd|tdd DOCX OUT_DIR

Runs pandoc (docx -> gfm), then:
- turns each FDD row's two-column field table (Current, Desired, ...) into a
  "- **Field:** value" list,
- strips the padding pandoc puts in pipe tables,
- turns the HTML change-log table into a pipe table in its own changelog.md,
- splits the FDD into one file per view (see SPLIT below).

Kept for the record of how the Markdown was made (10 Nov 2026). After the
migration the Markdown files are the source of truth; do not re-run this over
them.
"""
import html
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

FIELD_LABELS = {"Current", "Desired", "User value", "Acceptance", "Evidence", "Open decision"}

# FDD top-level section number -> file name. Sections not listed go to README.md.
SPLIT = {
    "5": "cross-dashboard.md",
    "6": "summary.md",
    "7": "summary.md",
    "8": "catalog-health.md",
    "9": "ai-search.md",
    "10": "ai-readiness.md",
    "11": "competitive-radar.md",
    "12": "action-items.md",
    "13": "roadmap.md",
    "14": "minimal.md",
    "15": "launch-and-registers.md",
    "16": "launch-and-registers.md",
    "17": "launch-and-registers.md",
    "18": "launch-and-registers.md",
}


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell, self.in_cell = [], None, [], False

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th"):
            self.in_cell, self.cell = True, []
        elif tag == "br" and self.in_cell:
            self.cell.append(" ")
        elif tag == "p" and self.in_cell and self.cell:
            self.cell.append(" ")

    def handle_endtag(self, tag):
        if tag in ("td", "th"):
            self.in_cell = False
            self.row.append(" ".join("".join(self.cell).split()))
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None

    def handle_data(self, data):
        if self.in_cell:
            self.cell.append(data)


def pipe(cells):
    return "| " + " | ".join(c.replace("|", "\\|") for c in cells) + " |"


def html_table_to_pipe(block):
    p = TableParser()
    p.feed(block)
    rows = [[html.unescape(c) for c in r] for r in p.rows if r]
    if not rows:
        return block
    out = [pipe(rows[0]), "|" + "---|" * len(rows[0])]
    out += [pipe(r) for r in rows[1:]]
    return "\n".join(out)


def split_pipe_row(line):
    body = line.strip()[1:-1]
    cells = re.split(r"(?<!\\)\|", body)
    return [c.strip() for c in cells]


def tidy_tables(text):
    lines, out, i = text.split("\n"), [], 0
    while i < len(lines):
        if lines[i].startswith("|"):
            block = []
            while i < len(lines) and lines[i].startswith("|"):
                block.append(lines[i])
                i += 1
            rows = [split_pipe_row(l) for l in block if not re.match(r"^\|[-|: ]+\|?$", l.strip())]
            labels = [re.sub(r"\*", "", r[0]) for r in rows]
            if rows and all(len(r) == 2 for r in rows) and set(labels) <= FIELD_LABELS:
                out += [f"- **{lab}:** {r[1]}" for lab, r in zip(labels, rows)]
            else:
                out.append(pipe(rows[0]))
                out.append("|" + "---|" * len(rows[0]))
                out += [pipe(r) for r in rows[1:]]
        else:
            out.append(lines[i])
            i += 1
    return "\n".join(out)


def convert(docx):
    md = subprocess.run(["pandoc", str(docx), "-t", "gfm", "--wrap=none"],
                        check=True, capture_output=True, text=True).stdout
    md = re.sub(r"<table>.*?</table>", lambda m: html_table_to_pipe(m.group(0)), md, flags=re.S)
    return tidy_tables(md)


def split_sections(md):
    """Yield (top-level number or None, text) for each '# ' section."""
    parts = re.split(r"(?m)^(?=# )", md)
    for part in parts:
        m = re.match(r"# (\d+)\.", part)
        title = part.split("\n", 1)[0]
        yield (m.group(1) if m else None, title, part)


def main():
    kind, docx, out_dir = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    out_dir.mkdir(parents=True, exist_ok=True)
    md = convert(docx)
    files = {}
    for num, title, text in split_sections(md):
        if title.strip() == "# Change log":
            name = "changelog.md"
        elif kind == "fdd" and num in SPLIT:
            name = SPLIT[num]
        else:
            name = "README.md"
        files.setdefault(name, []).append(text.rstrip() + "\n")
    for name, chunks in files.items():
        (out_dir / name).write_text("\n".join(chunks))
        print(name, sum(len(c) for c in chunks))


if __name__ == "__main__":
    main()
