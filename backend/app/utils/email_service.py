import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_otp_email(to_email: str, code: str, purpose: str = "Xác thực tài khoản") -> bool:
    """
    Gửi email chứa mã xác thực OTP.
    Nếu cấu hình SMTP_USER và SMTP_PASSWORD trong .env/Settings thì sẽ gửi email thật qua SMTP Gmail.
    Nếu chưa cấu hình hoặc gửi lỗi, tự động fallback ghi log ra console để phục vụ dev/kiểm thử.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    from_name = os.getenv("SMTP_FROM_NAME", "WINGS Social Network")
    from_email = smtp_user if smtp_user else os.getenv("SMTP_FROM_EMAIL", "no-reply@wingssocial.vn")

    subject = f"[WINGS] Mã xác thực {purpose}: {code}"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }}
        .card {{ max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
        .header {{ background: linear-gradient(135deg, #1d4ed8, #2563eb); padding: 28px 24px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }}
        .header p {{ margin: 6px 0 0; font-size: 13px; opacity: 0.9; }}
        .body {{ padding: 32px 24px; text-align: center; color: #334155; }}
        .title {{ font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }}
        .otp-box {{ display: inline-block; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 14px 28px; margin: 16px 0; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace; }}
        .desc {{ font-size: 13px; line-height: 1.6; color: #64748b; margin-top: 8px; }}
        .footer {{ background: #f1f5f9; padding: 16px 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }}
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
          <p class="desc">Bạn đang thực hiện thao tác {purpose.lower()} trên hệ thống WINGS. Vui lòng sử dụng mã xác thực OTP dưới đây:</p>
          <div class="otp-box">{code}</div>
          <p class="desc">Mã OTP có hiệu lực trong vòng <strong>10 phút</strong>.<br>Vì lý do bảo mật, tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
        <div class="footer">
          Đây là email tự động từ hệ thống WINGS. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
        </div>
      </div>
    </body>
    </html>
    """

    # In log ra terminal để tester và dev luôn thấy được OTP ngay lập tức
    print(f"\n=======================================================")
    print(f"[EmailService] [OTP NOTIFICATION]")
    print(f"  • Người nhận: {to_email}")
    print(f"  • Mục đích:   {purpose}")
    print(f"  • Mã OTP:     {code}")
    print(f"=======================================================\n")

    if smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{from_name} <{from_email}>"
            msg["To"] = to_email
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, to_email, msg.as_string())
            print(f"[EmailService] Đã gửi email thực tế thành công tới {to_email} qua SMTP")
            return True
        except Exception as e:
            print(f"[EmailService] Lưu ý: Gửi email SMTP thất bại ({e}). Đã fallback in mã OTP ra console.")
            return False

    return True
