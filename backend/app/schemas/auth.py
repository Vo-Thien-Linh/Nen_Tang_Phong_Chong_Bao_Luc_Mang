import re
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    phone: str
    password: str
    confirm_password: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        name = v.strip()
        if not name:
            raise ValueError("Vui lòng nhập tên hiển thị")
        if len(name) < 3 or len(name) > 30:
            raise ValueError("Tên hiển thị phải từ 3 - 30 kí tự")
        return name

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not email:
            raise ValueError("Vui lòng nhập email")
        # Kiểm tra định dạng email chuẩn
        pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        if not re.match(pattern, email):
            raise ValueError("Email bắt buộc đúng định dạng (ví dụ: ten@gmail.com)")
        return email

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        phone = v.strip().replace(" ", "").replace(".", "").replace("-", "")
        if not phone:
            raise ValueError("Vui lòng nhập số điện thoại")
        # Định dạng số điện thoại Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)
        pattern = r"^(0|\+84)(3|5|7|8|9)[0-9]{8}$"
        if not re.match(pattern, phone):
            raise ValueError("Số điện thoại không đúng định dạng hợp lệ (10 chữ số)")
        # Chuẩn hóa về định dạng 10 chữ số bắt đầu bằng 0 (ví dụ: +84912345678 -> 0912345678)
        if phone.startswith("+84"):
            phone = "0" + phone[3:]
        elif phone.startswith("84") and len(phone) == 11:
            phone = "0" + phone[2:]
        return phone


    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Vui lòng nhập mật khẩu")
        if len(v) < 8:
            raise ValueError("Mật khẩu bắt buộc 8 kí tự đổ lên có kí tự hoa, thường và số")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu bắt buộc có kí tự hoa")
        if not re.search(r"[a-z]", v):
            raise ValueError("Mật khẩu bắt buộc có kí tự thường")
        if not re.search(r"\d", v):
            raise ValueError("Mật khẩu bắt buộc có kí tự số")
        return v

    @model_validator(mode="after")
    def validate_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không khớp")
        return self


class LoginRequest(BaseModel):
    identifier: str # Email hoặc Số điện thoại
    password: str

    @model_validator(mode="after")
    def check_not_empty(self):
        if not self.identifier or not self.identifier.strip() or not self.password or not self.password.strip():
            raise ValueError("Vui lòng nhập đầy đủ thông tin")
        return self


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    phone: Optional[str] = None
    full_name: str
    role: str
    status: str
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = None
    is_verified: bool = False

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    message: str


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class VerifyEmailRequest(BaseModel):
    email: str
    otp: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not email:
            raise ValueError("Vui lòng nhập email")
        return email

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        otp = v.strip()
        if not otp:
            raise ValueError("Vui lòng nhập mã xác thực OTP")
        if len(otp) != 6 or not otp.isdigit():
            raise ValueError("Mã xác thực OTP phải gồm 6 chữ số")
        return otp


class ResendOtpRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not email:
            raise ValueError("Vui lòng nhập email")
        return email


class ForgotPasswordRequest(BaseModel):
    identifier: str # Email hoặc Số điện thoại

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        val = v.strip()
        if not val:
            raise ValueError("Vui lòng nhập email hoặc số điện thoại")
        return val


class ResetPasswordRequest(BaseModel):
    identifier: str
    otp: str
    new_password: str
    confirm_password: str

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        val = v.strip()
        if not val:
            raise ValueError("Vui lòng nhập email hoặc số điện thoại")
        return val

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        otp = v.strip()
        if not otp:
            raise ValueError("Vui lòng nhập mã xác thực OTP")
        if len(otp) != 6 or not otp.isdigit():
            raise ValueError("Mã xác thực OTP phải gồm 6 chữ số")
        return otp

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Vui lòng nhập mật khẩu mới")
        if len(v) < 8:
            raise ValueError("Mật khẩu bắt buộc 8 kí tự đổ lên có kí tự hoa, thường và số")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu bắt buộc có kí tự hoa")
        if not re.search(r"[a-z]", v):
            raise ValueError("Mật khẩu bắt buộc có kí tự thường")
        if not re.search(r"\d", v):
            raise ValueError("Mật khẩu bắt buộc có kí tự số")
        return v

    @model_validator(mode="after")
    def validate_passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không khớp")
        return self


class VerifyResetOtpRequest(BaseModel):
    identifier: str
    otp: str

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        val = v.strip()
        if not val:
            raise ValueError("Vui lòng nhập email hoặc số điện thoại")
        return val

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        otp = v.strip()
        if not otp:
            raise ValueError("Vui lòng nhập mã xác thực OTP")
        if len(otp) != 6 or not otp.isdigit():
            raise ValueError("Mã xác thực OTP phải gồm 6 chữ số")
        return otp

