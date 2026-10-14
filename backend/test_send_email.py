import os
import sys
from pathlib import Path

# Đảm bảo console Windows không bị lỗi Unicode charmap cp1252
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

from dotenv import load_dotenv

# Nạp file .env từ thư mục backend
BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / '.env'
load_dotenv(dotenv_path=env_path)

# Thêm backend vào sys.path
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.utils.email_service import send_otp_email

def main():
    recipient = sys.argv[1] if len(sys.argv) > 1 else os.getenv("SMTP_USER", "")
    
    print("=" * 60)
    print("  KIỂM TRA CHỨC NĂNG GỬI GMAIL THẬT (SMTP GMAIL)")
    print("=" * 60)
    print(f"File .env:     {env_path}")
    print(f"SMTP Host:     {os.getenv('SMTP_HOST', 'smtp.gmail.com')}")
    print(f"SMTP Port:     {os.getenv('SMTP_PORT', '587')}")
    print(f"SMTP User:     {os.getenv('SMTP_USER', '(Chưa điền)')}")
    print(f"SMTP Pass:     {'*' * len(os.getenv('SMTP_PASSWORD', '')) if os.getenv('SMTP_PASSWORD') else '(Chưa điền)'}")
    print(f"Gửi tới email: {recipient if recipient else '(Chưa có địa chỉ nhận)'}")
    print("=" * 60)
    
    if not recipient or not os.getenv("SMTP_USER"):
        print("\n❌ CHƯA CÓ CẤU HÌNH GMAIL TRONG backend/.env:")
        print("  1. Mở file backend/.env")
        print("  2. Điền thông tin:")
        print("       SMTP_USER=email_cua_ban@gmail.com")
        print("       SMTP_PASSWORD=xxxx xxxx xxxx xxxx (Mật khẩu ứng dụng Google)")
        print("\nSau đó chạy lại lệnh: python test_send_email.py [email_nhan@gmail.com]")
        sys.exit(1)
        
    print(f"\nĐang kết nối tới máy chủ Gmail và gửi mã OTP thử nghiệm tới {recipient}...")
    success = send_otp_email(to_email=recipient, code="888999", purpose="Kiểm tra gửi Gmail thật")
    
    if success:
        print("\n🎉 CHÚC MỪNG: Email thật đã được gửi thành công!")
        print(f"Vui lòng kiểm tra hộp thư đến (Inbox) hoặc Spam của: {recipient}")
    else:
        print("\n⚠️ CHƯA GỬI ĐƯỢC:")
        print("Vui lòng kiểm tra lại cấu hình SMTP_USER và SMTP_PASSWORD trong backend/.env.")

if __name__ == "__main__":
    main()
