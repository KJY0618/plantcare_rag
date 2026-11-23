import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
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

async def save_photo(file: UploadFile | None) -> str | None:
    if file is None or not file.filename:
        return None
    ext = ALLOWED.get(file.content_type)
    if ext is None:
        raise HTTPException(415, "jpg, png, webp 사진만 올릴 수 있습니다.")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "사진은 5MB 이하만 올릴 수 있습니다.")
    UPLOAD_DIR.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return name

def delete_photo(name: str | None) -> None:
    """저장된 사진 파일을 지운다. 없거나 이미 지워졌으면 그냥 넘어간다."""
    if not name:
        return
    (UPLOAD_DIR / Path(name).name).unlink(missing_ok=True)  # .name : 경로 조작 방지
