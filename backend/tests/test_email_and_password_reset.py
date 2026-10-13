import sys
import os
import uuid
import pytest
import random
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import main
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.utils.security import hash_password

client = TestClient(main.app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_register_and_verify_email_flow(db_session):
    random_id = str(uuid.uuid4())[:8]
    test_email = f"test_{random_id}@gmail.com"
    test_phone = f"091{random.randint(1000000, 9999999)}"
    test_name = f"User Test {random_id}"

    # 1. Đăng ký tài khoản
    reg_res = client.post("/api/v1/auth/register", json={
        "full_name": test_name,
        "email": test_email,
        "phone": test_phone,
        "password": "Password123",
        "confirm_password": "Password123"
    })
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["success"] is True
    assert "Đăng kí thành công" in reg_data["message"]
    demo_otp = reg_data["data"]["demo_otp"]
    assert len(demo_otp) == 6

    # 2. Kiểm tra mã OTP sai
    fail_verify = client.post("/api/v1/auth/verify-email", json={
        "email": test_email,
        "otp": "000000"
    })
    assert fail_verify.status_code == 400
    assert "Mã xác thực không chính xác" in fail_verify.json()["detail"]

    # 3. Xác thực OTP thành công
    success_verify = client.post("/api/v1/auth/verify-email", json={
        "email": test_email,
        "otp": demo_otp
    })
    assert success_verify.status_code == 200
    assert success_verify.json()["data"]["is_verified"] is True

    # 4. Kiểm tra user trong database đã được kích hoạt
    user = db_session.query(User).filter(User.email == test_email).first()
    assert user is not None
    assert user.is_verified is True

def test_resend_verification_otp(db_session):
    random_id = str(uuid.uuid4())[:8]
    test_email = f"resend_{random_id}@gmail.com"

    # Tạo user chưa xác thực
    client.post("/api/v1/auth/register", json={
        "full_name": f"Resend User {random_id}",
        "email": test_email,
        "phone": f"093{random.randint(1000000, 9999999)}",
        "password": "Password123",
        "confirm_password": "Password123"
    })

    # Yêu cầu gửi lại mã
    resend_res = client.post("/api/v1/auth/resend-verification-otp", json={
        "email": test_email
    })
    assert resend_res.status_code == 200
    resend_data = resend_res.json()
    new_otp = resend_data["data"]["demo_otp"]
    assert len(new_otp) == 6

    # Xác thực với mã mới
    verify_res = client.post("/api/v1/auth/verify-email", json={
        "email": test_email,
        "otp": new_otp
    })
    assert verify_res.status_code == 200

def test_forgot_password_and_reset_flow(db_session):
    random_id = str(uuid.uuid4())[:8]
    test_email = f"forgot_{random_id}@gmail.com"
    test_phone = f"097{random.randint(1000000, 9999999)}"
    initial_password = "OldPassword123"
    new_password = "NewPassword456"

    # Tạo user
    client.post("/api/v1/auth/register", json={
        "full_name": f"Forgot User {random_id}",
        "email": test_email,
        "phone": test_phone,
        "password": initial_password,
        "confirm_password": initial_password
    })

    # 1. Quên mật khẩu với tài khoản không tồn tại
    non_exist = client.post("/api/v1/auth/forgot-password", json={
        "identifier": "nonexistent@gmail.com"
    })
    assert non_exist.status_code == 404

    # 2. Yêu cầu mã OTP quên mật khẩu hợp lệ (bằng số điện thoại hoặc email)
    forgot_res = client.post("/api/v1/auth/forgot-password", json={
        "identifier": test_phone
    })
    assert forgot_res.status_code == 200
    forgot_data = forgot_res.json()
    assert "masked_email" in forgot_data["data"]
    otp = forgot_data["data"]["demo_otp"]

    # 3. Đặt lại mật khẩu với mật khẩu mới không hợp lệ (thiếu chữ hoa / số)
    weak_pwd_res = client.post("/api/v1/auth/reset-password", json={
        "identifier": test_phone,
        "otp": otp,
        "new_password": "weakpassword",
        "confirm_password": "weakpassword"
    })
    assert weak_pwd_res.status_code == 400

    # 4. Đặt lại mật khẩu thành công
    reset_res = client.post("/api/v1/auth/reset-password", json={
        "identifier": test_phone,
        "otp": otp,
        "new_password": new_password,
        "confirm_password": new_password
    })
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

    # 5. Đăng nhập với mật khẩu cũ (phải thất bại)
    login_old = client.post("/api/v1/auth/login", json={
        "identifier": test_phone,
        "password": initial_password
    })
    assert login_old.status_code == 401

    # 6. Đăng nhập với mật khẩu mới (phải thành công)
    login_new = client.post("/api/v1/auth/login", json={
        "identifier": test_phone,
        "password": new_password
    })
    assert login_new.status_code == 200
    assert login_new.json()["access_token"] is not None
