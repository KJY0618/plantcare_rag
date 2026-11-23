# 맨 위 import
from datetime import date
from fastapi import FastAPI
from fastapi import File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from service import plants as plants_service
from service import species as species_service
from service.photos import UPLOAD_DIR, save_photo
from service import care_logs
from datetime import date                      
from fastapi import HTTPException              
from pydantic import BaseModel                  


app = FastAPI(title="PlantCare API")
# app = FastAPI() 아래
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)



# ===== 도감 (A) =====
@app.get("/species/{species_id}")
def get_species_detail(species_id: int):
    s = species_service.get_species(species_id)
    if s is None:
        raise HTTPException(404, "도감에 없는 식물입니다.")
    return s


# ===== 내 식물 (B) =====
@app.post("/plants", status_code=201)
async def create_plant(
    nickname: str = Form(..., min_length=1, max_length=50),
    water_interval_days: int = Form(..., ge=1),
    last_watered_at: date = Form(...),
    species_id: int | None = Form(None),
    custom_species_name: str | None = Form(None),
    location: str | None = Form(None),
    purchase_date: date | None = Form(None),
    photo: UploadFile | None = File(None),
):
    if species_id is None and not custom_species_name:
        raise HTTPException(422, "도감에서 식물을 고르거나 종류를 직접 입력해 주세요.")
    if last_watered_at > date.today():
        raise HTTPException(422, "마지막으로 물 준 날짜는 오늘 이전이어야 합니다.")
    if species_id is not None and species_service.get_species(species_id) is None:
        raise HTTPException(404, "도감에 없는 식물입니다.")

    photo_path = await save_photo(photo)
    new_id = plants_service.create_plant(
        nickname, water_interval_days, last_watered_at,
        species_id, custom_species_name, location, purchase_date, photo_path)
    return {"id": new_id}


# ===== 케어 기록·오늘 할 일·내 식물 상세 (C) =====
@app.get("/today")
def today():
    return care_logs.get_today_list()

# 클라이언트가 보내는 값 : 물 준 날짜 (비우면 오늘)
class WaterRequest(BaseModel):
    logged_at: date | None = None


@app.post("/plants/{plant_id}/water")
def water(plant_id: int, body: WaterRequest | None = None):
    logged_at = None
    if body is not None:
        logged_at = body.logged_at

    # 오늘보다 미래 날짜는 물 줄 수 없음
    if logged_at is not None and logged_at > date.today():
        raise HTTPException(422, "물 준 날짜는 오늘 이전이어야 합니다.")

    result = care_logs.water_plant(plant_id, logged_at)
    if result is None:
        raise HTTPException(404, "없는 식물입니다.")
    if result == "too_early":                                    # ← 추가
        raise HTTPException(409, "아직 물 줄 날이 아닙니다.")      # ← 추가
    return result

# 내 식물 상세 (도감 정보 + 다음 물주기 + 최근 기록 5건)
@app.get("/plants/{plant_id}")
def plant_detail(plant_id: int):
    result = care_logs.get_plant_detail(plant_id)
    if result is None:
        raise HTTPException(404, "없는 식물입니다.")
    return result

# 비료 / 분갈이 / 이상 기록 저장 (물주기는 /water 를 사용)
@app.post("/plants/{plant_id}/logs", status_code=201)
async def add_log(
    plant_id: int,
    log_type: str = Form(...),
    logged_at: date | None = Form(None),
    memo: str | None = Form(None),
    photo: UploadFile | None = File(None),
):
    if log_type not in ["fertilizer", "repot", "issue"]:
        raise HTTPException(422, "기록 종류는 fertilizer, repot, issue 중 하나여야 합니다.")
    if logged_at is not None and logged_at > date.today():
        raise HTTPException(422, "기록 날짜는 오늘 이전이어야 합니다.")
    if care_logs.find_plant(plant_id) is None:
        raise HTTPException(404, "없는 식물입니다.")

    memo = (memo or "").strip()
    if memo == "":
        memo = None
    has_photo = photo is not None and bool(photo.filename)

    # 이상 기록은 메모나 사진 중 하나는 있어야 함
    if log_type == "issue" and memo is None and not has_photo:
        raise HTTPException(422, "이상 기록은 메모나 사진 중 하나는 있어야 합니다.")

    photo_path = await save_photo(photo)    # 형식 오류 415, 용량 초과 413
    new_log = care_logs.add_log(plant_id, log_type, logged_at, memo, photo_path)
    return care_logs.to_log_item(new_log)


# 식물의 케어 기록 목록 (최근 기록이 먼저). ?log_type=issue 처럼 종류로 거를 수 있음
@app.get("/plants/{plant_id}/logs")
def plant_logs(plant_id: int, log_type: str | None = None):
    if log_type is not None and log_type not in ["water", "fertilizer", "repot", "issue"]:
        raise HTTPException(422, "기록 종류는 water, fertilizer, repot, issue 중 하나여야 합니다.")
    if care_logs.find_plant(plant_id) is None:
        raise HTTPException(404, "없는 식물입니다.")
    return care_logs.get_log_list(plant_id, log_type)

# ===== 식물 도우미 (A, 2단계) =====
