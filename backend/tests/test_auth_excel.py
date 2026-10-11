import sys
import unittest
sys.stdout.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient
import main

class TestAuthExcelMatrix(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def test_TC_LOG_01_empty_fields(self):
        """TC_LOG_01: Để trống Email hoặc Mật khẩu -> 'Vui lòng nhập đầy đủ thông tin'"""
        res = self.client.post("/api/v1/auth/login", json={"identifier": "", "password": ""})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập đầy đủ thông tin", res.json().get("detail", ""))

    def test_TC_LOG_02_non_existent_identifier(self):
        """TC_LOG_02: Nhập Email/SĐT không tồn tại -> 'Email hoặc mật khẩu không chính xác'"""
        res = self.client.post("/api/v1/auth/login", json={"identifier": "khongtontai@gmail.com", "password": "Password123"})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json().get("detail"), "Email hoặc mật khẩu không chính xác")

    def test_TC_LOG_03_wrong_password(self):
        """TC_LOG_03: Mật khẩu sai -> 'Email hoặc mật khẩu không chính xác' (không tiết lộ trường sai)"""
        res = self.client.post("/api/v1/auth/login", json={"identifier": "0912345678", "password": "WrongPassword999"})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json().get("detail"), "Email hoặc mật khẩu không chính xác")

    def test_TC_LOG_04_login_by_phone_success(self):
        """TC_LOG_04: Đăng nhập bằng SỐ ĐIỆN THOẠI hợp lệ -> 200 OK + JWT Token"""
        res = self.client.post("/api/v1/auth/login", json={"identifier": "0912345678", "password": "Password123"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(bool(data.get("access_token")))
        self.assertEqual(data.get("message"), "Đăng nhập thành công")
        self.assertEqual(data.get("user", {}).get("full_name"), "Võ Thiện Linh")

    def test_TC_LOG_05_login_by_email_success(self):
        """TC_LOG_05: Đăng nhập bằng EMAIL hợp lệ -> 200 OK + JWT Token"""
        res = self.client.post("/api/v1/auth/login", json={"identifier": "linh.vothien@example.com", "password": "Password123"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(bool(data.get("access_token")))
        self.assertEqual(data.get("message"), "Đăng nhập thành công")

    def test_TC_LOG_06_banned_account(self):
        """TC_LOG_06: Tài khoản bị khóa -> 'Tài khoản của bạn đã bị khóa'"""
        res = self.client.post("/api/v1/auth/login", json={"identifier": "0988888888", "password": "Password123"})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json().get("detail"), "Tài khoản của bạn đã bị khóa")

    def test_TC_REG_02_short_name(self):
        """TC_REG_02: Tên hiển thị < 3 ký tự -> Báo lỗi độ dài"""
        res = self.client.post("/api/v1/auth/register", json={
            "full_name": "AB",
            "email": "testshort@gmail.com",
            "phone": "0912000001",
            "password": "Password123",
            "confirm_password": "Password123"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("3 - 30 kí tự", res.json().get("detail", ""))

    def test_TC_REG_03_duplicate_name(self):
        """TC_REG_03: Tên hiển thị đã tồn tại -> 'Tên đã được tồn tại'"""
        res = self.client.post("/api/v1/auth/register", json={
            "full_name": "Võ Thiện Linh",
            "email": "testdupname@gmail.com",
            "phone": "0912000002",
            "password": "Password123",
            "confirm_password": "Password123"
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json().get("detail"), "Tên đã được tồn tại")

    def test_TC_REG_04_invalid_email(self):
        """TC_REG_04: Email sai định dạng -> Báo lỗi định dạng email"""
        res = self.client.post("/api/v1/auth/register", json={
            "full_name": "Nguyen Van B",
            "email": "invalid-email-format",
            "phone": "0912000003",
            "password": "Password123",
            "confirm_password": "Password123"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("đúng định dạng", res.json().get("detail", ""))

    def test_TC_REG_05_duplicate_email(self):
        """TC_REG_05: Email đã tồn tại -> 'Email đã được sử dụng'"""
        res = self.client.post("/api/v1/auth/register", json={
            "full_name": "Người Dùng Mới",
            "email": "linh.vothien@example.com",
            "phone": "0912000004",
            "password": "Password123",
            "confirm_password": "Password123"
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json().get("detail"), "Email đã được sử dụng")

    def test_TC_REG_06_duplicate_phone(self):
        """TC_REG_06: Số điện thoại đã tồn tại -> 'Số điện thoại đã được sử dụng'"""
        res = self.client.post("/api/v1/auth/register", json={
            "full_name": "Người Dùng Phone Mới",
            "email": "newuserphone@gmail.com",
            "phone": "0912345678", # Phone của Võ Thiện Linh
            "password": "Password123",
            "confirm_password": "Password123"
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json().get("detail"), "Số điện thoại đã được sử dụng")

    def test_TC_REG_07_weak_password(self):
        """TC_REG_07: Mật khẩu < 8 ký tự hoặc thiếu Hoa/Thường/Số -> Báo lỗi mật khẩu"""
        res = self.client.post("/api/v1/auth/register", json={
            "full_name": "Người Dùng Mật Khẩu Yếu",
            "email": "weakpwd@gmail.com",
            "phone": "0912000005",
            "password": "12345", # Yếu
            "confirm_password": "12345"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("8 kí tự", res.json().get("detail", ""))

    def test_TC_REG_08_password_mismatch(self):
        """TC_REG_08: Mật khẩu xác nhận không khớp -> 'Mật khẩu xác nhận không khớp'"""
        res = self.client.post("/api/v1/auth/register", json={
            "full_name": "Người Dùng Lệch Pass",
            "email": "mismatchpass@gmail.com",
            "phone": "0912000006",
            "password": "Password123",
            "confirm_password": "Password456"
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json().get("detail"), "Mật khẩu xác nhận không khớp")

    def test_TC_REG_09_register_success(self):
        """TC_REG_09: Đăng ký thành công -> 'Đăng kí thành công'"""
        import uuid, random
        unique_suffix = str(uuid.uuid4())[:6]
        phone_digits = f"091{random.randint(1000000, 9999999)}"
        res = self.client.post("/api/v1/auth/register", json={
            "full_name": f"Học Viên Mới {unique_suffix}",
            "email": f"hocvien_{unique_suffix}@gmail.com",
            "phone": phone_digits,
            "password": "Password123",
            "confirm_password": "Password123"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("message"), "Đăng kí thành công")

    def test_TC_OUT_01_logout(self):
        """TC_OUT_01: Đăng xuất hệ thống -> 200 OK + 'Đăng xuất thành công'"""
        res = self.client.post("/api/v1/auth/logout")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("message"), "Đăng xuất thành công")

if __name__ == "__main__":
    unittest.main()
