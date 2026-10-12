import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.services.auth_service import seed_default_users
from app.routes.auth import router as auth_router
from app.routes.moderate import router as moderate_router
from app.routes.admin import router as admin_router
from app.routes.friend import router as friend_router
from app.routes.message import router as message_router
from app.routes.search import router as search_router

# 1. Khởi tạo ứng dụng FastAPI với Swagger UI tài liệu tự động
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API cho Nền tảng Phòng chống Bạo lực mạng và Kiểm duyệt Nội dung Thông minh",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# 2. Cấu hình CORS cho phép Frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Tự động khởi tạo bảng CSDL và nạp dữ liệu mẫu khi khởi động
@app.on_event("startup")
def on_startup():
    try:
        # Tạo bảng nếu chưa tồn tại
        Base.metadata.create_all(bind=engine)
        # Nạp dữ liệu mẫu
        db = SessionLocal()
        try:
            seed_default_users(db)
        finally:
            db.close()
        print("[NexusSocial] Khoi dong Backend FastAPI thanh cong! Swagger docs: http://localhost:8000/docs")
    except Exception as e:
        print("[NexusSocial] Canh bao khoi tao database:", e)

# 4. Custom handler cho lỗi validate dữ liệu đầu vào (chuẩn hóa thông báo tiếng Việt)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = "Dữ liệu không hợp lệ"
    if errors:
        # Lấy thông báo lỗi đầu tiên từ Pydantic
        first_err = errors[0]
        msg = first_err.get("msg", msg)
        # Bỏ qua tiền tố "Value error, " nếu có
        if "Value error, " in msg:
            msg = msg.replace("Value error, ", "")

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": msg}
    )

# 5. Đăng ký các Routes
app.include_router(auth_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api") # Hỗ trợ cả alias /api/auth
app.include_router(moderate_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api")
app.include_router(friend_router, prefix="/api/v1")
app.include_router(friend_router, prefix="/api")
app.include_router(message_router, prefix="/api/v1")
app.include_router(message_router, prefix="/api")
app.include_router(search_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api")

@app.get("/", tags=["Hệ thống"])
def root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "swagger_docs": "http://localhost:8000/docs",
        "version": settings.VERSION
    }

@app.get("/api/health", tags=["Hệ thống"])
def health_check():
    return {"status": "OK", "message": "Backend FastAPI đang hoạt động tốt trên cổng 8000!"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
