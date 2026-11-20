"""내 식물 CRUD (B)"""
import json
from datetime import datetime
from pathlib import Path

STORAGE = Path(__file__).resolve().parent.parent / "storage"
PLANTS = STORAGE / "plants.json"
LOGS = STORAGE / "care_logs.json"


def _load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def _save(path, rows):
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _next_id(rows):
    return max((r["id"] for r in rows), default=0) + 1


def create_plant(nickname, water_interval_days, last_watered_at,
                 species_id=None, custom_species_name=None,
                 location=None, purchase_date=None, photo_path=None):
    now = datetime.now().isoformat(timespec="seconds")

    plants = _load(PLANTS)
    plant = {
        "id": _next_id(plants),
        "species_id": species_id,
        "custom_species_name": custom_species_name,
        "nickname": nickname,
        "location": location,
        "purchase_date": purchase_date.isoformat() if purchase_date else None,
        "water_interval_days": water_interval_days,
        "photo_path": photo_path,
        "created_at": now,
        "updated_at": now,
    }
    plants.append(plant)
    _save(PLANTS, plants)

    # 마지막으로 물 준 날짜는 첫 물주기 기록으로 저장
    logs = _load(LOGS)
    logs.append({
        "id": _next_id(logs),
        "plant_id": plant["id"],
        "log_type": "water",
        "logged_at": last_watered_at.isoformat(),
        "memo": None,
        "photo_path": None,
        "created_at": now,
    })
    _save(LOGS, logs)
    return plant["id"]