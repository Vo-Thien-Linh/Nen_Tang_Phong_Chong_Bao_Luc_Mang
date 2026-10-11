import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from ..models.user import User
from ..schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse
from ..utils.security import hash_password, verify_password, create_access_token

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
            avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
            is_verified=False
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return UserResponse.model_validate(new_user)

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
