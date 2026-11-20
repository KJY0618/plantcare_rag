import json
from datetime import datetime
from pathlib import Path

STORAGE = Path(__file__).resolve().parent / "storage"


def load(name):
    p = STORAGE / f"{name}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def save(name, rows):
    STORAGE.mkdir(parents=True, exist_ok=True)
    (STORAGE / f"{name}.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def add(name, row):
    rows = load(name)
    row["id"] = max((r["id"] for r in rows), default=0) + 1
    row["created_at"] = datetime.now().isoformat(timespec="seconds")
    rows.append(row)
    save(name, rows)
    return row


def update(name, id_, changes):
    rows = load(name)
    for r in rows:
        if r["id"] == id_:
            r.update(changes)
            save(name, rows)
            return r