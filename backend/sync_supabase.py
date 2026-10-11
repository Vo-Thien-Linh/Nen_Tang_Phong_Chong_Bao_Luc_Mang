import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# Đảm bảo UTF-8 cho console
sys.stdout.reconfigure(encoding='utf-8')

# Load file .env trong backend
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

def sync_to_supabase():
    print("=" * 65)
    print("🚀 BẮT ĐẦU ĐỒNG BỘ CSDL LÊN SUPABASE (POSTGRESQL)")
    print("=" * 65)

    if not DATABASE_URL or "YOUR-PROJECT-REF" in DATABASE_URL or "localhost" in DATABASE_URL:
        print("\n❌ Chưa tìm thấy chuỗi kết nối Supabase hợp lệ trong file backend/.env!")
        print("👉 Vui lòng tạo file backend/.env với nội dung:")
        print("DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres\n")
        print("💡 Hoặc bạn có thể dùng CÁCH 1: Copy script SQL dán trực tiếp vào Supabase SQL Editor!")
        return

    base_dir = Path(__file__).resolve().parent.parent
    schema_path = base_dir / "database" / "schema.sql"
    seed_path = base_dir / "database" / "seed.sql"

    try:
        print(f"📡 Đang kết nối tới Supabase...")
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        print("✅ Kết nối Supabase thành công!")

        # 1. Chạy các lệnh cập nhật cột mới nếu bảng users đã tồn tại
        print("\n🔄 Bước 1: Cập nhật các cột mới (phone, status) vào bảng users...")
        alter_sql = """
        -- 1. Bật extension pgcrypto
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        -- 2. Thêm cột phone nếu chưa có
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
                ALTER TABLE users ADD COLUMN phone VARCHAR(20) UNIQUE;
                RAISE NOTICE 'Đã thêm cột phone';
            END IF;
        END $$;

        -- 3. Thêm cột status nếu chưa có
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN
                ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
                RAISE NOTICE 'Đã thêm cột status';
            END IF;
        END $$;

        -- 4. Tạo chỉ mục phone
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
        """
        cur.execute(alter_sql)
        print("✅ Cập nhật cấu trúc bảng users thành công!")

        # 2. Chạy schema.sql nếu cần tạo mới các bảng khác
        if schema_path.exists():
            print("\n📦 Bước 2: Kiểm tra và khởi tạo các bảng từ schema.sql...")
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            cur.execute(schema_sql)
            print("✅ schema.sql đồng bộ thành công!")

        # 3. Nạp dữ liệu mẫu seed.sql
        if seed_path.exists():
            print("\n🌱 Bước 3: Đồng bộ dữ liệu mẫu từ seed.sql...")
            with open(seed_path, "r", encoding="utf-8") as f:
                seed_sql = f.read()
            cur.execute(seed_sql)
            print("✅ seed.sql nạp thành công!")

        # 4. Kiểm tra kết quả
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';")
        cols = [r[0] for r in cur.fetchall()]
        print("\n🎉 Các cột hiện tại của bảng users trên Supabase:")
        print(", ".join(cols))

        cur.execute("SELECT COUNT(*) FROM users;")
        user_count = cur.fetchone()[0]
        print(f"👥 Tổng số người dùng trên Supabase: {user_count}")

        cur.close()
        conn.close()
        print("\n✨ ĐỒNG BỘ SUPABASE HOÀN TẤT 100%!")

    except Exception as e:
        print(f"\n❌ Lỗi khi đồng bộ Supabase: {e}")

if __name__ == "__main__":
    sync_to_supabase()
