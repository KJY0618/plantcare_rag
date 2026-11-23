# 임시 JSON 저장 도구 (DB 구축 전까지만 사용)
# backend/storage/ 폴더의 JSON 파일을 읽고 쓰는 공통 함수.
# 어떤 파일을 다룰지는 load("이름") 처럼 이름으로 정함.
#
#   이름          파일                      쓰는 곳
#   "species"     storage/species.json      도감 (A)
#   "plants"      storage/plants.json       내 식물 (B)
#   "care_logs"   storage/care_logs.json    케어 기록 (C)
#
# DB(MariaDB)로 바꾸면 이 파일은 삭제하고, 각 service 파일 안에서 SQL 사용.

import json
import os

# storage 폴더 위치 (uvicorn 을 backend 폴더에서 실행하는 기준)
STORAGE_PATH = "./storage"


# json 파일 읽기 (파일이 없으면 빈 리스트)
# 예) load("care_logs") → ./storage/care_logs.json 의 내용
def load(name):
    path = f"{STORAGE_PATH}/{name}.json"
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


# json 파일 쓰기
# 예) save("care_logs", logs) → ./storage/care_logs.json 에 저장
def save(name, rows):
    if not os.path.exists(STORAGE_PATH):    # storage 폴더가 없으면 만듦
        os.makedirs(STORAGE_PATH)
    path = f"{STORAGE_PATH}/{name}.json"
    with open(path, "w", encoding="utf-8") as file:
        json.dump(rows, file, ensure_ascii=False, indent=4)


# 새 데이터에 붙일 id 만들기 (가장 큰 id + 1, 비어 있으면 1)
def next_id(rows):
    new_id = 1
    for row in rows:
        if row["id"] >= new_id:
            new_id = row["id"] + 1
    return new_id