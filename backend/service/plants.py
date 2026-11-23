## """내 식물 CRUD (B)"""
import json
from datetime import date, datetime
from pathlib import Path
from fastapi import HTTPException

from service import species as species_service   # 도감 정보를 읽어 올 때 사용 (읽기만)
from service.photos import delete_photo

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

# ----- 아래부터 목록 / 조회 / 수정 / 삭제 (B) -----

def _list_item(plant):
    """목록 화면에서 쓸 모양으로 식물 한 건을 바꾼다."""
    # 도감에서 고른 식물이면 도감 정보를 찾아온다.
    species = species_service.get_species(plant["species_id"]) if plant["species_id"] else None

    # 사진 순서 : 내 대표 사진 -> 도감 썸네일 -> 없으면 None (화면에서 기본 이미지)
    if plant["photo_path"]:
        photo_url = f"/uploads/{plant['photo_path']}"
    else:
        photo_url = species["thumb_url"] if species else None

    return {
        "id": plant["id"],
        "nickname": plant["nickname"],
        # 종류 이름 : 도감 식물이면 도감 이름, 아니면 직접 입력한 이름
        "species_name": species["name"] if species else plant["custom_species_name"],
        "location": plant["location"],
        "photo_url": photo_url,
    }


# 내 식물 목록 (검색·필터)
#   keyword  : 별명 또는 종류 이름에 이 글자가 들어 있는 식물
#   location : 위치에 이 글자가 들어 있는 식물
#   log_type : 이 종류의 케어 기록(water, fertilizer, repot, issue)이 한 번이라도 있는 식물
# 조건을 안 주면(None) 그 조건은 적용하지 않는다. 조건을 여러 개 주면 모두 만족하는 식물만 나온다.
def list_plants(keyword=None, location=None, log_type=None):
    rows = _load(PLANTS)

    if log_type:
        has_log = {l["plant_id"] for l in _load(LOGS) if l["log_type"] == log_type}
        rows = [p for p in rows if p["id"] in has_log]
    if location and location.strip():
        word = location.strip().lower()
        rows = [p for p in rows if word in (p["location"] or "").lower()]

    items = [_list_item(p) for p in rows]
    if keyword and keyword.strip():
        word = keyword.strip().lower()
        items = [i for i in items
                 if word in i["nickname"].lower() or word in (i["species_name"] or "").lower()]
    return items


def get_plant(plant_id):
    """식물 한 건의 원본 데이터 (없으면 None). 내 식물 상세(C)에서도 사용한다."""
    return next((p for p in _load(PLANTS) if p["id"] == plant_id), None)


def update_plant(plant_id, nickname=None, water_interval_days=None, location=None,
                 purchase_date=None, new_photo=None, remove_photo=False):
    """보낸 항목만 바꾼다. None 은 '바꾸지 않음'. 위치와 구매일은 공백 한 칸을 보내면 지운다."""
    plants = _load(PLANTS)
    plant = next((p for p in plants if p["id"] == plant_id), None)
    if plant is None:
        return None

    # 값을 바꾸기 전에 먼저 전부 검사한다. (검사 도중 오류가 나도 데이터가 반쯤 바뀌지 않게)
    if nickname is not None:
        nickname = nickname.strip()
        if not nickname:
            raise HTTPException(422, "별명을 입력해 주세요.")
    change_date = purchase_date is not None     # 구매일을 바꾸라는 요청인지 (빈 칸이면 지우기)
    new_date = None
    if change_date and purchase_date.strip():
        try:
            new_date = date.fromisoformat(purchase_date.strip()).isoformat()
        except ValueError:
            raise HTTPException(422, "구매일은 YYYY-MM-DD 형식이어야 합니다.")

    # 검사를 통과했으면 보낸 항목만 바꾼다.
    if nickname is not None:
        plant["nickname"] = nickname
    if water_interval_days is not None:
        plant["water_interval_days"] = water_interval_days
    if location is not None:
        plant["location"] = location.strip() or None    # 공백만 오면 위치를 지운다.
    if change_date:
        plant["purchase_date"] = new_date

    old_photo = plant["photo_path"]
    if new_photo:                 # 새 사진으로 교체
        plant["photo_path"] = new_photo
    elif remove_photo:            # 사진만 지우기
        plant["photo_path"] = None

    plant["updated_at"] = datetime.now().isoformat(timespec="seconds")
    _save(PLANTS, plants)

    if plant["photo_path"] != old_photo:   # 저장이 끝난 뒤에 옛 사진 파일을 지운다.
        delete_photo(old_photo)
    return _list_item(plant)


def delete_plant(plant_id):
    """식물과 케어 기록, 사진 파일을 함께 지운다. 지웠으면 True, 없으면 False."""
    plants = _load(PLANTS)
    plant = next((p for p in plants if p["id"] == plant_id), None)
    if plant is None:
        return False

    # 이 식물만 빼고 다시 저장
    _save(PLANTS, [p for p in plants if p["id"] != plant_id])

    # 이 식물의 케어 기록도 함께 삭제 (이상 기록에 올린 사진 파일도 지운다.)
    logs = _load(LOGS)
    for log in logs:
        if log["plant_id"] == plant_id:
            delete_photo(log["photo_path"])      # 이상 기록 사진
    _save(LOGS, [l for l in logs if l["plant_id"] != plant_id])

    delete_photo(plant["photo_path"])            # 대표 사진
    # (2단계에서 Chroma 문서 정리를 여기에 추가)
    return True