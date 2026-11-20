"""농사로 OpenAPI(실내정원용 식물) -> species.json 저장 (DB 구축 전 단계)

사용법
  python scripts/import_species_json.py --limit 3     # 먼저 3개만 받아서 구조 확인
  python scripts/import_species_json.py               # 전체 받기

필요한 것
  pip install requests
  backend/.env 에 NONGSARO_API_KEY=발급받은키
결과
  backend/storage/species.json  (5-2 plant_species 컬럼 이름 + tags)
"""
import argparse
import json
import os
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

import requests

BASE = "http://api.nongsaro.go.kr/service/garden"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "storage" / "species.json"


def load_key():
    key = os.environ.get("NONGSARO_API_KEY")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("NONGSARO_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    if not key:
        raise SystemExit("NONGSARO_API_KEY 가 없습니다. backend/.env 를 확인하세요.")
    return key


def call(path, **params):
    r = requests.get(f"{BASE}/{path}", params=params, timeout=15)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    code = root.findtext(".//resultCode") or root.findtext(".//header/resultCode")
    if code not in (None, "00", "0"):
        msg = root.findtext(".//resultMsg") or root.findtext(".//header/resultMsg")
        raise SystemExit(f"API 오류 {code}: {msg}")
    return root


def text(el, tag):
    """빈 값은 None 으로 (화면에서 '도감에 정보가 없습니다' 표시)"""
    v = el.findtext(tag)
    v = v.strip() if v else None
    return v or None


def split_multi(v):
    """광요구도·배치장소처럼 쉼표로 오는 값을 나눠 저장"""
    if not v:
        return []
    return [x.strip() for x in v.split(",") if x.strip()]


def first_url(v):
    """사진 주소가 여러 개면 '|' 로 구분. 대표(REPR) 사진이 있으면 그걸, 없으면 첫 번째"""
    if not v:
        return None
    urls = [u.strip() for u in v.split("|") if u.strip()]
    return next((u for u in urls if "REPR" in u), urls[0] if urls else None)


def fetch_list(key, limit):
    items, page, rows = [], 1, 100
    while True:
        root = call("gardenList", apiKey=key, pageNo=page, numOfRows=rows)
        found = root.findall(".//item")
        for it in found:
            items.append({
                "cntnts_no": text(it, "cntntsNo"),
                "name": text(it, "cntntsSj"),
                "image_url": first_url(text(it, "rtnFileUrl")),
                "thumb_url": first_url(text(it, "rtnThumbFileUrl")),
            })
        total = int(root.findtext(".//totalCount") or 0)
        if not found or (limit and len(items) >= limit) or (total and len(items) >= total):
            break
        page += 1
        time.sleep(0.1)
    return items[:limit] if limit else items


def fetch_detail(key, base):
    root = call("gardenDtl", apiKey=key, cntntsNo=base["cntnts_no"])
    d = root.find(".//item")
    if d is None:
        return None
    return {
        "cntnts_no": base["cntnts_no"],
        "name": base["name"],
        "scientific_name": text(d, "plntbneNm"),
        "english_name": text(d, "plntzrNm"),
        "distribution_name": text(d, "distbNm"),
        "family_name": text(d, "fmlNm"),
        "origin": text(d, "orgplceInfo"),
        "growth_height": text(d, "growthHgInfo"),
        "growth_width": text(d, "growthAraInfo"),
        "leaf_form": text(d, "lefStleInfo"),
        "propagation_period": text(d, "prpgtEraInfo"),
        "fertilizer_info": text(d, "frtlzrInfo"),
        "soil_info": text(d, "soilInfo"),
        "water_spring": text(d, "watercycleSprngCodeNm"),
        "water_summer": text(d, "watercycleSummerCodeNm"),
        "water_autumn": text(d, "watercycleAutumnCodeNm"),
        "water_winter": text(d, "watercycleWinterCodeNm"),
        "winter_min_temp": text(d, "winterLwetTpCodeNm"),
        "manage_level": text(d, "managelevelCodeNm"),
        "manage_demand": text(d, "managedemanddoCodeNm"),
        "growth_temp": text(d, "grwhTpCodeNm"),
        "humidity": text(d, "hdCodeNm"),
        "function_info": text(d, "fncltyInfo"),
        "thumb_url": base["thumb_url"],
        "image_url": base["image_url"],
        "source": "농사로",
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
        "tags": {
            "light": split_multi(text(d, "lighttdemanddoCodeNm")),
            "placement": split_multi(text(d, "postngplaceCodeNm")),
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="앞에서 N개만 (0이면 전체)")
    args = ap.parse_args()

    key = load_key()
    bases = fetch_list(key, args.limit)
    print(f"목록 {len(bases)}개")

    result, seen = [], set()
    for i, b in enumerate(bases, 1):
        if b["cntnts_no"] in seen:
            continue
        seen.add(b["cntnts_no"])
        try:
            row = fetch_detail(key, b)
        except Exception as e:
            print(f"  [실패] {b['cntnts_no']} {b['name']}: {e}")
            continue
        if row:
            row["id"] = len(result) + 1
            result.append(row)
        print(f"  {i}/{len(bases)} {b['name']}")
        time.sleep(0.1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {OUT} ({len(result)}개)")
    mon = [r["name"] for r in result if "몬스테라" in (r["name"] or "")]
    print("몬스테라:", mon if mon else "없음")


if __name__ == "__main__":
    main()