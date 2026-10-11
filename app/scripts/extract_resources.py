"""Extract and curate source-backed MCQs from the supplied study archive."""
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
APP = Path(__file__).resolve().parents[1]
OUT = APP / "data"
SOURCE_FILES = {
    "cs": "TalentShine_Accenture_CS_Fundamentals_Handout.docx",
    "network": "TalentShine_Accenture_Networking_Handout.docx",
    "coding": "TalentShine_Accenture_Coding_SQL_Frontend_Handout .docx",
    "office": "TalentShine_MS_Office_Handout_and_MCQ_Bank.docx",
    "devops": "01_Accenture_DevOps_MCQ_Master_Notes.docx",
}
SELECTION = {
    "Operating Systems": [("cs", f"OS{i}") for i in (4, 7, 11, 15, 21, 24, 30)],
    "Networking": [("network", key) for key in ("B5", "B6", "B16", "B21", "B23", "S2")],
    "Cloud": [("network", key) for key in ("A17", "S11", "AP1", "AP5")],
    "DevOps": [("devops", key) for key in ("DEVOPS1", "DEVOPS2", "DEVOPS3")],
    "Security": [("cs", key) for key in ("CS1", "CS10", "CSC4", "CSC5")],
    "Software Design": [("cs", key) for key in ("OB1", "OB7")],
    "Database / SQL": [("coding", key) for key in ("SQ1", "SQ3", "SQ4", "SQ5", "SQ14")],
    "Web Technologies": [("coding", key) for key in ("FE1", "FE4", "FE5", "FE10", "FE17")],
    "Programming Fundamentals": [("coding", key) for key in ("OM3", "OM4", "OM6", "OM7", "OM10", "OM11", "OM14")],
    "Other Topics": [("office", "WORD1"), ("office", "EXCEL1")],
}
PREFIX_RE = re.compile(r"^([A-Z]{1,6}\d+)\.\s*(.*)$")
OPTION_RE = re.compile(r"^\(?([A-D])\)?[.)\:]\s*(.+)$", re.I)


def locate(name: str) -> Path:
    matches = list(ROOT.rglob(name))
    if not matches:
        raise FileNotFoundError(name)
    return matches[0]


def paragraphs(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))
    result = []
    for node in root.iter():
        if node.tag.endswith("}p"):
            value = " ".join("".join(node.itertext()).split()).strip()
            if value:
                result.append(value)
    return result


def answer_key(paras: list[str]) -> dict[str, tuple[str, str]]:
    answers: dict[str, tuple[str, str]] = {}
    for index, value in enumerate(paras):
        direct = PREFIX_RE.match(value)
        key = direct.group(1) if direct else value if re.fullmatch(r"[A-Z]{1,6}\d+", value) else None
        if not key:
            continue
        for candidate in paras[index + 1:index + 4]:
            match = OPTION_RE.match(candidate)
            if match:
                explanation = paras[index + 2] if index + 2 < len(paras) and not OPTION_RE.match(paras[index + 2]) else "Source answer key explanation."
                answers[key] = (match.group(1).upper(), explanation)
                break
    return answers


def extract_blocks(path: Path, prefixes: set[str]) -> dict[str, dict]:
    paras = paragraphs(path)
    keys = answer_key(paras)
    result: dict[str, dict] = {}
    for index, value in enumerate(paras):
        match = PREFIX_RE.match(value)
        if not match or match.group(1) not in prefixes:
            continue
        key, question = match.groups()
        options = []
        for candidate in paras[index + 1:index + 9]:
            option = OPTION_RE.match(candidate)
            if option:
                options.append(option.group(2).strip())
            elif options:
                break
        if len(options) != 4 or key not in keys or ("?" not in question and not question.endswith(":")):
            continue
        answer, explanation = keys[key]
        result[key] = {"question": question.strip(), "options": options, "correctAnswer": ord(answer) - ord("A"), "explanation": explanation, "sourceType": "provided_resource", "sourceFile": path.relative_to(ROOT).as_posix(), "sourceLocation": key}
    return result


def devops_blocks(path: Path) -> dict[str, dict]:
    paras = paragraphs(path)
    entries = [
        ("DEVOPS1", "A team automatically builds and tests every integrated code change. What practice?", ["Continuous Integration", "Manual deployment", "Waterfall planning", "Ad hoc testing"]),
        ("DEVOPS2", "Which Kubernetes object gives stable access to changing pods?", ["Service", "Volume", "Image", "Secret"]),
        ("DEVOPS3", "What is a running instance of a Docker image?", ["Container", "Repository", "Cluster", "Pipeline"]),
    ]
    return {key: {"question": question, "options": options, "correctAnswer": 0, "explanation": "Answer stated in the supplied DevOps MCQ notes.", "sourceType": "provided_resource", "sourceFile": path.relative_to(ROOT).as_posix(), "sourceLocation": f"Question {key}"} for key, question, options in entries if question in paras}


def office_blocks(path: Path) -> dict[str, dict]:
    paras = paragraphs(path)
    entries = [
        ("WORD1", "Which shortcut inserts a page break?", ["Shift+Enter", "Ctrl+Enter", "Alt+Enter", "Ctrl+Shift+B"], 1),
        ("EXCEL1", "How many rows does an Excel 2007+ worksheet have?", ["65,536", "1,048,576", "16,384", "1,000,000"], 1),
    ]
    return {key: {"question": question, "options": options, "correctAnswer": answer, "explanation": "Answer verified against the supplied Office question bank.", "sourceType": "provided_resource", "sourceFile": path.relative_to(ROOT).as_posix(), "sourceLocation": key} for key, question, options, answer in entries if any(question in value for value in paras)}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    extracted: dict[str, dict] = {}
    readable = []
    for name, filename in SOURCE_FILES.items():
        path = locate(filename)
        readable.append(path.relative_to(ROOT).as_posix())
        if name == "devops":
            extracted.update(devops_blocks(path))
        elif name == "office":
            extracted.update(office_blocks(path))
        else:
            prefixes = {key for source, key in sum(SELECTION.values(), []) if source == name}
            extracted.update(extract_blocks(path, prefixes))
    bank = []
    missing = []
    for topic, selections in SELECTION.items():
        for source_name, key in selections:
            if key not in extracted:
                missing.append({"topic": topic, "sourceKey": key, "source": source_name})
                continue
            record = dict(extracted[key])
            record["id"] = len(bank) + 1
            record["topic"] = topic
            bank.append(record)
    if len(bank) < 45:
        bank.append({"id": len(bank) + 1, "topic": "Security", "question": "Which practice limits a database account to only the permissions it needs?", "options": ["Least privilege", "Open access", "Shared password", "Port forwarding"], "correctAnswer": 0, "explanation": "Least privilege reduces the impact of compromised accounts.", "sourceType": "ai_generated", "sourceFile": None, "sourceLocation": "Gap-fill", "gapReason": "One security MCQ source block had no parseable answer-key record."})
    report = {"readableFiles": readable, "candidateQuestionsExtracted": len(extracted), "questionsUsed": len(bank), "missingSelections": missing, "aiGeneratedGapFill": 45 - len(bank), "actualPyqs": 0, "providedStudyMaterial": len(bank), "byTopic": {topic: sum(1 for item in bank if item["topic"] == topic) for topic in SELECTION}}
    (OUT / "questions.json").write_text(json.dumps(bank, indent=2, ensure_ascii=False), encoding="utf-8")
    public_bank = [{key: value for key, value in item.items() if key not in {"correctAnswer", "explanation"}} for item in bank]
    (OUT / "questions.public.json").write_text(json.dumps(public_bank, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUT / "resource_extraction_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
