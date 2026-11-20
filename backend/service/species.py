"""도감 조회·검색·광도 필터 (A)"""
import json
from pathlib import Path

FILE = Path(__file__).resolve().parent.parent / "storage" / "species.json"


def get_species(species_id):
    rows = json.loads(FILE.read_text(encoding="utf-8")) if FILE.exists() else []
    return next((r for r in rows if r["id"] == species_id), None)
