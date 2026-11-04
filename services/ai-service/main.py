"""Standalone inference API for PhoBERT text and EfficientNet image moderation."""
import os
import sys
from pathlib import Path

backend_dir = Path(os.getenv("BACKEND_APP_DIR", Path(__file__).resolve().parents[2] / "backend"))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
import uvicorn
from app.routes.moderate import router as moderation_router

app = FastAPI(title="NexusSocial AI Inference Service", version="1.0.0")
app.include_router(moderation_router, prefix="/api/v1")
app.include_router(moderation_router, prefix="/api")


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"service": "ai-inference-service", "status": "UP"}


if __name__ == "__main__":
    port = int(os.getenv("AI_SERVICE_PORT", "8001"))
    print(f"[AI Inference Service] listening on 0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)

