from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
import time
from app.services.ai_services import predict_vi_content
from app.image_moderation.inference import ImageModerationFailure, infer_image, infer_image_bytes
from app.image_moderation.policy import decide_image_moderation

router = APIRouter(prefix="", tags=["Kiểm duyệt nội dung AI (Moderation)"])

class ModerateRequest(BaseModel):
    text: str

class ModerateResponse(BaseModel):
    label: str           # "Normal", "Toxic", "Violence", "Hate Speech"
    confidence: float
    action: str          # "allow", "warn", "hide"
    latency_ms: float
    reason: str
    cooldown_seconds: int = 0

@router.post("/moderate", response_model=ModerateResponse, summary="Phân tích kiểm duyệt nội dung độc hại bằng AI PhoBERT")
def moderate_text(req: ModerateRequest):
    start = time.time()
    
    # Sử dụng mô hình PhoBERT thực tế đã huấn luyện
    result = predict_vi_content(req.text)
    latency = round((time.time() - start) * 1000, 1)

    # Tính thời gian tạm khóa theo mức độ vi phạm
    cooldown = 0
    if result["label"] == "Violence":
        cooldown = 30
    elif result["label"] == "Hate Speech":
        cooldown = 20
    elif result["label"] == "Toxic":
        cooldown = 10
    
    return ModerateResponse(
        label=result["label"],
        confidence=result["confidence"],
        action=result["action"],
        latency_ms=latency,
        reason=result["reason"],
        cooldown_seconds=cooldown
    )


class ImageModerateRequest(BaseModel):
    image_url: str


@router.post("/moderate/image", summary="Phân tích kiểm duyệt ảnh bằng EfficientNet-B1")
def moderate_image(req: ImageModerateRequest):
    try:
        result = infer_image(req.image_url)
        return decide_image_moderation(result["scores"])
    except ImageModerationFailure:
        return decide_image_moderation(None, failed=True)


@router.post("/moderate/image/preview", summary="Preview kiểm duyệt ảnh không ghi dữ liệu")
async def moderate_image_preview(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Tệp phải là ảnh")
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Ảnh vượt quá 10 MB")
    try:
        result = decide_image_moderation(infer_image_bytes(data)["scores"])
    except ImageModerationFailure:
        result = decide_image_moderation(None, failed=True)
    category = {"safe": "SAFE", "sensitive": "SENSITIVE", "rejected": "VIOLATION", "pending_review": "PENDING_REVIEW"}[result["decision"]]
    return {"category": category}
