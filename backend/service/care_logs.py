# 케어 기록 (C)
# DB(MariaDB)로 바꿀 때 이 파일 안쪽만 수정함. (함수 이름은 그대로 유지)

from datetime import date, datetime, timedelta

from service import json_store


# 식물의 마지막으로 물 준 날짜 찾기 (물주기 기록이 없으면 None)
def get_last_watered(plant_id):
    care_logs = json_store.load("care_logs")   # 식물 등록(B)도 이 파일에 쓰기 때문에 매번 새로 읽음
    last = None
    for log in care_logs:
        if log["plant_id"] == plant_id and log["log_type"] == "water":
            day = date.fromisoformat(log["logged_at"])  # "2026-11-15" 글자를 날짜로 변경
            if last is None or day > last:              # 더 최근 날짜면 바꿈
                last = day
    return last


# 다음 물주기 날짜와 D-day 계산
#   다음 물주기 날짜 = 마지막으로 물 준 날짜 + 물주기 주기(일)
#   D-day = 다음 물주기 날짜 - 오늘  (0: 오늘 물 주기, 음수: 지난 날 수, 양수: 남은 날 수)
def calc_dday(last_watered, interval_days):
    next_date = last_watered + timedelta(days=interval_days)
    d_day = (next_date - date.today()).days
    return next_date, d_day


# 물주기 기록 추가 (logged_at 이 없으면 오늘 날짜)
def add_water_log(plant_id, logged_at=None):
    care_logs = json_store.load("care_logs")   # 1. 전체 읽기
    if logged_at is None:
        logged_at = date.today()

    new_log = {                                # 2. 새 기록 만들기
        "id": json_store.next_id(care_logs),
        "plant_id": plant_id,
        "log_type": "water",
        "logged_at": logged_at.isoformat(),    # 날짜를 "2026-11-15" 글자로 변경
        "memo": None,
        "photo_path": None,
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }
    care_logs.append(new_log)                  # 3. 목록에 추가
    json_store.save("care_logs", care_logs)    # 4. 전체 저장
    return new_log

# 도감(species.json)에서 식물 종류 한 건 찾기 (없으면 None)
def find_species(species_id):
    species_list = json_store.load("species")
    for species in species_list:
        if species["id"] == species_id:
            return species
    return None


# 현재 계절에 맞는 도감 물주기 칸 이름 (3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울)
def get_season_key():
    month = date.today().month
    if 3 <= month <= 5:
        return "water_spring"
    elif 6 <= month <= 8:
        return "water_summer"
    elif 9 <= month <= 11:
        return "water_autumn"
    else:
        return "water_winter"


# 정렬 기준으로 쓰는 함수 : D-day 값을 꺼냄
def get_d_day(item):
    return item["d_day"]


# 오늘 할 일 목록 : 모든 식물의 D-day 를 계산해서 D-day 가 작은 순(급한 순)으로 돌려줌
def get_today_list():
    plants = json_store.load("plants")
    result = []
    for plant in plants:
        last_watered = get_last_watered(plant["id"])
        if last_watered is None:      # 물주기 기록이 없으면 계산할 수 없으니 건너뜀
            continue
        next_date, d_day = calc_dday(last_watered, plant["water_interval_days"])

        # 도감에서 고른 식물이면 도감 정보를 찾음 (직접 입력한 식물이면 None)
        species = find_species(plant["species_id"])

        # 사진 : 내가 올린 사진 → 없으면 도감 사진 → 둘 다 없으면 None
        photo_url = None
        if plant["photo_path"]:
            photo_url = "/uploads/" + plant["photo_path"]
        elif species:
            photo_url = species["thumb_url"]

        # 도감의 현재 계절 물주기 문구
        season_water_text = None
        if species:
            season_water_text = species[get_season_key()]

        result.append({
            "plant_id": plant["id"],
            "nickname": plant["nickname"],
            "location": plant["location"],
            "photo_url": photo_url,
            "last_watered_at": last_watered.isoformat(),
            "water_interval_days": plant["water_interval_days"],
            "next_water_date": next_date.isoformat(),
            "d_day": d_day,
            "season_water_text": season_water_text,
        })

    result.sort(key=get_d_day)   # D-day 가 작은 순
    return result

# plants.json 에서 식물 한 건 찾기 (없으면 None)
def find_plant(plant_id):
    plants = json_store.load("plants")
    for plant in plants:
        if plant["id"] == plant_id:
            return plant
    return None


# 물주기 : 물주기 기록을 저장하고, 갱신된 다음 물주기 날짜와 D-day 를 돌려줌
#   없는 식물이면 None, 아직 물 줄 날이 아니면 "too_early" 를 돌려줌
def water_plant(plant_id, logged_at=None):
    plant = find_plant(plant_id)
    if plant is None:
        return None

    # 이미 물을 줬고 다음 물주기 날짜가 아직 안 됐으면 저장하지 않음 (D-day 가 1 이상이면 아직)
    # → 한 번 누르면 한 번만 저장되고, 주기가 지나 D-day 가 0 이 되어야 다시 저장할 수 있음
    last_before = get_last_watered(plant_id)
    if last_before is not None:
        next_before, d_day_before = calc_dday(last_before, plant["water_interval_days"])
        if d_day_before > 0:
            return "too_early"

    add_water_log(plant_id, logged_at)             # 1. 물주기 기록 저장
    last_watered = get_last_watered(plant_id)      # 2. 방금 기록까지 포함해서 마지막 물 준 날짜 찾기
    next_date, d_day = calc_dday(last_watered, plant["water_interval_days"])   # 3. 다시 계산
    return {
        "last_watered_at": last_watered.isoformat(),
        "next_water_date": next_date.isoformat(),
        "d_day": d_day,
    }