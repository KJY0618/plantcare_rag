"""도감 조회·검색·광도 필터 (A)"""

import json
from pathlib import Path

FILE = Path(__file__).resolve().parent.parent / "storage" / "species.json"


# JSON 데이터 읽기
def load_species():
    if not FILE.exists():
        return []

    return json.loads(FILE.read_text(encoding="utf-8"))


# 특정 식물 상세 조회
def get_species(species_id):
    rows = load_species()

    return next(
        (r for r in rows if str(r["id"]) == str(species_id)),
        None
    )


# 전체 식물 목록 조회
def get_species_list():
    return load_species()


# 식물 이름 및 학명 검색
def search_species(keyword):
    rows = load_species()

    if not keyword:
        return rows

    keyword = keyword.strip().casefold()

    return [
        r for r in rows
        if keyword in r.get("name", "").casefold()
        or keyword in r.get("scientific_name", "").casefold()
        or keyword in r.get("english_name", "").casefold()
    ]


# 광도 필터
def filter_species_by_light(light):
    rows = load_species()

    if not light:
        return rows

    return [
        r for r in rows
        if any(
            light in tag
            for tag in r.get("tags", {}).get("light", [])
        )
    ]


# 검색 및 광도 필터 통합
def find_species(keyword=None, light=None):
    rows = load_species()

    if keyword:
        keyword = keyword.strip().casefold()

        rows = [
            r for r in rows
            if keyword in r.get("name", "").casefold()
            or keyword in r.get("scientific_name", "").casefold()
            or keyword in r.get("english_name", "").casefold()
        ]

    if light:
        rows = [
            r for r in rows
            if any(
                light in tag
                for tag in r.get("tags", {}).get("light", [])
            )
        ]

    return rows


# 페이지네이션
def paginate_species(rows, page=1, limit=10):
    total = len(rows)

    start = (page - 1) * limit
    end = start + limit

    return {
        "items": rows[start:end],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }
