# 역할 : 사용자가 올린 사진을 검사하고 uploads 폴더에 저장 / 삭제하는 파일 (B)
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

# 사진 저장 폴더 : backend/uploads  (이 파일이 backend/service/ 안에 있어서 한 단계 위로 올라간다.)
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
MAX_BYTES = 5 * 1024 * 1024  # 5MB


# 파일 맨 앞 바이트를 보고 진짜 사진 형식(jpg, png, webp)을 알아낸다. 허용하지 않는 형식이면 None
# 확장자나 브라우저가 알려주는 파일 종류는 이름만 바꾸면 속일 수 있어서 파일 내용으로 확인한다.
def _detect_ext(head: bytes) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):               # jpg 파일의 시작 값
        return ".jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):          # png 파일의 시작 값
        return ".png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":    # webp 파일의 시작 값
        return ".webp"
    return None


# 사진을 검사하고 저장한 뒤 파일 이름을 돌려준다. (DB·JSON에는 이 이름만 저장한다.)
async def save_photo(file: UploadFile | None) -> str | None:
    # 사진을 선택하지 않았으면 저장할 게 없다.
    if file is None or not file.filename:
        return None
    # 크기 검사 : 5MB보다 1byte 더 읽어 보고, 그보다 길면 5MB 초과이므로 413
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "사진은 5MB 이하만 올릴 수 있습니다.")
    # 형식 검사 : 파일 내용으로 확인해서 허용하지 않는 형식이면 415 (저장 확장자도 진짜 형식에 맞춘다.)
    ext = _detect_ext(data[:12])
    if ext is None:
        raise HTTPException(415, "jpg, png, webp 사진만 올릴 수 있습니다.")
    UPLOAD_DIR.mkdir(exist_ok=True)
    # 파일 이름이 겹치지 않게 랜덤 이름(uuid)으로 저장한다. (원래 이름은 한글·공백 문제가 있어서 쓰지 않음)
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return name


def delete_photo(name: str | None) -> None:
    """저장된 사진 파일을 지운다. 없거나 이미 지워졌으면 그냥 넘어간다."""
    if not name:
        return
    (UPLOAD_DIR / Path(name).name).unlink(missing_ok=True)  # .name : 경로 조작 방지