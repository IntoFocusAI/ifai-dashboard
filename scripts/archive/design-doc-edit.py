#!/usr/bin/env python3
"""Edit the Functional and Technical Design Document .docx files.

Every edit command reads the .docx, makes one change, and saves it in place
(or to --out). Nothing is saved when a command fails. Text arguments may be
"-" to read the text from stdin. A newline in set text starts a new paragraph.

  python3 scripts/design-doc-edit.py download fdd /tmp/fdd.docx
  python3 scripts/design-doc-edit.py rows /tmp/fdd.docx
  python3 scripts/design-doc-edit.py show /tmp/fdd.docx X-21
  python3 scripts/design-doc-edit.py set-version /tmp/fdd.docx 21.9 [--date "November 5, 2026"]
  python3 scripts/design-doc-edit.py set-status /tmp/fdd.docx X-21 CURRENT [--phase Launch]
  python3 scripts/design-doc-edit.py get /tmp/fdd.docx X-21 Evidence
  python3 scripts/design-doc-edit.py set /tmp/fdd.docx X-21 Evidence "Live. ..."
  python3 scripts/design-doc-edit.py append /tmp/fdd.docx X-21 Evidence "PR 140." [--paragraph]
  python3 scripts/design-doc-edit.py replace /tmp/fdd.docx X-21 Evidence "Not live." "Live."
  python3 scripts/design-doc-edit.py clone /tmp/fdd.docx X-21 X-22 X-32 [--status TARGET] [--phase Launch]
  python3 scripts/design-doc-edit.py changelog /tmp/fdd.docx CHANGE REASON REFERENCE [--date 2026-11-05]
  python3 scripts/design-doc-edit.py add-row /tmp/fdd.docx trace X-32 TARGET "None" "Not tested" [--after X-31]
  python3 scripts/design-doc-edit.py set-cell /tmp/fdd.docx trace X-21 Status CURRENT
  python3 scripts/design-doc-edit.py replace-all /tmp/fdd.docx "old text" "new text"
  python3 scripts/design-doc-edit.py diff /tmp/fdd-live.docx /tmp/fdd.docx
  python3 scripts/design-doc-edit.py plan /tmp/fdd-live.docx /tmp/fdd.docx [--no-keep-history] > /tmp/plan.txt
  python3 scripts/design-doc-edit.py pub /tmp/fdd.docx /tmp/pub.docx --split 'Date|Change|Reason|Reference:1'
  python3 scripts/design-doc-edit.py selftest

plan prints numbered Google-docs plugin calls that turn the live doc into the
edited copy, checked against a simulation of every call. pub writes the copy
the way those calls leave the live doc (appended rows in their own table) so
check-design-doc.py can compare it; plan prints the --split arguments to use.

Fields are Current, Desired, User value, Acceptance, Evidence, Open decision,
and Status source. A row keeps them either in a two-column table or as
alternating label and value paragraphs; both layouts work the same way.

Table names for add-row and set-cell: changelog, fields, decision, later,
trace, tdd-trace, or the leading header cells joined by "|" (e.g. "ID|Decision").

Import from Python:

  import importlib.util
  spec = importlib.util.spec_from_file_location("dde", "scripts/design-doc-edit.py")
  dde = importlib.util.module_from_spec(spec); spec.loader.exec_module(dde)
  doc = dde.open_doc("/tmp/fdd.docx")
  dde.set_status(doc, "X-21", "CURRENT")
  doc.save("/tmp/fdd.docx")

Exit 0 on success, 1 when an edit cannot be made, 2 on a usage error or when
python-docx is missing and cannot be installed.
"""

from __future__ import annotations

import argparse
import copy
import datetime
import difflib
import importlib
import importlib.util
import json
import os
import re
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True

FILE_IDS = {
    "fdd": "1PoeiXKR2twOaz_JcRN0e4ZQkUCuDD5qnnyrlt6ygkeU",
    "tdd": "1K6-ghhSnJZcrch81DDhmHXXYU0pSF7tOGR9S9jiCUjk",
}
EXPORT_URL = "https://docs.google.com/document/d/{file_id}/export?format=docx"
USER_AGENT = "Mozilla/5.0"
DOWNLOAD_RETRY_DELAYS = (5, 15)

STATUS_COLORS = {
    "CURRENT": "166534",
    "REFINE": "C2410C",
    "TARGET": "1D4ED8",
    "DECISION": "6D28D9",
    "LATER": "4B5563",
}
PHASE_COLOR = "64748B"
HEAD_RE = re.compile(r"^([A-Z]{1,2}-\d{2})(\s+)(CURRENT|REFINE|TARGET|DECISION|LATER)(\s+·\s+.*)$")
FIELD_LABELS = ("Current", "Desired", "User value", "Acceptance", "Evidence", "Open decision")
STATUS_SOURCE = "Status source"
TABLES = {
    "changelog": ["Date", "Change", "Reason", "Reference"],
    "fields": ["Field", "Value"],
    "decision": ["ID", "Decision"],
    "later": ["ID", "Deferred"],
    "trace": ["ID", "Status", "Depends on", "Verification"],
    "tdd-trace": ["FDD", "Technical home"],
}
FOOTER_RE = re.compile(r"\b(FDD|TDD) \d+(?:\.\d+)* · [A-Z][a-z]+ \d{1,2}, \d{4}")
INSTALL_HINT = "python3 -m pip install python-docx"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W14_NS = "http://schemas.microsoft.com/office/word/2010/wordml"
W14_IDS = (f"{{{W14_NS}}}paraId", f"{{{W14_NS}}}textId")


def w(tag: str) -> str:
    return f"{{{W_NS}}}{tag}"


class EditError(Exception):
    pass


# ---------------------------------------------------------------- python-docx


def ensure_docx():
    """Import python-docx, installing it with pip when it is missing."""
    try:
        import docx  # noqa: F401

        return sys.modules["docx"]
    except ImportError:
        pass
    if not os.environ.get("DESIGN_DOC_EDIT_NO_INSTALL"):
        print("python-docx is missing; installing it with pip.", file=sys.stderr)
        for extra in ([], ["--user"], ["--user", "--break-system-packages"]):
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "--quiet", "python-docx", *extra],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                importlib.invalidate_caches()
                import site

                user_site = site.getusersitepackages()
                if user_site not in sys.path:
                    sys.path.append(user_site)
                try:
                    import docx  # noqa: F401

                    return sys.modules["docx"]
                except ImportError:
                    continue
    print(f"python-docx is not installed. Run: {INSTALL_HINT}", file=sys.stderr)
    print("If pip refuses with externally-managed-environment, add --user --break-system-packages.", file=sys.stderr)
    raise SystemExit(2)


def open_doc(path: str):
    return ensure_docx().Document(path)


def _check_module():
    spec = importlib.util.spec_from_file_location(
        "check_design_doc", os.path.join(SCRIPTS_DIR, "check-design-doc.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------- XML helpers


def text_of(element) -> str:
    """Text the way check-design-doc.py reads it: every w:t, joined."""
    return "".join(node.text or "" for node in element.iter(w("t")))


def _is_paragraph(element) -> bool:
    return element.tag == w("p")


def _is_table(element) -> bool:
    return element.tag == w("tbl")


def _is_blank(element) -> bool:
    return _is_paragraph(element) and text_of(element) == "" and next(element.iter(w("drawing")), None) is None


def _style_id(p_el) -> str:
    ppr = p_el.find(w("pPr"))
    style = ppr.find(w("pStyle")) if ppr is not None else None
    return style.get(w("val"), "") if style is not None else ""


def _is_heading_style(p_el) -> bool:
    return _style_id(p_el).lower().startswith("heading")


def _runs(p_el) -> list:
    return list(p_el.iter(w("r")))


def _strip_ids(element) -> None:
    for node in element.iter():
        for attr in W14_IDS:
            if attr in node.attrib:
                del node.attrib[attr]


def _run_set_text(r_el, text: str) -> None:
    for child in list(r_el):
        if child.tag != w("rPr"):
            r_el.remove(child)
    node = r_el.makeelement(w("t"), {})
    node.text = text
    node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    r_el.append(node)


def _new_run(p_el):
    r_el = p_el.makeelement(w("r"), {})
    p_el.append(r_el)
    return r_el


def set_par_text(p_el, text: str) -> None:
    """Put text in the paragraph's first run and drop every other run."""
    runs = _runs(p_el)
    keep = copy.deepcopy(runs[0]) if runs else None
    for child in list(p_el):
        if child.tag != w("pPr"):
            p_el.remove(child)
    if keep is None:
        keep = _new_run(p_el)
    else:
        p_el.append(keep)
    _run_set_text(keep, text)


def _replace_in_paragraph(p_el, old: str, new: str) -> int:
    if not old:
        raise EditError("replace text is empty")
    count = 0
    cursor = 0
    while True:
        nodes = list(p_el.iter(w("t")))
        full = "".join(node.text or "" for node in nodes)
        index = full.find(old, cursor)
        if index < 0:
            return count
        end = index + len(old)
        offset = 0
        placed = False
        for node in nodes:
            value = node.text or ""
            start, stop = offset, offset + len(value)
            offset = stop
            if stop <= index or start >= end:
                continue
            before = value[: max(0, index - start)]
            after = value[max(0, end - start):] if end < stop else ""
            node.text = before + (new if not placed else "") + after
            node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            placed = True
        count += 1
        cursor = index + len(new)


def _append_to_paragraph(p_el, text: str, sep: str) -> None:
    nodes = [node for node in p_el.iter(w("t")) if node.text]
    if not nodes:
        set_par_text(p_el, text)
        return
    nodes[-1].text = nodes[-1].text + sep + text
    nodes[-1].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def _set_bold(r_el, bold: bool) -> None:
    rpr = r_el.find(w("rPr"))
    if rpr is None:
        rpr = r_el.makeelement(w("rPr"), {})
        r_el.insert(0, rpr)
    for tag in ("b", "bCs"):
        node = rpr.find(w(tag))
        if node is None:
            node = rpr.makeelement(w(tag), {})
            rpr.append(node)
        node.set(w("val"), "1" if bold else "0")


def _set_color(r_el, hex_color: str) -> None:
    rpr = r_el.find(w("rPr"))
    if rpr is None:
        rpr = r_el.makeelement(w("rPr"), {})
        r_el.insert(0, rpr)
    node = rpr.find(w("color"))
    if node is None:
        node = rpr.makeelement(w("color"), {})
        rpr.append(node)
    node.set(w("val"), hex_color)


def _split_lines(text: str) -> list[str]:
    return text.split("\n") if text else [""]


# ---------------------------------------------------------------- rows


def _body(doc):
    return doc.element.body


def _heading_match(element):
    if not _is_paragraph(element):
        return None
    return HEAD_RE.match(text_of(element))


def row_ids(doc) -> list[str]:
    return [m.group(1) for el in _body(doc) if (m := _heading_match(el))]


def find_row(doc, rid: str) -> list:
    """Body elements from a row heading through its trailing blank paragraph."""
    children = list(_body(doc))
    starts = [i for i, el in enumerate(children) if (m := _heading_match(el)) and m.group(1) == rid]
    if not starts:
        raise EditError(f"row {rid} not found")
    if len(starts) > 1:
        raise EditError(f"row {rid} appears {len(starts)} times")
    block = [children[starts[0]]]
    for element in children[starts[0] + 1:]:
        if element.tag == w("sectPr") or _heading_match(element):
            break
        if _is_paragraph(element) and _is_heading_style(element):
            break
        follows_label = _is_paragraph(block[-1]) and text_of(block[-1]).strip() in FIELD_LABELS
        block.append(element)
        if _is_blank(element) and not follows_label:
            break
    return block


class Field:
    def __init__(self, kind: str, paragraphs: list, anchor):
        self.kind = kind
        self.paragraphs = paragraphs
        self.anchor = anchor

    def text(self) -> str:
        if self.kind == "status":
            return text_of(self.anchor).split(":", 1)[1].strip()
        return "\n".join(text_of(p) for p in self.paragraphs)


def _cell_paragraphs(tc) -> list:
    return tc.findall(w("p"))


def find_field(doc, rid: str, field: str) -> Field:
    block = find_row(doc, rid)
    if field == STATUS_SOURCE:
        for element in block[1:]:
            if _is_paragraph(element) and text_of(element).startswith(STATUS_SOURCE + ":"):
                return Field("status", [element], element)
        raise EditError(f"row {rid} has no Status source line")
    for element in block:
        if _is_table(element):
            for tr in element.findall(w("tr")):
                cells = tr.findall(w("tc"))
                if len(cells) >= 2 and text_of(cells[0]).strip() == field:
                    return Field("cell", _cell_paragraphs(cells[1]), cells[1])
    for index, element in enumerate(block):
        if _is_paragraph(element) and text_of(element).strip() == field:
            values = []
            for following in block[index + 1:]:
                if not _is_paragraph(following) or (_is_blank(following) and following is block[-1]):
                    break
                if text_of(following).strip() in FIELD_LABELS:
                    break
                values.append(following)
            return Field("paras", values, element)
    raise EditError(f"row {rid} has no {field} field")


def get_field(doc, rid: str, field: str) -> str:
    return find_field(doc, rid, field).text()


def _value_template(ref: Field):
    if ref.paragraphs:
        return ref.paragraphs[-1]
    template = copy.deepcopy(ref.anchor)
    for r_el in _runs(template):
        _set_bold(r_el, False)
    return template


def set_field(doc, rid: str, field: str, text: str) -> None:
    ref = find_field(doc, rid, field)
    if ref.kind == "status":
        runs = [r for r in ref.anchor.findall(w("r"))]
        label = runs[0]
        value = runs[1] if len(runs) > 1 else copy.deepcopy(label)
        if len(runs) < 2:
            _set_bold(value, False)
            label.addnext(value)
        _run_set_text(label, STATUS_SOURCE + ": ")
        _run_set_text(value, text)
        for extra in runs[2:]:
            extra.getparent().remove(extra)
        return
    lines = _split_lines(text)
    template = copy.deepcopy(_value_template(ref))
    if ref.paragraphs:
        first = ref.paragraphs[0]
        for extra in ref.paragraphs[1:]:
            extra.getparent().remove(extra)
    else:
        first = template
        _strip_ids(first)
        ref.anchor.addnext(first)
    set_par_text(first, lines[0])
    previous = first
    for line in lines[1:]:
        paragraph = copy.deepcopy(template)
        _strip_ids(paragraph)
        set_par_text(paragraph, line)
        previous.addnext(paragraph)
        previous = paragraph


def append_field(doc, rid: str, field: str, text: str, paragraph: bool = False, sep: str = " ") -> None:
    ref = find_field(doc, rid, field)
    if ref.kind == "status" or not paragraph:
        if not ref.paragraphs:
            set_field(doc, rid, field, text)
            return
        _append_to_paragraph(ref.paragraphs[-1], text, sep)
        return
    template = _value_template(ref)
    new_paragraph = copy.deepcopy(template)
    _strip_ids(new_paragraph)
    set_par_text(new_paragraph, text)
    (ref.paragraphs[-1] if ref.paragraphs else ref.anchor).addnext(new_paragraph)


def replace_field(doc, rid: str, field: str, old: str, new: str) -> int:
    ref = find_field(doc, rid, field)
    count = sum(_replace_in_paragraph(p, old, new) for p in ref.paragraphs)
    if count == 0:
        raise EditError(f"{old!r} not found in {rid} {field}")
    return count


def _normalize_heading(p_el) -> list:
    """Return [id run, status run, phase run], splitting a one-run heading."""
    match = HEAD_RE.match(text_of(p_el))
    if not match:
        raise EditError("paragraph is not a row heading")
    runs = p_el.findall(w("r"))
    texts = [text_of(r) for r in runs]
    if len(runs) >= 3 and texts[1].strip() in STATUS_COLORS and texts[0].strip() == match.group(1):
        return runs
    base = runs[0] if runs else _new_run(p_el)
    id_run, status_run, phase_run = (copy.deepcopy(base) for _ in range(3))
    _run_set_text(id_run, match.group(1) + match.group(2))
    _run_set_text(status_run, match.group(3))
    _run_set_text(phase_run, match.group(4))
    _set_bold(id_run, True)
    _set_bold(status_run, True)
    _set_bold(phase_run, False)
    _set_color(phase_run, PHASE_COLOR)
    for r_el in runs:
        r_el.getparent().remove(r_el)
    ppr = p_el.find(w("pPr"))
    anchor_index = list(p_el).index(ppr) + 1 if ppr is not None else 0
    for offset, r_el in enumerate((id_run, status_run, phase_run)):
        p_el.insert(anchor_index + offset, r_el)
    return [id_run, status_run, phase_run]


def set_status(doc, rid: str, status: str, phase: str | None = None) -> None:
    if status not in STATUS_COLORS:
        raise EditError(f"status must be one of {', '.join(STATUS_COLORS)}")
    heading = find_row(doc, rid)[0]
    runs = _normalize_heading(heading)
    _run_set_text(runs[1], status)
    _set_bold(runs[1], True)
    _set_color(runs[1], STATUS_COLORS[status])
    if phase is not None:
        _run_set_text(runs[2], "   ·   " + phase)


def clone_row(doc, src_id: str, after_id: str, new_id: str, status: str | None = None, phase: str | None = None) -> None:
    if not re.fullmatch(r"[A-Z]{1,2}-\d{2}", new_id):
        raise EditError(f"new id {new_id!r} must look like X-32")
    if new_id in row_ids(doc):
        raise EditError(f"row {new_id} already exists")
    source = find_row(doc, src_id)
    after = find_row(doc, after_id)
    clones = [copy.deepcopy(element) for element in source]
    for element in clones:
        _strip_ids(element)
    runs = _normalize_heading(clones[0])
    _run_set_text(runs[0], text_of(runs[0]).replace(src_id, new_id, 1))
    anchor = after[-1]
    if not _is_blank(anchor) and _is_blank(clones[-1]):
        clones.insert(0, clones.pop())
    for element in clones:
        anchor.addnext(element)
        anchor = element
    if status is not None or phase is not None:
        set_status(doc, new_id, status or HEAD_RE.match(text_of(clones[0])).group(3), phase)


def show_row(doc, rid: str) -> str:
    lines = []
    for element in find_row(doc, rid):
        if _is_table(element):
            for tr in element.findall(w("tr")):
                cells = [" / ".join(text_of(p) for p in _cell_paragraphs(tc)) for tc in tr.findall(w("tc"))]
                lines.append("  | " + " | ".join(cells))
        elif not _is_blank(element):
            lines.append(text_of(element))
    return "\n".join(lines)


# ---------------------------------------------------------------- tables


def find_table(doc, name: str):
    headers = TABLES.get(name) or [part.strip() for part in name.split("|") if part.strip()]
    if not headers:
        raise EditError("table name is empty")
    matches = []
    for tbl in _body(doc).iter(w("tbl")):
        rows = tbl.findall(w("tr"))
        if not rows:
            continue
        cells = [text_of(tc).strip() for tc in rows[0].findall(w("tc"))]
        if cells[: len(headers)] == headers:
            matches.append(tbl)
    if len(matches) != 1:
        raise EditError(f"expected one table with header {'|'.join(headers)}, found {len(matches)}")
    return matches[0]


def set_cell_text(tc, text: str) -> None:
    paragraphs = _cell_paragraphs(tc)
    if not paragraphs:
        paragraphs = [tc.makeelement(w("p"), {})]
        tc.append(paragraphs[0])
    first = paragraphs[0]
    template = copy.deepcopy(first)
    for extra in paragraphs[1:]:
        tc.remove(extra)
    lines = _split_lines(text)
    set_par_text(first, lines[0])
    previous = first
    for line in lines[1:]:
        paragraph = copy.deepcopy(template)
        _strip_ids(paragraph)
        set_par_text(paragraph, line)
        previous.addnext(paragraph)
        previous = paragraph


def _width(tbl) -> int:
    rows = tbl.findall(w("tr"))
    return len(rows[0].findall(w("tc"))) if rows else 0


def _is_header_row(tr) -> bool:
    cells = tr.findall(w("tc")) if tr is not None else []
    if not cells:
        return False
    shd = cells[0].find(f"{w('tcPr')}/{w('shd')}")
    fill = (shd.get(w("fill")) or "").lower() if shd is not None else ""
    if fill and fill not in ("auto", "ffffff"):
        return True
    for r_el in cells[0].iter(w("r")):
        bold = r_el.find(f"{w('rPr')}/{w('b')}")
        if bold is not None and bold.get(w("val"), "1").lower() not in ("0", "false", "off"):
            return True
    return False


def table_groups(doc) -> list[list]:
    """Tables, with each published continuation table grouped after its original.

    A continuation is what insert_table leaves in the live doc: a table right
    after another one, one empty paragraph between them, with the same column
    count and no header row.
    """
    groups: list[list] = []
    children = list(_body(doc))
    for index, element in enumerate(children):
        if element.tag != w("tbl"):
            continue
        first = element.find(w("tr"))
        if (
            groups
            and index >= 2
            and children[index - 2] is groups[-1][-1]
            and _is_blank(children[index - 1])
            and _width(element) == _width(groups[-1][0])
            and not _is_header_row(first)
        ):
            groups[-1].append(element)
        else:
            groups.append([element])
    return groups


def group_name(group: list) -> str:
    first = group[0].find(w("tr"))
    return "|".join(text_of(tc).strip() for tc in first.findall(w("tc"))) if first is not None else ""


def table_group(doc, name: str) -> list:
    """The named table and its continuation tables, top to bottom."""
    header = find_table(doc, name)
    for group in table_groups(doc):
        if group[0] is header:
            return group
    return [header]


def _group_rows(group) -> list:
    if not isinstance(group, list):
        group = [group]
    rows = []
    for index, tbl in enumerate(group):
        rows.extend(tbl.findall(w("tr"))[1 if index == 0 else 0:])
    return rows


def _row_by_key(group, key: str):
    for tr in _group_rows(group):
        cells = tr.findall(w("tc"))
        if cells and text_of(cells[0]).strip() == key:
            return tr
    raise EditError(f"no row whose first cell is {key!r}")


def add_table_row(group, values: list[str], after: str | None = None) -> None:
    """Add a row at the bottom of the table's last continuation, or after a row."""
    if not isinstance(group, list):
        group = [group]
    template = group[-1].findall(w("tr"))[-1]
    width = len(template.findall(w("tc")))
    if len(values) != width:
        raise EditError(f"table has {width} columns; got {len(values)} values")
    new_row = copy.deepcopy(template)
    _strip_ids(new_row)
    for tc, value in zip(new_row.findall(w("tc")), values):
        set_cell_text(tc, value)
    anchor = _row_by_key(group, after) if after else template
    anchor.addnext(new_row)


def set_table_cell(group, key: str, column: str, text: str) -> None:
    if not isinstance(group, list):
        group = [group]
    header = [text_of(tc).strip() for tc in group[0].findall(w("tr"))[0].findall(w("tc"))]
    if column not in header:
        raise EditError(f"no column {column!r}; columns are {', '.join(header)}")
    cells = _row_by_key(group, key).findall(w("tc"))
    set_cell_text(cells[header.index(column)], text)


def add_changelog_row(doc, date: str, change: str, reason: str, reference: str) -> None:
    add_table_row(table_group(doc, "changelog"), [date, change, reason, reference])


def split_tables(doc, specs: list[tuple[str, int]]) -> None:
    """Move the last N rows of each named table into a new table right after it.

    This is the structure insert_table leaves in the live doc: the original
    table, one empty paragraph, the new table, then what followed before.
    """
    for name, count in specs:
        group = table_group(doc, name)
        tbl = group[-1]
        rows = tbl.findall(w("tr"))
        if count < 1 or count >= len(rows):
            raise EditError(f"cannot move {count} of {len(rows)} rows out of table {group_name(group)}")
        moved = copy.deepcopy(tbl)
        for tr in moved.findall(w("tr")):
            moved.remove(tr)
        for tr in rows[-count:]:
            moved.append(tr)
        following = tbl.getnext()
        if following is not None and _is_blank(following):
            blank = copy.deepcopy(following)
            _strip_ids(blank)
        else:
            blank = tbl.makeelement(w("p"), {})
        tbl.addnext(blank)
        blank.addnext(moved)


def parse_split(spec: str) -> tuple[str, int]:
    name, sep, count = spec.rpartition(":")
    if not sep or not name or not count.strip().isdigit():
        raise EditError(f"--split {spec!r} must look like 'Date|Change|Reason|Reference:8'")
    return name, int(count)


# ---------------------------------------------------------------- whole document


def _story_roots(doc) -> list:
    from docx.opc.constants import RELATIONSHIP_TYPE as RT

    roots = [_body(doc)]
    seen = set()
    for rel in doc.part.rels.values():
        if rel.reltype in (RT.HEADER, RT.FOOTER) and rel.target_part.partname not in seen:
            seen.add(rel.target_part.partname)
            roots.append(rel.target_part.element)
    return roots


def _footer_roots(doc) -> list:
    from docx.opc.constants import RELATIONSHIP_TYPE as RT

    return [rel.target_part.element for rel in doc.part.rels.values() if rel.reltype == RT.FOOTER]


def replace_everywhere(doc, old: str, new: str) -> int:
    return sum(_replace_in_paragraph(p, old, new) for root in _story_roots(doc) for p in list(root.iter(w("p"))))


def long_date(day: datetime.date) -> str:
    return f"{day:%B} {day.day}, {day.year}"


def set_version(doc, version: str, date_text: str | None = None) -> None:
    if not re.fullmatch(r"\d+(?:\.\d+)*", version):
        raise EditError(f"version {version!r} must look like 21.9")
    date_text = date_text or long_date(datetime.date.today())
    first = next(_body(doc).iter(w("p")), None)
    if first is None or not text_of(first).startswith("Documentation version:"):
        raise EditError("first paragraph is not 'Documentation version: ...'")
    set_par_text(first, f"Documentation version: {version}")
    fields = find_table(doc, "fields")
    set_table_cell(fields, "Version", "Value", version)
    set_table_cell(fields, "Date", "Value", date_text)
    updated = 0
    for root in _footer_roots(doc):
        for p_el in root.iter(w("p")):
            match = FOOTER_RE.search(text_of(p_el))
            if match:
                updated += _replace_in_paragraph(p_el, match.group(0), f"{match.group(1)} {version} · {date_text}")
    if not updated:
        raise EditError("footer has no 'FDD 21.8 · November 5, 2026' text to update")


def first_line(path: str) -> str:
    paragraphs, _header, _footer = _check_module().read_docx(path)
    return paragraphs[0] if paragraphs else ""


# ---------------------------------------------------------------- download and diff


def download(file_id: str, dest: str, url: str | None = None, delays=DOWNLOAD_RETRY_DELAYS) -> str:
    file_id = FILE_IDS.get(file_id.lower(), file_id)
    url = url or EXPORT_URL.format(file_id=file_id)
    last_error = ""
    for attempt in range(len(delays) + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as response:
                data = response.read()
            if not data.startswith(b"PK"):
                raise EditError("export was not a docx. The Google Doc may not be link-shared.")
            with open(dest, "wb") as handle:
                handle.write(data)
            return first_line(dest)
        except EditError:
            raise
        except (OSError, ValueError) as error:
            last_error = f"{type(error).__name__}: {error}".replace("\n", " ")
        if attempt < len(delays):
            print(f"download attempt {attempt + 1} failed: {last_error}. Retrying in {delays[attempt]}s.", file=sys.stderr)
            time.sleep(delays[attempt])
    raise EditError(f"download failed after {len(delays) + 1} attempts: {last_error}")


def diff_docs(before: str, after: str) -> list[str]:
    read_docx = _check_module().read_docx
    old_paragraphs, old_header, old_footer = read_docx(before)
    new_paragraphs, new_header, new_footer = read_docx(after)
    lines: list[str] = []
    matcher = difflib.SequenceMatcher(None, old_paragraphs, new_paragraphs, autojunk=False)
    changed = added = removed = 0
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            continue
        if op == "replace" and i2 - i1 == j2 - j1:
            for offset in range(i2 - i1):
                lines.append(f"paragraph {i1 + offset} -> {j1 + offset} changed")
                lines.append(f"  - {old_paragraphs[i1 + offset]}")
                lines.append(f"  + {new_paragraphs[j1 + offset]}")
                changed += 1
            continue
        for index in range(i1, i2):
            lines.append(f"paragraph {index} removed")
            lines.append(f"  - {old_paragraphs[index]}")
            removed += 1
        for index in range(j1, j2):
            lines.append(f"paragraph {index} added")
            lines.append(f"  + {new_paragraphs[index]}")
            added += 1
    for name, old, new in (("header", old_header, new_header), ("footer", old_footer, new_footer)):
        if old != new:
            lines.append(f"{name} changed")
            lines.append(f"  - {old}")
            lines.append(f"  + {new}")
    if not lines:
        return ["No differences."]
    lines.append(f"{changed} changed, {added} added, {removed} removed paragraphs.")
    return lines


# ---------------------------------------------------------------- Google-docs plan

MIN_FIND = 24
REPLACE_FIND_MAX = 1000
REPLACE_WITH_MAX = 10000
ID_COLOR = "#0F2C4C"
PHASE_HEX = "#" + PHASE_COLOR
CHANGELOG_HEADER = "|".join(TABLES["changelog"])
PLAN_NOTES = (
    "Every replace_text find occurs exactly once in the whole live text when its step runs, so it cannot"
    " hit an older change-log row. If occurrencesChanged is not the number the step expects, stop and undo"
    " that replace before doing anything else.",
    "A date also appears in the footer, so a replace_text on a date reports 2 when its step says so.",
    "Run one call at a time, in the order listed. Fill table cells bottom-to-top and right-to-left, as"
    " listed, so a mistake shows up as text in the wrong cell instead of shifted indexes.",
    "insert_table into the empty paragraph after a table keeps that paragraph above the new table and"
    " adds one after it. The pub command builds that same structure for the check.",
    "insert_text at the start of a paragraph takes that paragraph's style (often a heading). Each insert"
    " step lists the paragraph style, indent, and text style to set afterwards.",
)


def _q(text: str) -> str:
    return json.dumps(text, ensure_ascii=False)


def _u16(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def _count(hay: str, needle: str, limit: int | None = None) -> int:
    if not needle:
        return 1 << 30
    found, start = 0, 0
    while True:
        index = hay.find(needle, start)
        if index < 0 or (limit is not None and found >= limit):
            return found
        found += 1
        start = index + 1


def _common_affixes(old: str, new: str) -> tuple[int, int]:
    prefix = 0
    limit = min(len(old), len(new))
    while prefix < limit and old[prefix] == new[prefix]:
        prefix += 1
    suffix = 0
    while suffix < limit - prefix and old[len(old) - 1 - suffix] == new[len(new) - 1 - suffix]:
        suffix += 1
    return prefix, suffix


def _word_bounds(text: str, x: int, y: int) -> tuple[int, int]:
    """Widen [x, y) so the find does not start or end inside a word."""
    while 0 < x < len(text) and text[x - 1].isalnum() and text[x].isalnum():
        x -= 1
    while 0 < y < len(text) and text[y - 1].isalnum() and text[y].isalnum():
        y += 1
    return x, y


class _Par:
    __slots__ = ("text", "box", "el")

    def __init__(self, text: str, box: tuple, el=None):
        self.text, self.box, self.el = text, box, el


BODY = ("body",)


def _read_pars(doc, prefix: str):
    """Paragraphs in check-design-doc.py order, each with its container."""
    group_of = {}
    for group in table_groups(doc):
        name = group_name(group)
        for position, tbl in enumerate(group):
            group_of[tbl] = (name, position, len(group))
    pars, tables = [], {}
    for child in _body(doc):
        if child.tag != w("tbl"):
            pars.extend(_Par(text_of(p), BODY, p) for p in child.iter(w("p")))
            continue
        key = f"{prefix}{len(tables)}"
        rows = child.findall(w("tr"))
        cell_of, first_col = {}, []
        for r, tr in enumerate(rows):
            cells = tr.findall(w("tc"))
            first_col.append(text_of(cells[0]).strip() if cells else "")
            for c, tc in enumerate(cells):
                for p in tc.iter(w("p")):
                    cell_of[p] = (r, c)
        name, position, size = group_of.get(child, ("", 0, 1))
        tables[key] = {
            "rows": len(rows), "cols": _width(child), "group": name,
            "position": position, "last": position == size - 1, "first_col": first_col,
        }
        for p in child.iter(w("p")):
            r, c = cell_of.get(p, (0, 0))
            pars.append(_Par(text_of(p), ("cell", key, r, c), p))
    return pars, tables


def _contexts(pars, tables) -> list[str]:
    out, rid, label = [], None, None
    for p in pars:
        if p.box == BODY:
            match = HEAD_RE.match(p.text)
            if match:
                rid, label = match.group(1), None
            elif rid and p.text.strip() in FIELD_LABELS:
                label = p.text.strip()
            elif p.el is not None and _is_heading_style(p.el):
                rid, label = None, None
            out.append((f"row {rid}" + (f" {label}" if label else "")) if rid else "body text")
            continue
        table, r = tables[p.box[1]], p.box[2]
        first = table["first_col"][r] if r < len(table["first_col"]) else ""
        if rid and first in FIELD_LABELS:
            out.append(f"row {rid} {first}")
        else:
            where = f"table {table['group']}" + (f" (continuation {table['position']})" if table["position"] else "")
            out.append(f"{where}, row {r + 1}")
    return out


def _named_style(p_el) -> str:
    style = _style_id(p_el).lower().replace(" ", "")
    match = re.fullmatch(r"heading(\d)", style)
    if match:
        return f"HEADING_{match.group(1)}"
    return {"title": "TITLE", "subtitle": "SUBTITLE"}.get(style, "NORMAL_TEXT")


def _indent_pt(p_el) -> float:
    ind = p_el.find(f"{w('pPr')}/{w('ind')}")
    if ind is None:
        return 0.0
    value = ind.get(w("left")) or ind.get(w("start")) or "0"
    try:
        return round(float(value) / 20, 1)
    except ValueError:
        return 0.0


def _run_styles(p_el) -> list[list]:
    runs: list[list] = []
    for r_el in p_el.iter(w("r")):
        text = "".join(node.text or "" for node in r_el.iter(w("t")))
        if not text:
            continue
        rpr = r_el.find(w("rPr"))
        bold, color, size = False, None, None
        if rpr is not None:
            b = rpr.find(w("b"))
            bold = b is not None and b.get(w("val"), "1").lower() not in ("0", "false", "off")
            c = rpr.find(w("color"))
            if c is not None and c.get(w("val"), "auto").lower() != "auto":
                color = "#" + c.get(w("val")).upper()
            s = rpr.find(w("sz"))
            if s is not None and s.get(w("val"), "").isdigit():
                size = int(s.get(w("val"))) / 2
        style = (bold, color, size)
        if runs and runs[-1][1] == style:
            runs[-1][0] += text
        else:
            runs.append([text, style])
    return runs


def _style_args(start: str, a: int, b: int, style) -> str:
    bold, color, size = style
    parts = [f'"startIndex": {start} + {a}', f'"endIndex": {start} + {b}', f'"bold": {"true" if bold else "false"}']
    if color:
        parts.append(f'"textColor": "{color}"')
    if size:
        parts.append(f'"fontSize": {size:g}')
    return "apply_text_style {" + ", ".join(parts) + "}"


def _is_history(box, tables) -> bool:
    if box[0] != "cell":
        return False
    table = tables[box[1]]
    return table["group"].startswith(CHANGELOG_HEADER) and not (table["position"] == 0 and box[2] == 0)


class _Planner:
    def __init__(self, live: str, new: str, keep_history: bool):
        check = _check_module()
        self.check = check
        self.live_path, self.new_path, self.keep_history = live, new, keep_history
        self.old, self.otables = _read_pars(open_doc(live), "L")
        self.new_doc = open_doc(new)
        self.new, self.ntables = _read_pars(self.new_doc, "N")
        live_pars, live_header, live_footer = check.read_docx(live)
        new_pars, self.new_header, self.new_footer = check.read_docx(new)
        if [p.text for p in self.old] != live_pars or [p.text for p in self.new] != new_pars:
            raise EditError("paragraph reading differs from check-design-doc.py")
        self.octx = _contexts(self.old, self.otables)
        self.nctx = _contexts(self.new, self.ntables)
        self.model = [_Par(p.text, p.box, p.el) for p in self.old]
        self.header, self.footer = live_header, live_footer
        self.steps: list[tuple[str, list[str]]] = []
        self.skipped: list[str] = []
        self.warnings: list[str] = []
        self.splits: dict[str, int] = {}

    # ---- text model

    def full(self) -> str:
        return "\n".join(p.text for p in self.model)

    def before(self, i: int) -> str:
        return "\n".join(p.text for p in self.model[:i]) + ("\n" if i else "")

    def anchor(self, i: int) -> tuple[str, int | None]:
        text, full = self.model[i].text, self.full()
        if _count(full, text, 2) == 1:
            lo, hi = min(MIN_FIND, len(text)), len(text)
            while lo < hi:
                mid = (lo + hi) // 2
                if _count(full, text[:mid], 2) == 1:
                    hi = mid
                else:
                    lo = mid + 1
            return text[:_word_bounds(text, 0, lo)[1]], None
        return text, _count(self.before(i), text) + 1

    def find_call(self, i: int, label: str, note: str = "") -> str:
        text, occurrence = self.anchor(i)
        args = {"text": text}
        if occurrence:
            args["occurrence"] = occurrence
        return f"find_text {json.dumps(args, ensure_ascii=False)} -> {label}" + (f"   ({note})" if note else "")

    def locate(self, i: int, label: str) -> tuple[list[str], str, str]:
        """Lines that find paragraph i, and expressions for its start and end."""
        p = self.model[i]
        if p.text:
            return [self.find_call(i, label)], f"{label}.paragraph_start", f"{label}.paragraph_end"
        j, blanks = i - 1, 0
        while j >= 0 and self.model[j].box == p.box and not self.model[j].text:
            j, blanks = j - 1, blanks + 1
        if j >= 0 and self.model[j].box == p.box:
            start = f"{label}.paragraph_end" + (f" + {blanks}" if blanks else "")
            return [self.find_call(j, label, "the paragraph above the empty one")], start, f"{start} + 1"
        if p.box == BODY and j >= 0 and self.model[j].box[0] == "cell":
            key = self.model[j].box[1]
            k = j
            while k >= 0 and self.model[k].box[:2] == ("cell", key) and not self.model[k].text:
                k -= 1
            if k >= 0 and self.model[k].box[:2] == ("cell", key):
                start = f"{label}T.end" + (f" + {blanks}" if blanks else "")
                return [
                    self.find_call(k, label, "a cell of the table just above"),
                    f"read_document -> {label}T = the table element that contains {label}.start",
                ], start, f"{start} + 1"
        if p.box[0] == "cell":
            key, r, c = p.box[1], p.box[2], p.box[3]
            for k in list(range(i - 1, -1, -1)) + list(range(i + 1, len(self.model))):
                if self.model[k].box[:2] == ("cell", key) and self.model[k].text:
                    return [
                        self.find_call(k, label, "a cell of the same table"),
                        f"read_document -> {label}C = row {r + 1}, column {c + 1} of the table that contains {label}.start",
                    ], f"{label}C.start", f"{label}C.start + 1"
        raise EditError(f"cannot locate empty paragraph {i}; edit it by hand")

    def locate_text_end(self, i: int, label: str) -> tuple[list[str], str]:
        if self.model[i].text:
            return [self.find_call(i, label)], f"{label}.paragraph_end - 1"
        lines, start, _end = self.locate(i, label)
        return lines, start

    def emit(self, title: str, context: str, lines: list[str]) -> None:
        self.steps.append((f"{title}   [{context}]", lines))

    # ---- edits

    def heading_styles(self, i: int) -> list[str]:
        match = HEAD_RE.match(self.model[i].text)
        rid, gap, status, phase = match.groups()
        s1, s2 = _u16(rid), _u16(rid + gap)
        s3 = s2 + _u16(status)
        s4 = s3 + _u16(phase)
        start = "H.paragraph_start"
        return [
            self.find_call(i, "H"),
            _style_args(start, 0, s1, (True, ID_COLOR, 12)) + "   (ID)",
            _style_args(start, s2, s3, (True, "#" + STATUS_COLORS[status], 12)) + f"   ({status})",
            _style_args(start, s3, s4, (False, PHASE_HEX, None)) + "   (phase)",
        ]

    def change(self, i: int, j: int) -> None:
        o, n, context = self.model[i].text, self.new[j].text, self.octx[i]
        if self.keep_history and _is_history(self.old[i].box, self.otables):
            self.skipped.append(f"paragraph {i} ({context}): live {_q(o)} -> new {_q(n)}")
            return
        prefix, suffix = _common_affixes(o, n)
        a, b = prefix, len(o) - suffix
        mid = n[a:len(n) - suffix]
        full = self.full()
        find = None
        if o and _count(full, o, 2) == 1:
            floor = min(MIN_FIND, len(o))

            def window(step):
                return max(0, a - step), min(len(o), b + step)

            def unique(step):
                x, y = window(step)
                return y - x >= floor and _count(full, o[x:y], 2) == 1

            lo, hi = 0, max(a, len(o) - b)
            while lo < hi:
                step = (lo + hi) // 2
                if unique(step):
                    hi = step
                else:
                    lo = step + 1
            x, y = _word_bounds(o, *window(lo))
            find, replace = o[x:y], n[x:len(n) - (len(o) - y)]
            if len(find) > REPLACE_FIND_MAX or len(replace) > REPLACE_WITH_MAX:
                find = None
        if find is not None:
            extra = _count(self.header, find) + _count(self.footer, find)
            expect = f"Expect occurrencesChanged = {1 + extra}" + (
                f" (1 here and {extra} in the header or footer)" if extra else "") + "."
            lines = [f"replace_text {json.dumps({'find': find, 'replace': replace}, ensure_ascii=False)}", expect]
            self.header = self.header.replace(find, replace)
            self.footer = self.footer.replace(find, replace)
            title = "replace_text"
        else:
            if o:
                _text, occurrence = self.anchor(i)
                note = f"this text occurs {_count(full, o)} times; this is match {occurrence}" if occurrence else ""
                lines, start = [self.find_call(i, "M", note)], "M.start"
            else:
                lines, start, _end = self.locate(i, "M")
            if b > a:
                lines.append(f'delete_content {{"startIndex": {start} + {_u16(o[:a])}, "endIndex": {start} + {_u16(o[:b])}}}')
            if mid:
                lines.append(f'insert_text {{"index": {start} + {_u16(o[:a])}, "text": {_q(mid)}}}')
            title = "POSITION edit"
        self.model[i].text = n
        if HEAD_RE.match(n):
            lines.append("Then style the heading:")
            lines.extend(self.heading_styles(i))
        self.emit(title, context, lines)

    def delete(self, i: int) -> None:
        p, context = self.model[i], self.octx[i]
        if self.keep_history and _is_history(self.old[i].box, self.otables):
            self.skipped.append(f"paragraph {i} ({context}): live {_q(p.text)} is removed in new")
            return
        same_before = i > 0 and self.model[i - 1].box == p.box
        same_after = i + 1 < len(self.model) and self.model[i + 1].box == p.box
        if p.box[0] == "cell" and not same_before and not same_after:
            self.warnings.append(f"paragraph {i} ({context}) empties a table cell or removes a row; do that by hand.")
            return
        lines, start, end = self.locate(i, "D")
        if same_after or not same_before:
            lines.append(f'delete_content {{"startIndex": {start}, "endIndex": {end}}}')
        else:
            lines.append(f'delete_content {{"startIndex": {start} - 1, "endIndex": {end} - 1}}   (takes the newline before it)')
        del self.model[i]
        self.emit("delete paragraph", context, lines)

    # ---- inserts

    def segments(self, js: list[int]) -> list[tuple]:
        segs: list[list] = []
        for j in js:
            box = self.new[j].box
            if box == BODY:
                kind, key = "body", None
            else:
                nt, r = box[1], box[2]
                if nt not in self.tmap:
                    kind, key = "table", nt
                elif (nt, r) in self.rowmap:
                    lt, orow = self.rowmap[(nt, r)]
                    kind, key = "cell", ("cell", lt, orow, box[3])
                else:
                    kind, key = "rows", nt
            if segs and segs[-1][0] == kind and segs[-1][1] == key:
                segs[-1][2].append(j)
            else:
                segs.append([kind, key, [j]])
        return [tuple(s) for s in segs]

    def insert(self, q: int, js: list[int]) -> None:
        segs = self.segments(js)
        absorb = False
        for index, (kind, key, items) in enumerate(segs):
            if absorb and kind == "body" and items and not self.new[items[0]].text:
                items = items[1:]
            absorb = False
            if not items:
                continue
            if kind == "body":
                q = self.insert_body(q, items)
            elif kind == "cell":
                q = self.insert_cell(q, key, items)
            elif kind == "table":
                q = self.insert_table(q, key, items)
                nxt = segs[index + 1] if index + 1 < len(segs) else None
                if nxt and nxt[0] == "body" and not self.new[nxt[2][0]].text:
                    absorb = True
                else:
                    self.warnings.append(
                        f"new table {self.nctx[items[0]]} is not followed by an empty paragraph in NEW;"
                        " insert_table leaves one, so the check will report it.")
            elif kind == "rows":
                q = self.append_rows(q, key, items)
                if index + 1 < len(segs):
                    self.warnings.append("text added right after appended table rows; check the order by hand.")

    def text_style_lines(self, items: list[int], offset0: int) -> list[str]:
        lines, offset = [], offset0
        styled = False
        per_par = []
        for j in items:
            runs = _run_styles(self.new[j].el) if self.new[j].el is not None else []
            per_par.append((offset, runs))
            styled = styled or any(style != (False, None, None) for _text, style in runs)
            offset += _u16(self.new[j].text) + 1
        if not styled:
            if offset - 1 <= offset0:
                return []
            return [_style_args("R.start", offset0, offset - 1, (False, None, None)) + "   (plain text)"]
        for start, runs in per_par:
            position = start
            for text, style in runs:
                if not text:
                    continue
                lines.append(_style_args("R.start", position, position + _u16(text), style))
                position += _u16(text)
        return lines

    def insert_body(self, q: int, items: list[int]) -> int:
        texts = [self.new[j].text for j in items]
        if q < len(self.model) and self.model[q].box == BODY:
            lines, start, _end = self.locate(q, "N")
            index, text, offset0 = start, "\n".join(texts) + "\n", 0
            where = "at the start of the paragraph after the insertion point"
        elif q > 0 and self.model[q - 1].box == BODY:
            lines, index = self.locate_text_end(q - 1, "P")
            text, offset0 = "\n" + "\n".join(texts), 1
            where = "at the end of the paragraph before the insertion point"
        else:
            self.warnings.append(f"cannot place new paragraphs before {self.nctx[items[0]]}; insert them by hand.")
            return q
        lines.append(f'insert_text {{"index": {index}, "text": {_q(text)}}} -> R (its insertedRange)   ({where})')
        offset = offset0
        for j in items:
            el, length = self.new[j].el, _u16(self.new[j].text) + 1
            style = _named_style(el) if el is not None else "NORMAL_TEXT"
            indent = _indent_pt(el) if el is not None else 0.0
            lines.append(
                f'apply_paragraph_style {{"startIndex": R.start + {offset}, "endIndex": R.start + {offset + length - offset0}, '
                f'"namedStyleType": "{style}"}};  set_paragraph_format same range {{"indentStart": {indent:g}}}')
            offset += length
        lines.extend(self.text_style_lines(items, offset0))
        for k, j in enumerate(items):
            self.model.insert(q + k, _Par(self.new[j].text, BODY, self.new[j].el))
        self.emit(f"insert {len(items)} paragraph(s)", self.nctx[items[0]], lines)
        return q + len(items)

    def insert_cell(self, q: int, box: tuple, items: list[int]) -> int:
        texts = [self.new[j].text for j in items]
        if q > 0 and self.model[q - 1].box == box:
            lines, index = self.locate_text_end(q - 1, "P")
            text = "\n" + "\n".join(texts)
        elif q < len(self.model) and self.model[q].box == box:
            lines, index, _end = self.locate(q, "N")
            text = "\n".join(texts) + "\n"
        else:
            self.warnings.append(f"cannot place new cell text {self.nctx[items[0]]}; add it by hand.")
            return q
        lines.append(f'insert_text {{"index": {index}, "text": {_q(text)}}}')
        for k, j in enumerate(items):
            self.model.insert(q + k, _Par(self.new[j].text, box, self.new[j].el))
        self.emit("add text in a table cell", self.nctx[items[0]], lines)
        return q + len(items)

    def cell_fill(self, items: list[int], label: str, rows: list[int]) -> tuple[list[str], list[_Par], int, int]:
        cells: dict[tuple[int, int], list[int]] = {}
        order = {r: k for k, r in enumerate(rows)}
        for j in items:
            _kind, _key, r, c = self.new[j].box
            cells.setdefault((order[r], c), []).append(j)
        columns = self.ntables[self.new[items[0]].box[1]]["cols"]
        lines = [f"insert_text into each cell of {label}, one call at a time, bottom-to-top and right-to-left."
                 " Where styles are listed, R is that insert_text's insertedRange:"]
        for (r, c) in sorted(cells, reverse=True):
            text = "\n".join(self.new[j].text for j in cells[(r, c)])
            if not text:
                lines.append(f"  row {r + 1}, column {c + 1}: (leave empty)")
                continue
            lines.append(f"  row {r + 1}, column {c + 1}: {_q(text)}")
            styles = self.text_style_lines(cells[(r, c)], 0)
            if not (len(styles) == 1 and styles[0].endswith("(plain text)")):
                lines.extend("      " + line for line in styles)
        pars = [_Par(self.new[j].text, ("cell", self.new[j].box[1], order[self.new[j].box[2]], self.new[j].box[3]), self.new[j].el)
                for j in items]
        return lines, pars, len(rows), columns

    def insert_table(self, q: int, nt: str, items: list[int]) -> int:
        rows = sorted({self.new[j].box[2] for j in items})
        if not (q > 0 and self.model[q - 1].box == BODY):
            self.warnings.append(f"new table {self.nctx[items[0]]} has no paragraph above it; insert it by hand.")
            return q
        lines, index = self.locate_text_end(q - 1, "P")
        fill, pars, count, columns = self.cell_fill(items, "T", rows)
        lines.append(f'insert_table {{"rows": {count}, "columns": {columns}, "index": {index}}}'
                     "   (the paragraph's text stays above the table; an empty paragraph follows it)")
        lines.append("read_document -> T = the new table (the element right after that paragraph)")
        lines.extend(fill)
        self.model[q:q] = pars + [_Par("", BODY)]
        self.emit(f"new {count} x {columns} table", self.nctx[items[0]], lines)
        return q + len(pars) + 1

    def append_rows(self, q: int, nt: str, items: list[int]) -> int:
        lt = self.tmap[nt]
        table = self.otables[lt]
        rows = sorted({self.new[j].box[2] for j in items})
        if any((nt, r) in self.rowmap for r in range(rows[0], self.ntables[nt]["rows"])):
            self.warnings.append(
                f"rows added inside table {table['group']} instead of at the bottom; the plugin cannot insert"
                " rows into a table. Add them at the bottom in NEW (add-row without --after).")
            return q
        if not (q < len(self.model) and self.model[q].box == BODY and not self.model[q].text):
            self.warnings.append(f"table {table['group']} is not followed by an empty paragraph; add its rows by hand.")
            return q
        k = q - 1
        while k >= 0 and self.model[k].box[:2] == ("cell", lt) and not self.model[k].text:
            k -= 1
        if not table["last"]:
            self.warnings.append(f"rows were added to table {table['group']} above its continuation table; add them to the last one.")
        lines = [
            self.find_call(k, "C", "a cell near the bottom of the table"),
            "read_document -> T = the table that contains C.start; E = the empty paragraph right after T",
        ]
        fill, pars, count, columns = self.cell_fill(items, "T2", rows)
        lines.append(f'insert_table {{"rows": {count}, "columns": {columns}, "index": E.start}}'
                     "   (E stays above the new table; a new empty paragraph follows it)")
        lines.append("read_document -> T2 = the new table (the element right after E)")
        lines.extend(fill)
        self.model[q + 1:q + 1] = pars + [_Par("", BODY)]
        self.splits[table["group"]] = self.splits.get(table["group"], 0) + count
        self.emit(f"append {count} row(s) as a new table", f"table {table['group']}", lines)
        return q

    # ---- whole plan

    def build(self) -> None:
        def key(p):
            return (p.box[0], p.box[3] if p.box[0] == "cell" else None, p.text)

        matcher = difflib.SequenceMatcher(None, [key(p) for p in self.old], [key(p) for p in self.new], autojunk=False)
        equal: dict[int, int] = {}
        changes, deletes, inserts = [], [], []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                equal.update({i1 + k: j1 + k for k in range(i2 - i1)})
                continue
            paired = min(i2 - i1, j2 - j1) if tag == "replace" else 0
            for k in range(paired):
                i, j = i1 + k, j1 + k
                if self.old[i].box[0] == self.new[j].box[0]:
                    changes.append((i, j))
                else:
                    deletes.append(i)
                    inserts.append([i, [j]])
            deletes.extend(range(i1 + paired, i2))
            if j1 + paired < j2:
                inserts.append([i1 + paired, list(range(j1 + paired, j2))])
        merged: list[list] = []
        for before, js in sorted(inserts, key=lambda item: (item[0], item[1][0])):
            if merged and merged[-1][0] == before and merged[-1][1][-1] + 1 == js[0]:
                merged[-1][1].extend(js)
            else:
                merged.append([before, js])
        for item in merged:
            before, js = item
            while (
                before < len(self.old) and equal.get(before) == js[-1] + 1
                and self.new[js[0]].text == self.old[before].text
                and self.new[js[0]].box == BODY == self.old[before].box
            ):
                equal[before] = js[0]
                js[:] = js[1:] + [js[-1] + 1]
                before += 1
            item[0] = before
        votes: dict[str, dict[str, int]] = {}
        for i, j in list(equal.items()) + changes:
            if self.old[i].box[0] == "cell" and self.new[j].box[0] == "cell":
                counter = votes.setdefault(self.new[j].box[1], {})
                counter[self.old[i].box[1]] = counter.get(self.old[i].box[1], 0) + 1
        self.tmap = {nt: max(counter, key=counter.get) for nt, counter in votes.items()}
        self.rowmap = {}
        for i, j in list(equal.items()) + changes:
            ob, nb = self.old[i].box, self.new[j].box
            if ob[0] == "cell" and nb[0] == "cell" and self.tmap.get(nb[1]) == ob[1]:
                self.rowmap.setdefault((nb[1], nb[2]), (ob[1], ob[2]))
        intents = [(i, 1, "change", (i, j)) for i, j in changes]
        intents += [(i, 1, "delete", (i,)) for i in deletes]
        intents += [(before - 0.5, 0, "insert", (before, js)) for before, js in merged]
        for _pos, _order, kind, args in sorted(intents, key=lambda item: (item[0], item[1]), reverse=True):
            getattr(self, kind)(*args)
        for kind, current, wanted in (("header", self.header, self.new_header), ("footer", self.footer, self.new_footer)):
            if current != wanted:
                self.emit("set_header_footer", kind, [f'set_header_footer {{"kind": "{kind}", "text": {_q(wanted)}}}'])
                if kind == "header":
                    self.header = wanted
                else:
                    self.footer = wanted

    def self_check(self) -> str:
        import tempfile

        doc = open_doc(self.new_path)
        split_tables(doc, list(self.splits.items()))
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "pub.docx")
            doc.save(path)
            pars, header, footer = self.check.read_docx(path)
        difference = self.check.first_difference([p.text for p in self.model], pars)
        todo = " Do not apply any step. Fix NEW (see Skipped and Warnings below) and run plan again."
        if difference:
            return ("MISMATCH: after these steps the live text would differ from pub of NEW at "
                    + difference.replace("\n", " ").replace("live:", "plan:", 1) + "." + todo)
        if header != self.header or footer != self.footer:
            return "MISMATCH: header or footer differs from pub of NEW." + todo
        return "OK. After these steps the live text matches pub of NEW, paragraph for paragraph."

    def render(self) -> list[str]:
        out = [f"Google-docs plan: {self.live_path} -> {self.new_path}"]
        if not self.steps and not self.skipped and not self.warnings:
            return out + ["No changes: NEW matches LIVE."]
        out += [
            f"{len(self.steps)} steps. documentId is the live doc's file id. Apply them in order, one call at a time.",
            "They run from the bottom of the document up, so earlier finds stay valid. Every write shifts indexes:",
            "take each index from the find_text or read_document call in the same step.",
            "",
        ]
        for number, (title, lines) in enumerate(self.steps, 1):
            out.append(f"{number}. {title}")
            out.extend(f"   {line}" for line in lines)
        splits = " ".join(f"--split {shlex.quote(f'{name}:{count}')}" for name, count in self.splits.items())
        out += [
            "",
            "After the last step:",
            f"   python3 scripts/design-doc-edit.py pub {shlex.quote(self.new_path)} pub.docx" + (f" {splits}" if splits else ""),
            "   python3 scripts/check-design-doc.py FILE_ID pub.docx",
            "",
            f"Self-check: {self.self_check()}",
        ]
        if self.skipped:
            out += ["", "Skipped (change-log history is never rewritten; undo these edits in NEW, or rerun with --no-keep-history if Brian asked for them):"]
            out += [f"   {line}" for line in self.skipped]
        if self.warnings:
            out += ["", "Warnings:"] + [f"   {line}" for line in self.warnings]
        out += ["", "Notes:"] + [f"   - {note}" for note in PLAN_NOTES]
        return out


def plan_publish(live: str, new: str, keep_history: bool = True) -> list[str]:
    planner = _Planner(live, new, keep_history)
    planner.build()
    return planner.render()


def publish_copy(new: str, out: str, specs: list[str]) -> str:
    doc = open_doc(new)
    split_tables(doc, [parse_split(spec) for spec in specs])
    doc.save(out)
    return first_line(out)


# ---------------------------------------------------------------- CLI


def _read_text(value: str) -> str:
    return sys.stdin.read().rstrip("\n") if value == "-" else value


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="design-doc-edit.py",
        description="Edit the FDD and TDD .docx files. See the module docstring for examples.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def edit(name: str, help_text: str) -> argparse.ArgumentParser:
        command = sub.add_parser(name, help=help_text)
        command.add_argument("docx")
        command.add_argument("--out", help="save here instead of editing in place")
        return command

    command = sub.add_parser("download", help="download a doc via its public export URL")
    command.add_argument("file_id", help="fdd, tdd, or a Google Doc file id")
    command.add_argument("dest")

    command = sub.add_parser("rows", help="list every row heading")
    command.add_argument("docx")
    command = sub.add_parser("show", help="print one row")
    command.add_argument("docx")
    command.add_argument("id")
    command = sub.add_parser("get", help="print one field of a row")
    command.add_argument("docx")
    command.add_argument("id")
    command.add_argument("field")

    command = edit("set-version", "set the first line, Version and Date, and the footer")
    command.add_argument("version")
    command.add_argument("--date", help='long date, e.g. "November 5, 2026" (default today)')

    command = edit("set-status", "set a row's status and its color")
    command.add_argument("id")
    command.add_argument("status", choices=list(STATUS_COLORS))
    command.add_argument("--phase")

    command = edit("set", "replace a field's text")
    command.add_argument("id")
    command.add_argument("field")
    command.add_argument("text")

    command = edit("append", "add text to the end of a field")
    command.add_argument("id")
    command.add_argument("field")
    command.add_argument("text")
    command.add_argument("--paragraph", action="store_true", help="add a new paragraph instead")

    command = edit("replace", "replace text inside one field")
    command.add_argument("id")
    command.add_argument("field")
    command.add_argument("old")
    command.add_argument("new")

    command = edit("clone", "copy a row to a new ID after another row")
    command.add_argument("source_id")
    command.add_argument("after_id")
    command.add_argument("new_id")
    command.add_argument("--status", choices=list(STATUS_COLORS))
    command.add_argument("--phase")

    command = edit("changelog", "append a change-log row")
    command.add_argument("change")
    command.add_argument("reason")
    command.add_argument("reference")
    command.add_argument("--date", help="default today, YYYY-MM-DD")

    command = edit("add-row", "add a row to a table")
    command.add_argument("table", help="changelog, fields, decision, later, trace, tdd-trace, or 'H1|H2'")
    command.add_argument("values", nargs="+")
    command.add_argument("--after", help="insert after the row whose first cell is this")

    command = edit("set-cell", "set one cell in a table row")
    command.add_argument("table")
    command.add_argument("key", help="first cell of the row")
    command.add_argument("column", help="header text of the column")
    command.add_argument("text")

    command = edit("replace-all", "replace text in the body, headers, and footers")
    command.add_argument("old")
    command.add_argument("new")

    command = sub.add_parser("diff", help="paragraph differences, read the way check-design-doc.py reads them")
    command.add_argument("before")
    command.add_argument("after")

    command = sub.add_parser("plan", help="list the Google-docs plugin steps that turn LIVE into NEW")
    command.add_argument("live")
    command.add_argument("new")
    command.add_argument("--keep-history", action=argparse.BooleanOptionalAction, default=True,
                         help="leave published change-log rows as they are live (default); --no-keep-history plans them too")

    command = sub.add_parser("pub", help="write NEW with appended rows split out the way insert_table leaves them live")
    command.add_argument("new")
    command.add_argument("out")
    command.add_argument("--split", action="append", default=[], metavar="'H1|H2|...:N'",
                         help="move the last N rows of this table (or its last continuation) into a new table after it")

    sub.add_parser("selftest", help="build a small docx and exercise every command")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "download":
            print(download(args.file_id, args.dest))
            return 0
        if args.command == "diff":
            print("\n".join(diff_docs(args.before, args.after)))
            return 0
        if args.command == "selftest":
            return selftest()
        if args.command == "plan":
            print("\n".join(plan_publish(args.live, args.new, args.keep_history)))
            return 0
        if args.command == "pub":
            print(f"saved {args.out} ({publish_copy(args.new, args.out, args.split)})")
            return 0
        doc = open_doc(args.docx)
        if args.command == "rows":
            for element in _body(doc):
                if _heading_match(element):
                    print(text_of(element))
            return 0
        if args.command == "show":
            print(show_row(doc, args.id))
            return 0
        if args.command == "get":
            print(get_field(doc, args.id, args.field))
            return 0
        message = ""
        if args.command == "set-version":
            set_version(doc, args.version, args.date)
        elif args.command == "set-status":
            set_status(doc, args.id, args.status, args.phase)
        elif args.command == "set":
            set_field(doc, args.id, args.field, _read_text(args.text))
        elif args.command == "append":
            append_field(doc, args.id, args.field, _read_text(args.text), args.paragraph)
        elif args.command == "replace":
            count = replace_field(doc, args.id, args.field, args.old, _read_text(args.new))
            message = f"replaced {count}"
        elif args.command == "clone":
            clone_row(doc, args.source_id, args.after_id, args.new_id, args.status, args.phase)
        elif args.command == "changelog":
            add_changelog_row(
                doc,
                args.date or datetime.date.today().isoformat(),
                _read_text(args.change),
                args.reason,
                args.reference,
            )
        elif args.command == "add-row":
            add_table_row(table_group(doc, args.table), args.values, args.after)
        elif args.command == "set-cell":
            set_table_cell(table_group(doc, args.table), args.key, args.column, _read_text(args.text))
        elif args.command == "replace-all":
            count = replace_everywhere(doc, args.old, args.new)
            if count == 0:
                raise EditError(f"{args.old!r} not found")
            message = f"replaced {count}"
        out = args.out or args.docx
        doc.save(out)
        print(f"saved {out}" + (f" ({message})" if message else ""))
        return 0
    except EditError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


# ---------------------------------------------------------------- selftest


def _build_sample(path: str) -> None:
    docx = ensure_docx()
    from docx.shared import RGBColor

    doc = docx.Document()

    def run(paragraph, text, bold=None, color=None):
        r = paragraph.add_run(text)
        if bold is not None:
            r.bold = bold
        if color:
            r.font.color.rgb = RGBColor.from_string(color)
        return r

    def heading(rid, status, phase, single=False):
        p = doc.add_paragraph()
        if single:
            run(p, f"{rid}   {status}   ·   {phase}", True, "0F2C4C")
        else:
            run(p, f"{rid}   ", True, "0F2C4C")
            run(p, status, True, STATUS_COLORS[status])
            run(p, f"   ·   {phase}", None, PHASE_COLOR)
            run(p, "")
        p = doc.add_paragraph()
        run(p, "Status source: ", True)
        run(p, "Explicit")
        run(p, "")

    def field_table(values):
        table = doc.add_table(rows=len(FIELD_LABELS), cols=2)
        for tr, label in zip(table.rows, FIELD_LABELS):
            tr.cells[0].text = label
            tr.cells[1].text = values.get(label, "None.")

    def table(rows, blank=True):
        t = doc.add_table(rows=len(rows), cols=len(rows[0]))
        for r, (tr, values) in enumerate(zip(t.rows, rows)):
            for cell, value in zip(tr.cells, values):
                run(cell.paragraphs[0], value, True if r == 0 else None)
        if blank:
            doc.add_paragraph()

    p = doc.add_paragraph()
    run(p, "Documentation version: 1.0", True)
    run(p, "")
    doc.add_paragraph("Functional Design Document")
    table([["Field", "Value"], ["Version", "1.0"], ["Date", "November 1, 2026"], ["Purpose", "Test."]])
    doc.add_heading("Change log", 1)
    table([["Date", "Change", "Reason", "Reference"], ["2026-11-01", "1.0 First.", "Start.", "PR 1."]])
    doc.add_heading("5. Requirements", 1)
    p = doc.add_paragraph()
    run(p, "Former name: Brand ")
    run(p, "Portfolio. Approved.")
    heading("X-01", "TARGET", "Launch")
    field_table({"Current": "Not built.", "Evidence": "Not live."})
    doc.add_paragraph()
    heading("X-02", "REFINE", "Launch")
    for label, values in (
        ("Current", ["Some text."]),
        ("Desired", ["Better text."]),
        ("User value", ["Clear."]),
        ("Acceptance", ["Checked."]),
        ("Evidence", ["First evidence.", "Second evidence."]),
        ("Open decision", [None]),
    ):
        p = doc.add_paragraph()
        run(p, label, True)
        for value in values:
            vp = doc.add_paragraph()
            if value is not None:
                run(vp, value)
    doc.add_paragraph()
    heading("X-03", "LATER", "After launch", single=True)
    field_table({"Current": "Desktop."})
    doc.add_paragraph()
    doc.add_paragraph("6. Next section")
    doc.add_heading("16. DECISION register", 1)
    table([["ID", "Decision", "Suggested default if unanswered"], ["X-02", "Click?", "Open the tab."]])
    doc.add_heading("17. LATER register", 1)
    table([["ID", "Deferred"], ["X-03", "Mobile."]])
    doc.add_heading("18. Traceability appendix", 1)
    table([
        ["ID", "Status", "Depends on", "Verification"],
        ["X-01", "TARGET", "None", "Not tested"],
        ["X-03", "LATER", "None", "Not tested"],
    ])
    section = doc.sections[0]
    section.header.paragraphs[0].text = "IntoFocus AI Dashboard — Functional Design Document"
    footer = section.footer.paragraphs[0]
    run(footer, "IntoFocus AI · FDD 1.0 · November 1, 2026 · Fender pilot · Confidential ")
    run(footer, "")
    doc.save(path)


def _plan_checks(check, cli, tmp: str, base: str) -> None:
    import shutil

    from docx.shared import Pt
    from docx.text.paragraph import Paragraph

    checker = _check_module()
    live = os.path.join(tmp, "plan-live.docx")
    new = os.path.join(tmp, "plan-new.docx")
    pub = os.path.join(tmp, "plan-pub.docx")
    changelog = "|".join(TABLES["changelog"])

    seeded = os.path.join(tmp, "plan-seed.docx")
    doc = open_doc(base)
    add_changelog_row(doc, "2026-11-02", "1.1 Second.", "Fix.", "PR 2.")
    doc.save(seeded)
    check("pub splits rows into a table after one empty paragraph",
          cli("pub", seeded, live, "--split", f"{changelog}:1") == 0)
    doc = open_doc(live)
    group = table_group(doc, "changelog")
    blank = group[0].getnext()
    check("pub result reads as the table plus one continuation",
          len(group) == 2 and blank is not None and _is_blank(blank) and blank.getnext() is group[1]
          and [len(t.findall(w("tr"))) for t in group] == [2, 1]
          and text_of(group[1].find(w("tr")).find(w("tc"))) == "2026-11-02")
    check("pub keeps every paragraph's text",
          [p for p in checker.read_docx(live)[0] if p] == [p for p in checker.read_docx(seeded)[0] if p])
    check("pub refuses a malformed --split", cli("pub", seeded, pub, "--split", "Date|Change") == 1)
    check("pub refuses to move every row", cli("pub", seeded, pub, "--split", f"{changelog}:9") == 1)

    check("plan of a doc against itself has no steps",
          cli("plan", live, live) == 0 and cli.output.splitlines()[-1] == "No changes: NEW matches LIVE.")

    shutil.copy(live, new)
    for argv in (
        ("set-version", new, "2.0", "--date", "November 5, 2026"),
        ("set-status", new, "X-01", "CURRENT"),
        ("append", new, "X-02", "Evidence", "Pull request 9."),
        ("set", new, "X-02", "Open decision", "Pending Brian."),
        ("clone", new, "X-02", "X-02", "X-04", "--status", "DECISION"),
        ("changelog", new, "2.0 Third.", "Approved.", "PR 3.", "--date", "2026-11-05"),
        ("add-row", new, "trace", "X-04", "DECISION", "None", "Not tested"),
    ):
        if cli(*argv) != 0:
            check(f"plan sample edit {argv[0]}", False)
    doc = open_doc(new)
    evidence = find_field(doc, "X-04", "Evidence").paragraphs[-1]
    Paragraph(evidence, doc._body).paragraph_format.left_indent = Pt(14.4)
    doc.save(new)

    code = cli("plan", live, new)
    out = cli.output
    steps = re.findall(r"^\d+\. .*$", out, re.M)
    check("plan runs and self-checks OK", code == 0 and "\nSelf-check: OK." in out, out[-400:])
    live_text = "\n".join(checker.read_docx(live)[0])
    live_pars = checker.read_docx(live)[0]
    finds = [json.loads("{" + m + "}")["find"] for m in re.findall(r'^   replace_text \{("find": .*?, "replace": .*?)\}$', out, re.M)]
    check("every replace_text find is unique, at least 24 characters or a whole paragraph, and whole words",
          finds and all(
              _count(live_text, f) == 1
              and (len(f) >= MIN_FIND or f in live_pars)
              and _word_bounds(f, 0, len(f)) == (0, len(f))
              for f in finds), str(finds))
    check("a status change restyles ID, status, and phase",
          '"X-01   CURRENT   ·   Launch"' in out
          and '"bold": true, "textColor": "#0F2C4C", "fontSize": 12}   (ID)' in out
          and '"bold": true, "textColor": "#166534", "fontSize": 12}   (CURRENT)' in out
          and '"bold": false, "textColor": "#64748B"}   (phase)' in out)
    check("a date replace expects 2 changes because the footer has it too",
          '"find": "November 1, 2026"' in out and "Expect occurrencesChanged = 2 (1 here and 1 in the header or footer)." in out)
    check("a repeated short text becomes a POSITION edit with an occurrence",
          any(s.startswith(tuple(f"{n}. POSITION edit" for n in range(1, 99))) for s in steps)
          and re.search(r'find_text \{"text": "1\.0", "occurrence": \d+\}', out) is not None)
    check("an empty field paragraph is found from the paragraph above it",
          '"text": "Pending Brian.\\n"' in out and "the paragraph above the empty one" in out)
    check("appended rows become a new table in the empty paragraph after the last continuation",
          f"[table {changelog}]" in out and '"rows": 1, "columns": 4, "index": E.start}' in out
          and out.index('row 1, column 4: "PR 3."') < out.index('row 1, column 1: "2026-11-05"'))
    check("pub arguments list every appended table",
          f"--split '{changelog}:1'" in out and "--split 'ID|Status|Depends on|Verification:1'" in out)
    check("a cloned paragraph row is inserted with NORMAL_TEXT and its indent",
          any("insert " in s and "[row X-04]" in s for s in steps)
          and '"namedStyleType": "NORMAL_TEXT"' in out and '"indentStart": 14.4' in out
          and '"bold": true, "textColor": "#6D28D9"}' in out)
    check("the footer is set with set_header_footer",
          'set_header_footer {"kind": "footer", "text": "IntoFocus AI · FDD 2.0 · November 5, 2026 · Fender pilot · Confidential "}' in out)
    check("steps run from the bottom of the document up",
          out.index("[table ID|Status|Depends on|Verification]") < out.index("[row X-04]")
          < out.index("[row X-01]") < out.index(f"[table {changelog}]") < out.index("[body text]"))

    planner = _Planner(live, new, True)
    planner.build()
    split_args = [arg for name, count in planner.splits.items() for arg in ("--split", f"{name}:{count}")]
    check("pub with the printed splits matches the planned live text",
          cli("pub", new, pub, *split_args) == 0
          and checker.first_difference([p.text for p in planner.model], checker.read_docx(pub)[0]) is None
          and checker.read_docx(pub)[2] == planner.footer)

    history = os.path.join(tmp, "plan-history.docx")
    shutil.copy(live, history)
    cli("set-cell", history, "changelog", "2026-11-01", "Change", "1.0 First, reworded.")
    code = cli("plan", live, history)
    check("an edit to a published change-log row is skipped and flagged",
          code == 0 and "\nSkipped (change-log history is never rewritten" in cli.output
          and "1.0 First, reworded." in cli.output and not re.search(r"^1\. ", cli.output, re.M))
    code = cli("plan", live, history, "--no-keep-history")
    check("--no-keep-history plans the change-log edit",
          code == 0 and "Skipped" not in cli.output and "\nSelf-check: OK." in cli.output
          and '"replace": "1.0 First, reworded."' in cli.output)

    long_live = os.path.join(tmp, "plan-long-live.docx")
    long_new = os.path.join(tmp, "plan-long-new.docx")
    cli("set", live, "X-02", "Desired", " ".join(["alpha"] * 220), "--out", long_live)
    cli("set", long_live, "X-02", "Desired", " ".join(["omega"] * 220), "--out", long_new)
    code = cli("plan", long_live, long_new)
    check("a rewrite longer than replace_text accepts becomes a POSITION edit",
          code == 0 and "POSITION edit   [row X-02 Desired]" in cli.output and "replace_text {" not in cli.output
          and "\nSelf-check: OK." in cli.output)

    middle = os.path.join(tmp, "plan-middle.docx")
    shutil.copy(live, middle)
    cli("add-row", middle, "trace", "X-09", "TARGET", "None", "Not tested", "--after", "X-01")
    check("rows added mid-table are refused with a warning",
          cli("plan", live, middle) == 0 and "the plugin cannot insert rows into a table" in cli.output)


def _stage_retry_checks(check, tmp: str, sample: str) -> None:
    import contextlib
    import http.client
    import io
    import socket
    import ssl

    spec = importlib.util.spec_from_file_location("stage_design_docx", os.path.join(SCRIPTS_DIR, "stage-design-docx.py"))
    stage = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stage)
    payload = open(sample, "rb").read()
    direct = "https://tmpfiles.org/dl/123/sample.docx"

    class Response:
        def __init__(self, body: bytes, content_type: str = "application/octet-stream", status: int = 200):
            self.body, self.status = body, status
            self.headers = {"content-type": content_type}

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return self.body

    def fake_urlopen(failures):
        state = {"calls": 0}

        def opener(req, timeout=None):
            state["calls"] += 1
            if failures:
                error = failures.pop(0)
                if isinstance(error, int):
                    return Response(b"busy", "text/html", error)
                raise error
            url = req.full_url
            if url == stage.UPLOAD_URL:
                return Response(b'{"data":{"url":"https://tmpfiles.org/123/sample.docx"}}', "application/json")
            if url.startswith("https://tmpfiles.org/dl/"):
                return Response(payload)
            return Response(f'<a href="{direct}">x</a>'.encode(), "text/html")

        return opener

    def run_stage(failures, opener=None):
        delays: list[int] = []
        out, err = io.StringIO(), io.StringIO()
        original = (stage.urllib.request.urlopen, stage.time.sleep, sys.argv)
        stage.urllib.request.urlopen = opener or fake_urlopen(failures)
        stage.time.sleep = delays.append
        sys.argv = ["stage-design-docx.py", sample]
        code = 0
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                stage.main()
        except SystemExit as exit_:
            code = exit_.code
        finally:
            stage.urllib.request.urlopen, stage.time.sleep, sys.argv = original
        return code, out.getvalue(), err.getvalue(), delays

    code, out, err, delays = run_stage([
        http.client.RemoteDisconnected("Remote end closed connection"),
        ssl.SSLError("The read operation timed out"),
        503,
    ])
    check("stage retries RemoteDisconnected, SSL, and HTTP 503 with 5s/15s/45s backoff",
          code == 0 and out == direct + "\n" and delays == [5, 15, 45])
    code, out, err, delays = run_stage([socket.timeout("timed out"), urllib.error.URLError(socket.gaierror("DNS"))])
    check("stage retries a timeout and a DNS failure, then prints one URL", code == 0 and out.splitlines() == [direct])
    code, out, err, delays = run_stage([TimeoutError("timed out")] * 4)
    check("stage stops after 4 attempts with one final error line",
          code == 1 and out == "" and delays == [5, 15, 45]
          and err.splitlines()[-1].startswith("staging failed after 4 attempts: "))

    def refuse_name(req, timeout=None):
        body = b'{"status":"error","message":"Invalid file name."}'
        raise urllib.error.HTTPError(req.full_url, 422, "Unprocessable", {"content-type": "application/json"}, io.BytesIO(body))

    code, out, err, delays = run_stage([], refuse_name)
    check("stage fails at once on a refused file name and shows the host's message",
          code == 1 and out == "" and delays == []
          and err.strip() == "staging failed: upload failed with HTTP 422: Invalid file name.", err)


def selftest() -> int:
    import tempfile

    ensure_docx()
    from docx.shared import RGBColor

    passed = 0
    failures: list[str] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        nonlocal passed
        if ok:
            passed += 1
            print(f"ok    {name}")
        else:
            failures.append(name)
            print(f"FAIL  {name}" + (f": {detail}" if detail else ""))

    def cli(*argv: str) -> int:
        import contextlib
        import io

        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = main(list(argv))
        cli.output = out.getvalue()
        return code

    tmp = tempfile.mkdtemp(prefix="design-doc-edit-")
    base = os.path.join(tmp, "base.docx")
    work = os.path.join(tmp, "work.docx")
    _build_sample(base)
    import shutil

    shutil.copy(base, work)

    def reopen():
        return open_doc(work)

    def heading_runs(doc, rid):
        heading = find_row(doc, rid)[0]
        return [(text_of(r), r.find(w("rPr"))) for r in heading.findall(w("r"))]

    def status_color(doc, rid):
        heading = find_row(doc, rid)[0]
        runs = heading.findall(w("r"))
        color = runs[1].find(w("rPr")).find(w("color"))
        return text_of(runs[1]), color.get(w("val")).upper() if color is not None else None

    check("rows lists every row", cli("rows", work) == 0 and [line.split()[0] for line in cli.output.splitlines()] == ["X-01", "X-02", "X-03"])

    check("set-version", cli("set-version", work, "2.0", "--date", "November 5, 2026") == 0)
    doc = reopen()
    fields = find_table(doc, "fields")
    footer = "".join(text_of(root) for root in _footer_roots(doc))
    check("set-version updates the first line", first_line(work) == "Documentation version: 2.0")
    check("set-version updates Field|Value Version and Date",
          text_of(_row_by_key(fields, "Version")) == "Version2.0" and text_of(_row_by_key(fields, "Date")) == "DateNovember 5, 2026")
    check("set-version updates the footer", footer == "IntoFocus AI · FDD 2.0 · November 5, 2026 · Fender pilot · Confidential ", footer)

    check("set-status on a four-run heading", cli("set-status", work, "X-01", "CURRENT") == 0)
    doc = reopen()
    check("set-status sets the word and the CURRENT color", status_color(doc, "X-01") == ("CURRENT", "166534"), str(status_color(doc, "X-01")))
    check("set-status keeps the heading text shape", text_of(find_row(doc, "X-01")[0]) == "X-01   CURRENT   ·   Launch")
    check("set-status splits a one-run heading", cli("set-status", work, "X-03", "TARGET", "--phase", "Before second client") == 0)
    doc = reopen()
    check("split heading has id, status, and phase runs",
          [t for t, _ in heading_runs(doc, "X-03")] == ["X-03   ", "TARGET", "   ·   Before second client"]
          and status_color(doc, "X-03") == ("TARGET", "1D4ED8"))

    check("get a table field", cli("get", work, "X-01", "Evidence") == 0 and cli.output == "Not live.\n")
    check("get a paragraph field with two paragraphs",
          cli("get", work, "X-02", "Evidence") == 0 and cli.output == "First evidence.\nSecond evidence.\n")
    check("get Status source", cli("get", work, "X-02", "Status source") == 0 and cli.output == "Explicit\n")

    check("set a table field", cli("set", work, "X-01", "Evidence", "Live. PR 2.") == 0)
    check("append to a table field", cli("append", work, "X-01", "Evidence", "Commit abc1234.") == 0)
    check("replace in a table field", cli("replace", work, "X-01", "Evidence", "PR 2", "PR 3") == 0)
    check("append a paragraph to a table field", cli("append", work, "X-01", "Current", "Second line.", "--paragraph") == 0)
    doc = reopen()
    check("table field edits land", get_field(doc, "X-01", "Evidence") == "Live. PR 3. Commit abc1234."
          and get_field(doc, "X-01", "Current") == "Not built.\nSecond line.", get_field(doc, "X-01", "Evidence"))

    check("set a paragraph field collapses its paragraphs", cli("set", work, "X-02", "Evidence", "One evidence.") == 0)
    check("set an empty paragraph field", cli("set", work, "X-02", "Open decision", "None.") == 0)
    check("append a paragraph to a paragraph field", cli("append", work, "X-02", "Evidence", "Two.", "--paragraph") == 0)
    check("replace in a paragraph field", cli("replace", work, "X-02", "Current", "Some", "All") == 0)
    check("set multi-line text", cli("set", work, "X-02", "Desired", "Line A.\nLine B.") == 0)
    check("set Status source", cli("set", work, "X-02", "Status source", "Meeting 5 Nov 2026") == 0)
    doc = reopen()
    check("paragraph field edits land",
          get_field(doc, "X-02", "Evidence") == "One evidence.\nTwo."
          and get_field(doc, "X-02", "Open decision") == "None."
          and get_field(doc, "X-02", "Current") == "All text."
          and get_field(doc, "X-02", "Desired") == "Line A.\nLine B."
          and text_of(find_row(doc, "X-02")[1]) == "Status source: Meeting 5 Nov 2026",
          show_row(doc, "X-02"))
    check("paragraph labels stay in place",
          [text_of(el) for el in find_row(doc, "X-02") if text_of(el) in FIELD_LABELS] == list(FIELD_LABELS))

    heading = find_row(doc, "X-01")[0]
    heading.set(W14_IDS[0], "0000ABCD")
    doc.save(work)
    check("clone a row", cli("clone", work, "X-01", "X-02", "X-04", "--status", "DECISION") == 0)
    doc = reopen()
    check("clone lands after the named row", row_ids(doc) == ["X-01", "X-02", "X-04", "X-03"], str(row_ids(doc)))
    check("clone renames and recolors", text_of(find_row(doc, "X-04")[0]) == "X-04   DECISION   ·   Launch"
          and status_color(doc, "X-04") == ("DECISION", "6D28D9"))
    check("clone copies fields and drops paragraph ids",
          get_field(doc, "X-04", "Evidence") == "Live. PR 3. Commit abc1234."
          and find_row(doc, "X-04")[0].get(W14_IDS[0]) is None)
    check("clone edits do not touch the source",
          cli("set", work, "X-04", "Evidence", "Not live.") == 0
          and get_field(reopen(), "X-01", "Evidence") == "Live. PR 3. Commit abc1234.")
    check("clone refuses an existing id", cli("clone", work, "X-01", "X-02", "X-03") == 1)

    check("changelog appends a row", cli("changelog", work, "2.0 Second.", "Approved.", "PR 3.", "--date", "2026-11-05") == 0)
    doc = reopen()
    rows = find_table(doc, "changelog").findall(w("tr"))
    check("changelog row is last with four cells",
          [text_of(tc) for tc in rows[-1].findall(w("tc"))] == ["2026-11-05", "2.0 Second.", "Approved.", "PR 3."]
          and len(rows) == 3)
    check("add-row refuses the wrong column count", cli("add-row", work, "changelog", "a", "b") == 1)
    check("add-row to DECISION", cli("add-row", work, "decision", "X-04", "Which one?", "The first.") == 0)
    check("add-row to LATER", cli("add-row", work, "later", "X-05", "Exports.") == 0)
    check("add-row to traceability after a row", cli("add-row", work, "trace", "X-04", "DECISION", "None", "Not tested", "--after", "X-01") == 0)
    check("add-row by header text", cli("add-row", work, "ID|Deferred", "X-06", "Avatars.") == 0)
    check("set-cell in traceability", cli("set-cell", work, "trace", "X-01", "Status", "CURRENT") == 0)
    doc = reopen()
    trace = [[text_of(tc) for tc in tr.findall(w("tc"))] for tr in find_table(doc, "trace").findall(w("tr"))]
    check("register rows land", [r[0] for r in trace] == ["ID", "X-01", "X-04", "X-03"] and trace[1][1] == "CURRENT", str(trace))
    later = [text_of(tr.findall(w("tc"))[0]) for tr in find_table(doc, "later").findall(w("tr"))]
    decision = [text_of(tr.findall(w("tc"))[0]) for tr in find_table(doc, "decision").findall(w("tr"))]
    check("DECISION and LATER rows are appended", later == ["ID", "X-03", "X-05", "X-06"] and decision[-1] == "X-04")

    check("replace-all across runs", cli("replace-all", work, "Brand Portfolio", "Summary") == 0 and "(replaced 1)" in cli.output)
    check("replace-all reaches the header", cli("replace-all", work, "Dashboard —", "Dashboard -") == 0)
    paragraphs, header, _ = _check_module().read_docx(work)
    check("replace-all result", "Former name: Summary. Approved." in paragraphs and header.endswith("Dashboard - Functional Design Document"))
    check("replace-all reports missing text", cli("replace-all", work, "no such text", "x") == 1)

    before = open(work, "rb").read()
    check("unknown row fails", cli("set", work, "Z-99", "Evidence", "x") == 1)
    check("unknown field fails", cli("set", work, "X-01", "Owner", "x") == 1)
    check("a failed edit saves nothing", open(work, "rb").read() == before)
    check("set-status refuses an unknown status", _expect_exit(lambda: main(["set-status", work, "X-01", "DONE"])) == 2)

    check("--out leaves the input alone", cli("set-status", work, "X-02", "CURRENT", "--out", os.path.join(tmp, "out.docx")) == 0
          and open(work, "rb").read() == before and status_color(open_doc(os.path.join(tmp, "out.docx")), "X-02")[0] == "CURRENT")

    lines = diff_docs(base, work)
    check("diff reports the version line", "  - Documentation version: 1.0" in lines and "  + Documentation version: 2.0" in lines)
    check("diff reports added rows and the footer", any(line == "  + X-04   DECISION   ·   Launch" for line in lines) and "footer changed" in lines)
    check("diff of a file with itself", diff_docs(work, work) == ["No differences."])
    check("diff CLI", cli("diff", base, work) == 0 and cli.output.strip().endswith("paragraphs."))

    copy_path = os.path.join(tmp, "downloaded.docx")
    check("download via an export URL", download("fdd", copy_path, url="file://" + work, delays=()) == "Documentation version: 2.0"
          and diff_docs(work, copy_path) == ["No differences."])
    html = os.path.join(tmp, "page.html")
    with open(html, "w") as handle:
        handle.write("<html>sign in</html>")
    try:
        download("tdd", copy_path, url="file://" + html, delays=())
        check("download rejects a non-docx", False)
    except EditError:
        check("download rejects a non-docx", True)
    try:
        download("fdd", copy_path, url="file://" + os.path.join(tmp, "missing.docx"), delays=())
        check("download reports a failed request", False)
    except EditError as error:
        check("download reports a failed request", "after 1 attempts" in str(error))

    doc = reopen()
    for rid in ("X-01", "X-02", "X-03", "X-04"):
        heading = find_row(doc, rid)[0]
        status_run = heading.findall(w("r"))[1]
        expected = STATUS_COLORS[text_of(status_run)]
        rgb = status_run.find(w("rPr")).find(w("color")).get(w("val")).upper()
        if rgb != expected:
            check(f"{rid} color matches its status", False, rgb)
            break
    else:
        check("every status word carries its color", True)
    check("RGBColor import works", RGBColor.from_string("166534") is not None)

    _plan_checks(check, cli, tmp, base)
    _stage_retry_checks(check, tmp, base)

    if failures:
        print(f"selftest FAILED: {len(failures)} of {passed + len(failures)} checks")
        return 1
    print(f"selftest passed: {passed} checks")
    return 0


def _expect_exit(call) -> int:
    import contextlib
    import io

    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return call()
    except SystemExit as exit_:
        return exit_.code


if __name__ == "__main__":
    raise SystemExit(main())
