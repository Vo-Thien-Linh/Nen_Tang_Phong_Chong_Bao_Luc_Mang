import os
import sys
import smtplib
from pathlib import Path

# Đảm bảo console Windows không bị lỗi Unicode charmap cp1252
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Đảm bảo nạp .env từ thư mục backend
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

def send_otp_email(to_email: str, code: str, purpose: str = "Xác thực tài khoản") -> bool:
    """
    Gửi email thật chứa mã xác thực OTP qua giao thức SMTP Gmail.
    Cần cấu hình trong backend/.env:
      - SMTP_USER: Địa chỉ Gmail (ví dụ: yourname@gmail.com)
      - SMTP_PASSWORD: Mật khẩu ứng dụng 16 ký tự của Google (App Password)
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587").strip())
    smtp_user = os.getenv("SMTP_USER", "").strip()
    # Loại bỏ khoảng trắng nếu người dùng copy mật khẩu ứng dụng có dấu cách (vd: abcd efgh ijkl mnop)
    smtp_pass = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
    from_name = os.getenv("SMTP_FROM_NAME", "WINGS Social Network").strip()
    from_email = os.getenv("SMTP_FROM_EMAIL", "").strip() or smtp_user or "no-reply@wingssocial.vn"

    subject = f"[WINGS] Mã xác thực {purpose}: {code}"

    text_content = f"""
Chào bạn,

Bạn đang thực hiện thao tác {purpose.lower()} trên hệ thống WINGS Social Network.
Mã xác thực OTP của bạn là: {code}

Mã có hiệu lực trong vòng 10 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.

Trân trọng,
Đội ngũ WINGS Social Network
    """.strip()

    html_content = f"""
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{subject}</title>
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #334155; }}
        .card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }}
        .header {{ background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }}
        .header p {{ margin: 6px 0 0; font-size: 13px; opacity: 0.92; }}
        .body {{ padding: 36px 28px; text-align: center; }}
        .title {{ font-size: 17px; font-weight: 700; margin-bottom: 12px; color: #0f172a; }}
        .desc {{ font-size: 13.5px; line-height: 1.6; color: #64748b; margin: 10px 0; }}
        .otp-container {{ margin: 24px 0; }}
        .otp-box {{ display: inline-block; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 14px; padding: 14px 32px; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; font-family: 'Courier New', monospace; }}
        .warning {{ background: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 12px; font-size: 12px; color: #b91c1c; margin-top: 20px; }}
        .footer {{ background: #f8fafc; padding: 18px 24px; font-size: 11.5px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>WINGS Social Network</h1>
          <p>Nền tảng phòng chống bạo lực mạng & kết nối văn minh</p>
        </div>
        <div class="body">
          <div class="title">Yêu cầu {purpose}</div>
          <p class="desc">Bạn đang thực hiện thao tác <strong>{purpose.lower()}</strong> trên WINGS. Vui lòng nhập mã OTP dưới đây để hoàn tất:</p>
          <div class="otp-container">
            <div class="otp-box">{code}</div>
          </div>
          <p class="desc">Mã OTP có hiệu lực trong vòng <strong>10 phút</strong>.</p>
          <div class="warning">
            🛡️ <strong>Bảo mật:</strong> Tuyệt đối không cung cấp mã OTP này cho bất kỳ ai, kể cả nhân viên hỗ trợ kỹ thuật.
          </div>
        </div>
        <div class="footer">
          Email này được gửi tự động từ hệ thống WINGS. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email để đảm bảo an toàn tài khoản.
        </div>
      </div>
    </body>
    </html>
    """.strip()

    # Log ra console để tiện kiểm tra
    try:
        print(f"\n=======================================================")
        print(f"[EmailService] [YEU CAU GUI OTP]")
        print(f"  • Người nhận: {to_email}")
        print(f"  • Mục đích  : {purpose}")
        print(f"  • Mã OTP    : {code}")
        print(f"=======================================================\n")
    except Exception:
        pass

    # Kiểm tra xem đã có cấu hình SMTP thật hay chưa
    if not smtp_user or not smtp_pass:
        print(f"[EmailService] ⚠️ CHƯA CẤU HÌNH GMAIL THẬT:")
        print(f"  Vui lòng mở file backend/.env và điền:")
        print(f"    SMTP_USER=your_email@gmail.com")
        print(f"    SMTP_PASSWORD=xxxx xxxx xxxx xxxx (Mật khẩu ứng dụng 16 ký tự Google)")
        print(f"  Mã OTP hiện tại được in ra console phục vụ kiểm thử: {code}")
        return False

    # Thực hiện gửi email thật qua SMTP Gmail
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        if smtp_port == 465:
            # SSL
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [to_email], msg.as_string())
        else:
            # STARTTLS (Port 587)
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [to_email], msg.as_string())

        print(f"[EmailService] ✔ ĐÃ GỬI EMAIL THẬT THÀNH CÔNG tới: {to_email} qua Gmail SMTP")
        return True

    except smtplib.SMTPAuthenticationError as auth_err:
        print(f"[EmailService] ❌ LỖI XÁC THỰC GMAIL (535 Authentication Failed):")
        print(f"  Tài khoản hoặc Mật khẩu ứng dụng (App Password) không chính xác.")
        print(f"  Chi tiết: {auth_err}")
        return False
    except Exception as e:
        print(f"[EmailService] ❌ GỬI EMAIL THẤT BẠI: {type(e).__name__}: {e}")
        return False
