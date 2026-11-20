import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_BYTES = 5 * 1024 * 1024  # 5MB


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