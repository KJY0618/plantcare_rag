"""Chroma 문서 생성·갱신·검색, Gemini 답변 (A, 2단계)"""
import json, os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.documents import Document
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from service.species import load_species
from service.plants import list_plants
from service import care_logs 
from datetime import date                       # 오늘 날짜 (이번 주 물주기 같은 질문에 필요)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # backend 폴더
load_dotenv(os.path.join(BASE_DIR, ".env")) # .env 의 키를 읽어 옴

CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")    # 벡터 DB를 저장할 폴더
EMBED_MODEL = "jhgan/ko-sroberta-multitask"             # 글을 숫자(벡터)로 바꾸는 한국어 모델
LLM_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")   # 답변을 만들 Gemini 모델 이름
COLLECTION = "plantcare_species"                        # Chroma 안의 도감 보관함 이름

_cache = {}   # 한 번 불러온 것을 담아 둠 (매번 새로 불러오면 너무 느림)

# 임베딩 모델 (처음 부를 때 한번만 불러옴)
def get_embeddings():
    if "embeddings" not in _cache:
        _cache["embeddings"] = HuggingFaceEmbeddings(
            model_name=EMBED_MODEL,
            model_kwargs={"device": "cpu"},                  # GPU 있으면 "cuda"
            encode_kwargs={"normalize_embeddings": True},    # 벡터 비교에서 중요한 건 "방향"
)

# Chroma 벡터 DB (처음 부를 때 한번만 열어 둠)
def get_vectorStore():
    if "vectorStore" not in _cache:
        _cache["vectorStore"] = Chroma(
            collection_name=COLLECTION,
            embedding_function=get_embeddings(),
            persist_directory=CHROMA_DIR,
        )
    return _cache["vectorStore"]

# Gemini (처음 부를 때 한번만 만듦)
def get_llm():
    if "llm" not in _cache:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY가 .env에 없습니다.")
        _cache["llm"] = ChatGoogleGenerativeAI(
            model=LLM_MODEL,
            google_api_key=api_key,
            temperature=0,
        )
    return _cache["llm"]

# "이름: 값" 줄을 모아 한글로 만듦(비어 있는 값은 건너뜀)
def make_text(title, pairs):
    lines = []
    for label, value in pairs:
        if value:                                       # None 이나 ""이면 건너뜀
            lines.append(label + ":" + str(value).strip())
    if len(lines) == 0:
        return None                                     # 내용이 하나도 없으면 문서를 만들지 않음
    return title + "\n" + "\n".join(lines)

# 도감 217종을 주제별 문서로 만듦 (종마다 최대 4개)
def build_species_documents():
    docs = []
    for row in load_species():
        name = row["name"]
        tags = row.get("tags") or {}
        light = ",".join(tags.get("light") or [])        # 쉼표로 쪼개진 광도 글자를 다시 붙임
        placement = ", ".join(tags.get("placement") or [])

        # (주제, 제목, [(이름, 값), ...]) 묶음 4개
        topics = [
            ("water", name + " 물주기", [
                ("봄", row.get("water_spring")),
                ("여름", row.get("water_summer")),
                ("가을", row.get("water_autumn")),
                ("겨울", row.get("water_winter")),
            ]),
            ("env", name + " 빛·온도·습도", [
                ("알맞은 빛", light),
                ("놓는 장소", placement),
                ("생육 온도", row.get("growth_temp")),
                ("겨울 최저 온도", row.get("winter_min_temp")),
                ("습도", row.get("humidity")),
            ]),
            ("care", name + " 관리 방법", [
                ("관리 난이도", row.get("manage_level")),
                ("관리 요구도", row.get("manage_demand")),
                ("비료", row.get("fertilizer_info")),
                ("토양", row.get("soil_info")),
                ("번식 시기", row.get("propagation_period")),
            ]),
            ("intro", name + " 소개", [
                ("학명", row.get("scientific_name")),
                ("원산지", row.get("origin")),
                ("잎 모양", row.get("leaf_form")),
                ("특징", row.get("function_info")),
            ]),
        ]
        for topic, title, pairs in topics:
            text = make_text(title, pairs)
            if text is None:
                continue
            docs.append(Document(
                page_content=text,
                metadata={"type": "species", "species_id": row["id"], "name": name, "topic": topic},
                ))
    return docs
# 도감 문서를 Chroma 에 다시 넣음 (기존 내용은 지우고 새로 넣음). 넣은 문서 개수를 돌려줌
def rebuild_species_db():
    docs = build_species_documents()
    vectorStore = get_vectorStore()

    vectorStore.reset_collection()                  # 1. 보관함을 비움 (여러 번 해도 문서가 중복되지 않음)
    ids = []                                        # 2. 문서마다 고유 번호 만들기 (예: species-1-water)
    for doc in docs:
        ids.append("species-" + str(doc.metadata["species_id"]) + "-" + doc.metadata["topic"])
    vectorStore.add_documents(docs, ids=ids)       # 3. 글을 벡터로 바꿔 저장 (이때 임베딩 모델이 일함)
    return len(docs)

# Chroma 가 비어 있으면 도감을 넣음 (처음 질문이 올 때 자동으로 부름)
def ensure_species_db():
    vectorStore = get_vectorStore()
    saved = vectorStore.get(include=[])             # 저장된 문서의 번호 목록만 가져옴
    if len(saved["ids"]) == 0:
        print("도감 DB가 없어요. 만들게요")
        rebuild_species_db()

# 질문에 이 낱말이 있으면 그 주제로 봄
TOPIC_WORDS = {
    "water": ["물", "관수", "급수", "마르"],
    "env": ["빛", "햇빛", "햇볕", "광", "그늘", "온도", "추위", "더위", "습도", "베란다", "창가", "장소"],
    "care": ["비료", "영양", "분갈이", "흙", "토양", "번식", "관리", "난이도"],
    "intro": ["소개", "특징", "원산지", "학명"],
}

# 질문에서 주제 찾기 (못 찾으면 빈 목록)
def find_topics(text):
    text = text.replace("식물", "")             # "식물" 안의 "물"을 물주기로 착각하지 않게 뺌
    topics = []
    for topic, words in TOPIC_WORDS.items():
        for word in words:
            if word in text:
                topics.append(topic)
                break                            # 이 주제는 찾았으니 다음 주제로
    return topics

# 질문에 별명이 나온 내 식물 찾기
def find_my_plants(question):
    found = []
    for plant in list_plants():
        if plant["nickname"] and plant["nickname"] in question:
            found.append(plant)
    return found

# 질문에 이름이 나온 도감 식물 찾기
def find_species_names(question):
    names = []
    for row in load_species():
        if row["name"] in question:
            names.append(row["name"])

    # 더 긴 이름 안에 들어 있는 이름은 뺌 (예: "무늬관음죽"이 있으면 "관음죽"은 뺌)
    result = []
    for name in names:
        inside_longer = False
        for other in names:
            if other != name and name in other:
                inside_longer = True
        if not inside_longer and name not in result:
            result.append(name)
    return result

def analyze_question(question):
    my_plants = find_my_plants(question)
    species_names = find_species_names(question)

    # 내 식물의 종류 이름도 도감에서 찾을 대상에 넣음
    for plant in my_plants:
        name = plant["species_name"]
        if name and name not in species_names:
            species_names.append(name)

    # 주제는 식물 이름을 뺀 글에서 찾음 (이름 속 글자를 주제 낱말로 착각하지 않게)
    text = question
    for plant in my_plants:
        text = text.replace(plant["nickname"], "")
    for name in species_names:
        text = text.replace(name, "")
    topics = find_topics(text)

    return {"my_plants": my_plants, "species_names": species_names, "topics": topics}

MAX_PLANTS = 5     # 식물 이름이 없을 때 살펴볼 내 식물 수
MAX_LOGS = 5       # 식물마다 가져올 최근 기록 수
LOG_LABEL = {"water": "물주기", "fertilizer": "비료", "repot": "분갈이", "issue": "이상 증상"}

# 도감 문서 검색 : 식물 이름마다 따로 찾음 (이름이 같고, 주제가 맞는 문서만)
def search_species_docs(question, spcies_names, topics):
    vectorstore = get_vectorStore()
    k = len(topics) if topics else 2               # 주제가 여러 개면 그만큼 가져옴

    results = []
    for name in spcies_names:
        conditions = [{"name":name}]                # 꼬리표 name 이 이 식물인 문서
        if topics:
            conditions.append({"topic": {"$in": topics}})   # 꼬리표 topic 이 찾은 주제 중 하나인 문서

        if len(conditions) == 1:
            search_filter = conditions[0]
        else:
            search_filter = {"$and": conditions}   # 조건이 둘 이상이면 $and 로 묶어야 함

        docs = vectorstore.similarity_search(question, k=k, filter=search_filter)
        for doc in docs:
            results.append(doc)
    return results

# 내 식물의 기록 가져오기 (물주기 일정 + 최근 기록)
def get_my_records(my_plants):
    records = []
    for plant in my_plants:
        lines = []

        raw = care_logs.find_plant(plant["id"])
        last = care_logs.get_last_watered(plant["id"])
        if raw and last:
            next_date, d_day = care_logs.calc_dday(last, raw["water_interval_days"])
            if d_day == 0:
                when = "오늘"
            elif d_day < 0:
                when = str(-d_day) + "일 지남"
            else:
                when = str(d_day) + "일 남음"
            lines.append("물주기 주기: " + str(raw["water_interval_days"]) + "일마다")
            lines.append("마지막으로 물 준 날: " + last.isoformat())
            lines.append("다음 물주기: " + next_date.isoformat() + " (" + when + ")")

        logs = care_logs.get_logs(plant["id"])[:MAX_LOGS]      # 최근 기록이 먼저
        for log in logs:
            line = log["logged_at"] + " " + LOG_LABEL.get(log["log_type"], log["log_type"])
            if log["memo"]:
                line = line + ": " + log["memo"]
            lines.append(line)

        if len(lines) > 0:
            records.append({"title": plant["nickname"] + " 기록", "text": "\n".join(lines)})
    return records

# 질문에 맞는 근거를 모아 sources 모양으로 돌려줌
def retrieve_evidence(question):
    info = analyze_question(question)
    my_plants = info["my_plants"]
    species_names = info["species_names"]
    topics = info["topics"]

    # 도감 이름만 말했으면, 그 종류인 내 식물의 기록도 같이 봄
    if len(my_plants) == 0 and len(species_names) > 0:
        for plant in list_plants():
            if plant["species_name"] in species_names:
                my_plants.append(plant)
        my_plants = my_plants[:MAX_PLANTS]

    # 식물 이름이 하나도 없으면 "내 식물들"에 대한 질문으로 봄
    if len(my_plants) == 0 and len(species_names) == 0:
        my_plants = list_plants()[:MAX_PLANTS]
        for plant in my_plants:
            name = plant["species_name"]
            if name and name not in species_names:
                species_names.append(name)

    sources = []
    for record in get_my_records(my_plants):
        sources.append({"type": "my_record", "title": record["title"], "text": record["text"]})

    for doc in search_species_docs(question, species_names, topics):
        lines = doc.page_content.split("\n")
        sources.append({
            "type": "species",
            "title": lines[0],                     # 첫 줄 = 제목 (예: 가울테리아 물주기)
            "text": "\n".join(lines[1:]),          # 나머지 = 내용
        })
    return sources

NO_INFO = "확인된 정보가 없습니다."

# 찾은 근거를 Gemini 에게 보여 줄 글로 바꿈
def format_context (sources):
    if len(sources) == 0:
        return "참고 정보 없음"

    parts = []
    for source in sources:
        if source["type"] == "my_record":
            label = "내 기록"
        else:
            label = "도감"
        parts.append("[" + label + " · " + source["title"] + "]\n" + source["text"])
    return "\n\n".join(parts)

# 질문 하나에 답함 -> {"anwer:" 글, "sources": [근거들]}
def answer_question(question):
    sources = retrieve_evidence(question)
    if len(sources) == 0:                     # 근거가 하나도 없으면 AI 를 부르지 않음
        return {"answer": NO_INFO + " 식물 이름을 함께 알려 주세요.", "sources": []}

    prompt = ChatPromptTemplate.from_template("""
        너는 집에서 식물을 키우는 사람을 돕는 식물 도우미야.
        아래 [참고 정보]만 근거로 [질문]에 답해줘.

        [오늘 날짜] {today}
        [질문] {question}
        [참고 자료]
        {context}

        [규칙]
        - [참고 자료]에 없는 내용은 지어내지 말 것
        - [참고 자료]가 질문과 관련이 없으면 "확인된 정보가 없습니다."라고만 답할 것
        - "내 기록"과 "도감"을 구분해서 말하기 (예: "내 기록을 보면", "도감에 따르면")
        - 답변에서 "근거"라는 말은 쓰지 말고 필요하면 "참고한 자료"라고 말하기
        - 증상은 원인을 단정하지 말고 "~일 수 있어요"처럼 가능성으로 말하기
        - 진단이나 치료를 하는 것처럼 말하지 말 것
        - 친절한 존댓말로 3~5문장 이내로 답하기
    """)

    chain = prompt | get_llm() | StrOutputParser()
    answer = chain.invoke({
        "today": date.today().isoformat(),
        "question": question,
        "context": format_context(sources),
    })

    if NO_INFO in answer:                           # AI 가 "정보 없음"이라고 했으면 근거도 보여 주지 않음
        sources = []
    return {"answer": answer.strip(), "sources": sources}


        











