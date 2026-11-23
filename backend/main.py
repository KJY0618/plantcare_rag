
# 역할 : 클라이언트(Next.js)의 요청을 받아서
# service 폴더의 함수에게 일을 시키고 응답해 주는 파일
# 이 파일에는 경로(주소)와 입력 검사만 두고,
# 실제 처리는 service/ 의 파일이 한다.


# ===== import =====
from datetime import date

from fastapi import FastAPI
from fastapi import File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from service import plants as plants_service
from service import species as species_service
from service import care_logs
from service.photos import UPLOAD_DIR, delete_photo, save_photo


# ===== FastAPI 생성 =====
app = FastAPI(title="PlantCare API")


# ===== 사진 폴더 설정 =====
# 사진 폴더를 /uploads 주소로 공개한다.
# 예) uploads/abc.jpg 파일은
# http://127.0.0.1:8000/uploads/abc.jpg 로 열린다.

UPLOAD_DIR.mkdir(exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads"
)


# ===== CORS 설정 =====
# 주소(포트)가 다른 Next.js(3000번)에서
# 이 서버(8000번)를 호출할 수 있게 허용한다.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# ===== 도감 (A) =====
# ==========================================

# 도감 식물 한 건 조회
@app.get("/species/{species_id}")
def get_species_detail(species_id: int):

    s = species_service.get_species(species_id)

    if s is None:
        raise HTTPException(
            404,
            "도감에 없는 식물입니다."
        )

    return s


# ==========================================
# ===== 내 식물 (B) =====
# ==========================================

# ===== 1. 내 식물 목록 조회 =====
# 카드에 보여줄 값
# 번호, 별명, 종류 이름, 위치, 사진 주소

# 검색·필터는 모두 선택
# 예) /plants?keyword=몬&location=거실&log_type=issue

# keyword : 별명·종류 이름
# location : 위치
# log_type : 케어 기록 종류
# water, fertilizer, repot, issue 이외에는 422 응답

@app.get("/plants")
def list_plants(
    keyword: str | None = None,
    location: str | None = None,
    log_type: str | None = Query(
        None,
        pattern="^(water|fertilizer|repot|issue)$"
    ),
):

    return plants_service.list_plants(
        keyword,
        location,
        log_type
    )


# ===== 2. 내 식물 추가 =====
# 사진이 같이 오기 때문에
# JSON이 아니라 FormData로 받는다.

# Form(...) : 필수 항목
# Form(None) : 선택 항목

# min_length : 최소 글자 수
# max_length : 최대 글자 수
# ge : 해당 숫자 이상

# 조건에 맞지 않으면 FastAPI가 자동으로 422 응답

@app.post("/plants", status_code=201)
async def create_plant(
    nickname: str = Form(
        ...,
        min_length=1,
        max_length=50
    ),
    water_interval_days: int = Form(..., ge=1),
    last_watered_at: date = Form(...),
    species_id: int | None = Form(None),
    custom_species_name: str | None = Form(None),
    location: str | None = Form(None),
    purchase_date: date | None = Form(None),
    photo: UploadFile | None = File(None),
):

    # 1. 입력 검사

    # 식물 종류는 도감에서 선택하거나
    # 직접 입력해야 한다.
    if species_id is None and not custom_species_name:
        raise HTTPException(
            422,
            "도감에서 식물을 고르거나 종류를 직접 입력해 주세요."
        )

    # 마지막으로 물 준 날짜는 미래일 수 없다.
    if last_watered_at > date.today():
        raise HTTPException(
            422,
            "마지막으로 물 준 날짜는 오늘 이전이어야 합니다."
        )

    # 도감 번호가 존재하는지 검사
    if (
        species_id is not None
        and species_service.get_species(species_id) is None
    ):
        raise HTTPException(
            404,
            "도감에 없는 식물입니다."
        )

    # 2. 사진 저장
    # 사진이 없으면 None
    photo_path = await save_photo(photo)

    # 3. 식물 저장
    # plants.json에 식물 정보 저장
    # care_logs.json에 첫 물주기 기록 저장
    new_id = plants_service.create_plant(
        nickname,
        water_interval_days,
        last_watered_at,
        species_id,
        custom_species_name,
        location,
        purchase_date,
        photo_path
    )

    return {"id": new_id}


# ===== 3. 내 식물 수정 =====
# 보낸 항목만 수정한다.
# 보내지 않은 항목은 기존 값을 유지한다.

# 위치·구매일을 지우려면
# 공백 한 칸(" ")을 보낸다.
# (현재 서비스 구현 규칙에 맞춘 방식)

@app.put("/plants/{plant_id}")
async def update_plant(
    plant_id: int,
    nickname: str | None = Form(
        None,
        min_length=1,
        max_length=50
    ),
    water_interval_days: int | None = Form(None, ge=1),
    location: str | None = Form(None),
    purchase_date: str | None = Form(None),
    remove_photo: bool = Form(False),
    photo: UploadFile | None = File(None),
):

    # 없는 식물이면 사진 저장 전에 404
    if plants_service.get_plant(plant_id) is None:
        raise HTTPException(
            404,
            "없는 식물입니다."
        )

    # 새로운 사진 저장
    new_photo = await save_photo(photo)

    try:
        # 식물 정보 수정
        return plants_service.update_plant(
            plant_id,
            nickname,
            water_interval_days,
            location,
            purchase_date,
            new_photo,
            remove_photo
        )

    except Exception:
        # 수정 중 오류가 발생하면
        # 새로 업로드한 사진을 삭제한다.
        delete_photo(new_photo)
        raise


# ===== 4. 내 식물 삭제 =====
# 식물, 케어 기록, 사진 파일 함께 삭제
# 없는 번호면 404

@app.delete("/plants/{plant_id}")
def delete_plant(plant_id: int):

    if not plants_service.delete_plant(plant_id):
        raise HTTPException(
            404,
            "없는 식물입니다."
        )

    return {"message": "삭제했습니다."}


# ==========================================
# ===== 케어 기록·오늘 할 일 (C) =====
# ==========================================

# ===== 5. 오늘 할 일 조회 =====
# 오늘 물을 줘야 하는 식물 등의
# 케어 목록을 가져온다.

@app.get("/today")
def today():

    return care_logs.get_today_list()


# ===== 6. 물주기 요청 데이터 =====
# 클라이언트가 보내는 값 : 물 준 날짜
# 날짜를 입력하지 않으면 서비스에서 오늘 날짜로 처리

class WaterRequest(BaseModel):
    logged_at: date | None = None


# ===== 7. 물주기 기록 추가 =====
# 특정 식물에 물을 준 기록을 저장한다.
# 예) POST /plants/1/water

@app.post("/plants/{plant_id}/water")
def water(
    plant_id: int,
    body: WaterRequest | None = None
):

    # 물 준 날짜
    logged_at = None

    if body is not None:
        logged_at = body.logged_at

    # 오늘보다 미래 날짜는 물 줄 수 없음
    if logged_at is not None and logged_at > date.today():
        raise HTTPException(
            422,
            "물 준 날짜는 오늘 이전이어야 합니다."
        )

    # service의 물주기 함수 호출
    result = care_logs.water_plant(
        plant_id,
        logged_at
    )

    # 없는 식물인 경우
    if result is None:
        raise HTTPException(
            404,
            "없는 식물입니다."
        )

    # 아직 물 줄 날짜가 아닌 경우
    if result == "too_early":
        raise HTTPException(
            409,
            "아직 물 줄 날이 아닙니다."
        )

    return result

<<<<<<< HEAD

# ==========================================
=======
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

>>>>>>> origin/main
# ===== 식물 도우미 (A, 2단계) =====
# ==========================================
