import sys
import uuid
import unittest
sys.stdout.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient
import main
from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.user_settings import UserSettings
from app.utils.security import hash_password, create_access_token

class TestSettingsSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(main.app)
        cls.db = SessionLocal()
        
        # Tạo test user đặc thù cho bài test cài đặt với UUID chuẩn
        cls.test_user_id = str(uuid.uuid4())
        cls.test_email = f"testsettings_{cls.test_user_id[:8]}@gmail.com"
        cls.test_password = "Password123"
        
        # Dọn dẹp nếu đã tồn tại
        existing = cls.db.query(User).filter(User.id == cls.test_user_id).first()
        if existing:
            cls.db.delete(existing)
            cls.db.commit()

        new_user = User(
            id=cls.test_user_id,
            username="test_settings_account",
            email=cls.test_email,
            phone="0919999888",
            password_hash=hash_password(cls.test_password),
            full_name="Nguyễn Văn Cài Đặt",
            role="USER",
            status="active"
        )
        cls.db.add(new_user)
        cls.db.commit()

        cls.token = create_access_token({"sub": cls.test_user_id, "email": cls.test_email})
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    @classmethod
    def tearDownClass(cls):
        user = cls.db.query(User).filter(User.id == cls.test_user_id).first()
        if user:
            cls.db.delete(user)
            cls.db.commit()
        cls.db.close()

    def test_01_get_full_settings(self):
        """Kiểm tra lấy toàn bộ cài đặt người dùng"""
        res = self.client.get("/api/v1/settings", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["full_name"], "Nguyễn Văn Cài Đặt")
        self.assertTrue("ai_shield_enabled" in data)
        self.assertTrue("filter_keywords" in data)

    def test_02_update_profile_success(self):
        """Kiểm tra cập nhật hồ sơ thành công"""
        payload = {
            "full_name": "Nguyễn Văn Đã Cập Nhật",
            "bio": "Tiểu sử cá nhân mới đã được thay đổi an toàn",
            "location": "Hà Nội, Việt Nam",
            "education": "Đại học Bách Khoa"
        }
        res = self.client.put("/api/v1/settings/profile", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])

        # Kiểm tra lại qua GET
        res_check = self.client.get("/api/v1/settings", headers=self.headers)
        self.assertEqual(res_check.json()["full_name"], "Nguyễn Văn Đã Cập Nhật")
        self.assertEqual(res_check.json()["location"], "Hà Nội, Việt Nam")

    def test_03_update_profile_invalid_name(self):
        """Kiểm tra validate tên hiển thị < 3 ký tự"""
        payload = {"full_name": "AB"}
        res = self.client.put("/api/v1/settings/profile", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Tên hiển thị phải từ 3 - 30 kí tự", res.json()["detail"])

    def test_04_change_password_wrong_old(self):
        """Kiểm tra đổi mật khẩu khi nhập sai mật khẩu cũ"""
        payload = {
            "old_password": "WrongPassword999",
            "new_password": "NewPassword123",
            "confirm_password": "NewPassword123"
        }
        res = self.client.put("/api/v1/settings/password", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Mật khẩu hiện tại không chính xác", res.json()["detail"])

    def test_05_change_password_mismatch(self):
        """Kiểm tra mật khẩu xác nhận không khớp"""
        payload = {
            "old_password": "Password123",
            "new_password": "NewPassword123",
            "confirm_password": "DifferentPassword123"
        }
        res = self.client.put("/api/v1/settings/password", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Mật khẩu xác nhận không khớp", res.json()["detail"])

    def test_06_change_password_weak(self):
        """Kiểm tra mật khẩu mới không đủ điều kiện (thiếu ký tự hoa, số)"""
        payload = {
            "old_password": "Password123",
            "new_password": "weakpassword",
            "confirm_password": "weakpassword"
        }
        res = self.client.put("/api/v1/settings/password", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Mật khẩu mới bắt buộc", res.json()["detail"])

    def test_07_change_password_success(self):
        """Kiểm tra đổi mật khẩu thành công"""
        payload = {
            "old_password": "Password123",
            "new_password": "NewPassword456",
            "confirm_password": "NewPassword456"
        }
        res = self.client.put("/api/v1/settings/password", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])

    def test_08_update_safety_shield(self):
        """Kiểm tra cập nhật khiên bảo vệ AI và từ khóa cấm cá nhân"""
        payload = {
            "ai_shield_enabled": True,
            "ai_sensitivity": "high",
            "auto_hide_toxic_comments": True,
            "filter_keywords": "xấu xí, hạ đẳng, cút đi",
            "block_strangers_messages": True
        }
        res = self.client.put("/api/v1/settings/safety", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["ai_sensitivity"], "high")
        self.assertEqual(data["filter_keywords"], "xấu xí, hạ đẳng, cút đi")

    def test_09_update_privacy(self):
        """Kiểm tra cập nhật quyền riêng tư bài viết"""
        payload = {
            "post_default_privacy": "friends",
            "show_email": True
        }
        res = self.client.put("/api/v1/settings/privacy", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["post_default_privacy"], "friends")

    def test_10_toggle_2fa(self):
        """Kiểm tra bật/tắt 2FA"""
        res = self.client.post("/api/v1/settings/2fa/toggle", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["data"]["two_factor_enabled"])


if __name__ == "__main__":
    unittest.main()
