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
  python3 scripts/design-doc-edit.py selftest

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
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

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


def _row_by_key(tbl, key: str):
    for tr in tbl.findall(w("tr"))[1:]:
        cells = tr.findall(w("tc"))
        if cells and text_of(cells[0]).strip() == key:
            return tr
    raise EditError(f"no row whose first cell is {key!r}")


def add_table_row(tbl, values: list[str], after: str | None = None) -> None:
    rows = tbl.findall(w("tr"))
    template = rows[-1]
    width = len(template.findall(w("tc")))
    if len(values) != width:
        raise EditError(f"table has {width} columns; got {len(values)} values")
    new_row = copy.deepcopy(template)
    _strip_ids(new_row)
    for tc, value in zip(new_row.findall(w("tc")), values):
        set_cell_text(tc, value)
    anchor = _row_by_key(tbl, after) if after else template
    anchor.addnext(new_row)


def set_table_cell(tbl, key: str, column: str, text: str) -> None:
    header = [text_of(tc).strip() for tc in tbl.findall(w("tr"))[0].findall(w("tc"))]
    if column not in header:
        raise EditError(f"no column {column!r}; columns are {', '.join(header)}")
    cells = _row_by_key(tbl, key).findall(w("tc"))
    set_cell_text(cells[header.index(column)], text)


def add_changelog_row(doc, date: str, change: str, reason: str, reference: str) -> None:
    add_table_row(find_table(doc, "changelog"), [date, change, reason, reference])


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
            add_table_row(find_table(doc, args.table), args.values, args.after)
        elif args.command == "set-cell":
            set_table_cell(find_table(doc, args.table), args.key, args.column, _read_text(args.text))
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

    def table(rows):
        t = doc.add_table(rows=len(rows), cols=len(rows[0]))
        for tr, values in zip(t.rows, rows):
            for cell, value in zip(tr.cells, values):
                cell.text = value

    p = doc.add_paragraph()
    run(p, "Documentation version: 1.0", True)
    run(p, "")
    doc.add_paragraph("Functional Design Document")
    table([["Field", "Value"], ["Version", "1.0"], ["Date", "November 1, 2026"], ["Purpose", "Test."]])
    doc.add_paragraph()
    doc.add_heading("Change log", 1)
    table([["Date", "Change", "Reason", "Reference"], ["2026-11-01", "1.0 First.", "Start.", "PR 1."]])
    doc.add_paragraph()
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
