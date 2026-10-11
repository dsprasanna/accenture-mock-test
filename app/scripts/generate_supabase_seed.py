"""Generate a rerunnable Supabase seed from the private extracted question bank."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
questions = json.loads((ROOT / "data" / "questions.json").read_text(encoding="utf-8"))

def sql(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"

def json_sql(value: object) -> str:
    return sql(json.dumps(value, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"

rows = []
for item in questions:
    rows.append(
        "(" + ", ".join([
            str(item["id"]),
            sql(item["topic"]),
            sql(item["question"]),
            json_sql(item["options"]),
            str(item["correctAnswer"]),
            sql(item["explanation"]),
            sql("moderate"),
            sql(item.get("sourceFile")),
            sql(item.get("sourceLocation")),
            sql(item["sourceType"]),
        ]) + ")"
    )

output = """-- Generated from data/questions.json. Do not edit manually.\n-- Rerun: python scripts/generate_supabase_seed.py\n\ninsert into public.technical_questions\n  (id, topic, prompt, options, answer_index, explanation, difficulty, source_file, source_location, source)\nvalues\n""" + ",\n".join(rows) + "\non conflict (id) do update set\n  topic = excluded.topic,\n  prompt = excluded.prompt,\n  options = excluded.options,\n  answer_index = excluded.answer_index,\n  explanation = excluded.explanation,\n  difficulty = excluded.difficulty,\n  source_file = excluded.source_file,\n  source_location = excluded.source_location,\n  source = excluded.source;\n"
(ROOT / "supabase" / "seed.sql").write_text(output, encoding="utf-8")
print(f"Generated {len(questions)} technical question seed rows")
