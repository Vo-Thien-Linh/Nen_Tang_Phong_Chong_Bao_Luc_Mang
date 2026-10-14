import uuid
import random
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from ..models.user import User
from ..models.verification_code import VerificationCode
from ..schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse
from ..utils.security import hash_password, verify_password, create_access_token
from ..utils.email_service import send_otp_email

def seed_default_users(db: Session):
    """Tự động nạp các tài khoản mẫu cho việc kiểm thử nếu chưa có dữ liệu"""
    try:
        if db.query(User).count() == 0:
            demo_users = [
                User(
                    id="a0000000-0000-0000-0000-000000000001",
                    username="linh.vothien.16",
                    email="linh.vothien@example.com",
                    phone="0912345678",
                    password_hash=hash_password("Password123"),
                    full_name="Võ Thiện Linh",
                    role="ADMIN",
                    status="active",
                    avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
                    is_verified=True,
                    bio="Cuộc sống là những chuyến đi và trải nghiệm 🌊"
                ),
                User(
                    id="a0000000-0000-0000-0000-000000000099",
                    username="admin_moderator",
                    email="admin@nexussocial.vn",
                    phone="0909999999",
                    password_hash=hash_password("Password123"),
                    full_name="Quản Trị Viên Hệ Thống",
                    role="ADMIN",
                    status="active",
                    avatar_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
                    is_verified=True
                ),
                User(
                    id="a0000000-0000-0000-0000-000000000002",
                    username="thutrang_le",
                    email="thutrang@example.com",
                    phone="0987654321",
                    password_hash=hash_password("Password123"),
                    full_name="Lê Thu Trang",
                    role="USER",
                    status="active",
                    avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
                    is_verified=True
                ),
                User(
                    id="a0000000-0000-0000-0000-000000000004",
                    username="tuan_tran_ai",
                    email="tuan.tran.hack@darkmail.com",
                    phone="0988888888",
                    password_hash=hash_password("Password123"),
                    full_name="Trần Minh Tuấn (Bị khóa)",
                    role="USER",
                    status="banned", # Tài khoản bị khóa phục vụ kiểm thử
                    avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
                    is_verified=False
                )
            ]
            db.add_all(demo_users)
            db.commit()
    except Exception as e:
        db.rollback()
        print("Lưu ý khi nạp seed users:", e)

class AuthService:
    @staticmethod
    def register(req: RegisterRequest, db: Session) -> UserResponse:
        """
        Đăng ký tài khoản mới:
        - Tên hiển thị từ 3 - 30 kí tự, nếu tên đã tồn tại: 'Tên đã được tồn tại'
        - email bắt buộc đúng định dạng, nếu đã tồn tại: 'Email đã được sử dụng'
        - số điện thoại nếu đã tồn tại: 'Số điện thoại đã được sử dụng'
        - Mật khẩu bắt buộc mã hóa, không lưu plain text
        """
        # 1. Kiểm tra Tên hiển thị đã tồn tại hay chưa
        existing_name = db.query(User).filter(
            or_(User.full_name == req.full_name, User.username == req.full_name)
        ).first()
        if existing_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tên đã được tồn tại"
            )

        # 2. Kiểm tra Email đã tồn tại hay chưa
        existing_email = db.query(User).filter(User.email == req.email.lower()).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email đã được sử dụng"
            )

        # 3. Kiểm tra Số điện thoại đã tồn tại hay chưa
        existing_phone = db.query(User).filter(User.phone == req.phone).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số điện thoại đã được sử dụng"
            )

        # 4. Tạo username tự động từ tên hiển thị nếu chưa có
        safe_username = req.email.split("@")[0] + "_" + str(uuid.uuid4())[:4]

        # 5. Mã hóa mật khẩu an toàn qua Bcrypt
        hashed_pwd = hash_password(req.password)

        new_user = User(
            id=str(uuid.uuid4()),
            username=safe_username,
            email=req.email.lower(),
            phone=req.phone,
            password_hash=hashed_pwd,
            full_name=req.full_name,
            role="USER",
            status="active",
            avatar_url=None,
            cover_url=None,
            is_verified=False
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # 6. Tạo mã xác thực OTP gửi qua email
        otp_code = f"{random.randint(100000, 999999)}"
        ver_code = VerificationCode(
            user_id=new_user.id,
            email=new_user.email,
            code=otp_code,
            type="email_verification",
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(ver_code)
        db.commit()

        # 7. Gửi email xác thực
        email_sent = send_otp_email(to_email=new_user.email, code=otp_code, purpose="Xác thực tài khoản")

        user_data = UserResponse.model_validate(new_user).model_dump()
        user_data["demo_otp"] = otp_code
        user_data["requires_email_verification"] = True
        user_data["email_sent"] = email_sent
        return user_data

    @staticmethod
    def login(req: LoginRequest, db: Session) -> TokenResponse:
        """
        Đăng nhập vào hệ thống:
        - Đăng nhập bằng Email HOẶC Số điện thoại
        - Nếu thiếu thông tin: 'Vui lòng nhập đầy đủ thông tin'
        - Nếu không tồn tại hoặc mật khẩu sai: 'Email hoặc mật khẩu không chính xác' (không tiết lộ trường nào sai)
        - Nếu tài khoản bị khóa: 'Tài khoản của bạn đã bị khóa'
        """
        identifier = req.identifier.strip()
        pwd = req.password.strip()

        if not identifier or not pwd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vui lòng nhập đầy đủ thông tin"
            )

        # Tìm người dùng theo Email HOẶC Số điện thoại HOẶC Username
        user = db.query(User).filter(
            or_(
                User.email == identifier.lower(),
                User.phone == identifier,
                User.username == identifier
            )
        ).first()

        # Kiểm tra tồn tại và so khớp mật khẩu
        if not user or not verify_password(pwd, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc mật khẩu không chính xác"
            )

        # Kiểm tra tài khoản có bị khóa hay không
        if user.status == "banned":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản của bạn đã bị khóa"
            )

        # Cấp access token
        access_token = create_access_token({
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "name": user.full_name
        })

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
            message="Đăng nhập thành công"
        )

    @staticmethod
    def get_user_by_id(user_id: str, db: Session) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def verify_email(email: str, otp: str, db: Session) -> dict:
        email_clean = email.strip().lower()
        code_record = db.query(VerificationCode).filter(
            VerificationCode.email == email_clean,
            VerificationCode.code == otp.strip(),
            VerificationCode.type == "email_verification",
            VerificationCode.is_used == False,
            VerificationCode.expires_at >= datetime.utcnow()
        ).order_by(VerificationCode.created_at.desc()).first()

        if not code_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã xác thực không chính xác hoặc đã hết hạn"
            )

        code_record.is_used = True
        user = db.query(User).filter(User.email == email_clean).first()
        if user:
            user.is_verified = True
        db.commit()

        return {
            "email": email_clean,
            "is_verified": True,
            "message": "Xác thực email thành công! Tài khoản đã được kích hoạt."
        }

    @staticmethod
    def resend_verification_otp(email: str, db: Session) -> dict:
        email_clean = email.strip().lower()
        user = db.query(User).filter(User.email == email_clean).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản với email này"
            )

        # Hủy các mã cũ chưa dùng
        db.query(VerificationCode).filter(
            VerificationCode.email == email_clean,
            VerificationCode.type == "email_verification",
            VerificationCode.is_used == False
        ).update({"is_used": True})

        new_otp = f"{random.randint(100000, 999999)}"
        ver_code = VerificationCode(
            user_id=user.id,
            email=email_clean,
            code=new_otp,
            type="email_verification",
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(ver_code)
        db.commit()

        email_sent = send_otp_email(to_email=email_clean, code=new_otp, purpose="Xác thực tài khoản")

        return {
            "email": email_clean,
            "demo_otp": new_otp,
            "email_sent": email_sent,
            "message": "Đã gửi lại mã OTP mới tới email của bạn"
        }

    @staticmethod
    def forgot_password(identifier: str, db: Session) -> dict:
        clean_id = identifier.strip()
        user = db.query(User).filter(
            or_(
                User.email == clean_id.lower(),
                User.phone == clean_id,
                User.username == clean_id
            )
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản với thông tin đã cung cấp"
            )

        # Hủy các mã đặt lại mật khẩu cũ
        db.query(VerificationCode).filter(
            VerificationCode.email == user.email,
            VerificationCode.type == "password_reset",
            VerificationCode.is_used == False
        ).update({"is_used": True})

        otp_code = f"{random.randint(100000, 999999)}"
        ver_code = VerificationCode(
            user_id=user.id,
            email=user.email,
            code=otp_code,
            type="password_reset",
            expires_at=datetime.utcnow() + timedelta(minutes=15)
        )
        db.add(ver_code)
        db.commit()

        email_sent = send_otp_email(to_email=user.email, code=otp_code, purpose="Đặt lại mật khẩu")

        # Mask email: ví dụ linh.vothien@example.com -> l***n@example.com
        parts = user.email.split("@")
        if len(parts[0]) > 2:
            masked_name = parts[0][0] + "***" + parts[0][-1]
        else:
            masked_name = parts[0][0] + "***"
        masked_email = f"{masked_name}@{parts[1]}"

        return {
            "masked_email": masked_email,
            "email": user.email,
            "demo_otp": otp_code,
            "email_sent": email_sent,
            "message": f"Mã xác thực đã được gửi tới {masked_email}"
        }

    @staticmethod
    def reset_password(identifier: str, otp: str, new_password: str, db: Session) -> dict:
        clean_id = identifier.strip()
        user = db.query(User).filter(
            or_(
                User.email == clean_id.lower(),
                User.phone == clean_id,
                User.username == clean_id
            )
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản với thông tin đã cung cấp"
            )

        code_record = db.query(VerificationCode).filter(
            VerificationCode.email == user.email,
            VerificationCode.code == otp.strip(),
            VerificationCode.type == "password_reset",
            VerificationCode.is_used == False,
            VerificationCode.expires_at >= datetime.utcnow()
        ).order_by(VerificationCode.created_at.desc()).first()

        if not code_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã xác thực không chính xác hoặc đã hết hạn"
            )

        code_record.is_used = True
        user.password_hash = hash_password(new_password)
        db.commit()

        return {
            "success": True,
            "message": "Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới."
        }

    @staticmethod
    def verify_reset_otp(identifier: str, otp: str, db: Session) -> dict:
        clean_id = identifier.strip()
        user = db.query(User).filter(
            or_(
                User.email == clean_id.lower(),
                User.phone == clean_id,
                User.username == clean_id
            )
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản với thông tin đã cung cấp"
            )

        code_record = db.query(VerificationCode).filter(
            VerificationCode.email == user.email,
            VerificationCode.code == otp.strip(),
            VerificationCode.type == "password_reset",
            VerificationCode.is_used == False,
            VerificationCode.expires_at >= datetime.utcnow()
        ).order_by(VerificationCode.created_at.desc()).first()

        if not code_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã xác thực không chính xác hoặc đã hết hạn"
            )

        return {
            "email": user.email,
            "valid": True,
            "message": "Mã xác thực OTP chính xác! Bạn có thể đặt mật khẩu mới."
        }

