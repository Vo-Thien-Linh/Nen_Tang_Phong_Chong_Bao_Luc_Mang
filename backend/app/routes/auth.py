from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from ..database import get_db
from ..schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse, ApiResponse,
    VerifyEmailRequest, ResendOtpRequest, ForgotPasswordRequest, ResetPasswordRequest
)
from ..services.auth_service import AuthService
from ..utils.security import decode_access_token

router = APIRouter(prefix="/auth", tags=["Xác thực người dùng (Auth)"])

@router.post(
    "/register", 
    response_model=ApiResponse,
    summary="Đăng ký tài khoản mới",
    description="Tạo tài khoản với tên hiển thị, email, số điện thoại, mật khẩu (mã hóa Bcrypt)"
)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    user = AuthService.register(request, db)
    return ApiResponse(
        success=True,
        message="Đăng kí thành công",
        data=user if isinstance(user, dict) else user.model_dump()
    )

@router.post(
    "/verify-email",
    response_model=ApiResponse,
    summary="Xác thực email bằng mã OTP",
    description="Xác minh mã OTP 6 số đã gửi qua email để kích hoạt tài khoản"
)
def verify_email(request: VerifyEmailRequest, db: Session = Depends(get_db)):
    res = AuthService.verify_email(request.email, request.otp, db)
    return ApiResponse(
        success=True,
        message=res.get("message", "Xác thực email thành công!"),
        data=res
    )

@router.post(
    "/resend-verification-otp",
    response_model=ApiResponse,
    summary="Gửi lại mã xác thực OTP qua email",
    description="Tạo và gửi lại mã OTP mới cho tài khoản đăng ký"
)
def resend_verification_otp(request: ResendOtpRequest, db: Session = Depends(get_db)):
    res = AuthService.resend_verification_otp(request.email, db)
    return ApiResponse(
        success=True,
        message=res.get("message", "Đã gửi lại mã OTP"),
        data=res
    )

@router.post(
    "/forgot-password",
    response_model=ApiResponse,
    summary="Yêu cầu đặt lại mật khẩu (Quên mật khẩu)",
    description="Nhập Email hoặc Số điện thoại để nhận mã xác thực OTP qua email"
)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    res = AuthService.forgot_password(request.identifier, db)
    return ApiResponse(
        success=True,
        message=res.get("message", "Mã xác thực đã được gửi tới email"),
        data=res
    )

@router.post(
    "/reset-password",
    response_model=ApiResponse,
    summary="Xác nhận mã OTP và đặt mật khẩu mới",
    description="Xác thực mã OTP và cập nhật mật khẩu mới cho tài khoản"
)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    res = AuthService.reset_password(
        identifier=request.identifier,
        otp=request.otp,
        new_password=request.new_password,
        db=db
    )
    return ApiResponse(
        success=True,
        message=res.get("message", "Đặt lại mật khẩu thành công!"),
        data=res
    )

@router.post(
    "/login", 
    response_model=TokenResponse,
    summary="Đăng nhập hệ thống bằng Email hoặc Số điện thoại",
    description="Xác thực người dùng bằng Email/SĐT và mật khẩu, cấp JWT token"
)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    return AuthService.login(request, db)

@router.post(
    "/logout",
    response_model=ApiResponse,
    summary="Đăng xuất khỏi hệ thống",
    description="Hủy phiên làm việc và xóa token ở client"
)
def logout():
    return ApiResponse(
        success=True,
        message="Đăng xuất thành công"
    )

@router.get(
    "/me", 
    response_model=UserResponse,
    summary="Lấy thông tin tài khoản hiện tại",
    description="Xác thực token JWT từ Header Authorization và trả về thông tin profile"
)
def get_current_user(
    authorization: Optional[str] = Header(None), 
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa cung cấp mã xác thực hợp lệ"
        )
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập đã hết hạn hoặc không hợp lệ"
        )
        
    user = AuthService.get_user_by_id(payload["sub"], db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản người dùng"
        )
        
    return UserResponse.model_validate(user)

@router.get(
    "/demo-accounts",
    summary="Danh sách tài khoản mẫu phục vụ kiểm thử (Software Testing)",
    description="Cung cấp sẵn thông tin đăng nhập mẫu bao gồm tài khoản hợp lệ và tài khoản bị khóa"
)
def get_demo_accounts():
    return {
        "success": True,
        "accounts": [
            {
                "role": "Người dùng mẫu (Chính)",
                "name": "Võ Thiện Linh",
                "email": "linh.vothien@example.com",
                "phone": "0912345678",
                "password": "Password123",
                "status": "active",
                "description": "Đăng nhập được bằng cả Email và Số điện thoại"
            },
            {
                "role": "Quản trị viên (Admin)",
                "name": "Quản Trị Viên Hệ Thống",
                "email": "admin@nexussocial.vn",
                "phone": "0909999999",
                "password": "Password123",
                "status": "active",
                "description": "Có quyền truy cập Admin Dashboard"
            },
            {
                "role": "Tài khoản bị khóa (Test Case Banned)",
                "name": "Trần Minh Tuấn",
                "email": "tuan.tran.hack@darkmail.com",
                "phone": "0988888888",
                "password": "Password123",
                "status": "banned",
                "description": "Dùng để kiểm thử Acceptance Criteria: 'Tài khoản của bạn đã bị khóa'"
            }
        ]
    }
