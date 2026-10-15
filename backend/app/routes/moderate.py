from fastapi import APIRouter
from pydantic import BaseModel
import time
from app.services.ai_services import predict_vi_content

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
