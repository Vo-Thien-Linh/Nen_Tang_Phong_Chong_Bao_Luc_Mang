import ipaddress
import logging
from urllib.parse import urlparse
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

logger = logging.getLogger("uvicorn.error")

DATABASE_URL = settings.DATABASE_URL


def _is_local_or_docker_postgres(database_url: str) -> bool:
    """Trả về True khi URL trỏ tới PostgreSQL local hoặc Docker nội bộ."""
    if not database_url:
        return False
    try:
        host = (urlparse(database_url).hostname or "").lower()
    except ValueError:
        host = ""
    if not host:
        return "localhost" in database_url or "127.0.0.1" in database_url
    if "." not in host or host in {"localhost", "::1", "0.0.0.0"} or host.endswith((".local", ".internal")):
        return True
    try:
        ip = ipaddress.ip_address(host)
        return ip.is_loopback or ip.is_private
    except ValueError:
        return False


# Chuẩn bị engine
engine = None
is_postgres = False

try:
    if "postgresql" in DATABASE_URL:
        is_local_pg = _is_local_or_docker_postgres(DATABASE_URL)
        # Local/Docker mở pool lớn hơn; Supabase giữ pool nhỏ để không chạm trần pooler
        engine = create_engine(
            DATABASE_URL,
            pool_size=10 if is_local_pg else 3,
            max_overflow=5 if is_local_pg else 2,
            pool_recycle=300,
            pool_pre_ping=True,
            connect_args={"sslmode": "require", "connect_timeout": 5} if "supabase" in DATABASE_URL else {"connect_timeout": 5}
        )
        # Test kết nối
        with engine.connect() as conn:
            is_postgres = True
            logger.info("[Database] Da ket noi thanh cong toi PostgreSQL/Supabase!")
    else:
        # SQLite
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False}
        )
except Exception as e:
    logger.warning(f"[Database] PostgreSQL chua san sang ({e}). Tu dong chuyen sang SQLite cuc bo nexussocial_dev.db de he thong luon hoat dong on dinh!")
    engine = create_engine(
        "sqlite:///./nexussocial_dev.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def ensure_schema_migrations(eng):
    try:
        from sqlalchemy import text
        with eng.connect() as conn:
            if "sqlite" in str(eng.url):
                existing_user_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
                if existing_user_cols:
                    if "banned_until" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN banned_until TIMESTAMP"))
                    if "ban_reason" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN ban_reason TEXT"))
                    if "cooldown_until" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN cooldown_until TIMESTAMP"))
                    if "cooldown_reason" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN cooldown_reason TEXT"))
                    if "cooldown_violation_text" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN cooldown_violation_text TEXT"))
                    if "trust_score" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN trust_score INTEGER DEFAULT 100"))

                existing_msg_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(messages)")).fetchall()]
                if existing_msg_cols:
                    if "is_recalled" not in existing_msg_cols:
                        conn.execute(text("ALTER TABLE messages ADD COLUMN is_recalled BOOLEAN DEFAULT 0"))
                    if "media_url" not in existing_msg_cols:
                        conn.execute(text("ALTER TABLE messages ADD COLUMN media_url TEXT"))
                    if "media_type" not in existing_msg_cols:
                        conn.execute(text("ALTER TABLE messages ADD COLUMN media_type VARCHAR(20) DEFAULT 'text'"))

                existing_user_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
                if existing_user_cols:
                    if "banned_until" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN banned_until TIMESTAMP"))
                    if "ban_reason" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN ban_reason TEXT"))
                    if "created_at" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP"))
                    if "updated_at" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP"))
                    if "last_seen" not in existing_user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN last_seen TIMESTAMP"))

                existing_conv_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(conversations)")).fetchall()]
                if existing_conv_cols:
                    if "blocked_by" not in existing_conv_cols:
                        conn.execute(text("ALTER TABLE conversations ADD COLUMN blocked_by TEXT"))
                    if "type" not in existing_conv_cols:
                        conn.execute(text("ALTER TABLE conversations ADD COLUMN type VARCHAR(20) DEFAULT 'direct'"))
                    if "name" not in existing_conv_cols:
                        conn.execute(text("ALTER TABLE conversations ADD COLUMN name VARCHAR(100)"))
                    if "avatar_url" not in existing_conv_cols:
                        conn.execute(text("ALTER TABLE conversations ADD COLUMN avatar_url TEXT"))

                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS conversation_members (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                        user_id TEXT NOT NULL,
                        role VARCHAR(20) DEFAULT 'member' NOT NULL,
                        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
            else:
                try:
                    # Giới hạn thời gian chờ lock và truy vấn tối đa 2s để không bao giờ treo startup của backend
                    try:
                        conn.execute(text("SET lock_timeout = '2s'"))
                        conn.execute(text("SET statement_timeout = '3s'"))
                    except Exception:
                        pass

                    # Kiểm tra danh sách cột có sẵn trước để tránh lệnh ALTER TABLE chiếm ACCESS EXCLUSIVE lock
                    user_cols = [r[0] for r in conn.execute(text(
                        "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
                    )).fetchall()]
                    if user_cols and "last_seen" not in user_cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ"))

                    conv_cols = [r[0] for r in conn.execute(text(
                        "SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations'"
                    )).fetchall()]

                    msg_cols = [r[0] for r in conn.execute(text(
                        "SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'"
                    )).fetchall()]

                    if msg_cols:
                        if "is_recalled" not in msg_cols:
                            conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_recalled BOOLEAN DEFAULT FALSE"))
                        if "media_url" not in msg_cols:
                            conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT"))
                        if "media_type" not in msg_cols:
                            conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'text'"))

                    if conv_cols:
                        if "blocked_by" not in conv_cols:
                            conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS blocked_by UUID"))
                        if "type" not in conv_cols:
                            conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'direct'"))
                        if "name" not in conv_cols:
                            conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(100)"))
                        if "avatar_url" not in conv_cols:
                            conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT"))
                        if "type" not in conv_cols:
                            conn.execute(text("ALTER TABLE conversations ALTER COLUMN user1_id DROP NOT NULL"))
                            conn.execute(text("ALTER TABLE conversations ALTER COLUMN user2_id DROP NOT NULL"))
                            conn.execute(text("ALTER TABLE conversations DROP CONSTRAINT IF EXISTS chk_conv_not_self"))
                            conn.execute(text("ALTER TABLE conversations ADD CONSTRAINT chk_conv_not_self CHECK (type = 'group' OR (user1_id IS NOT NULL AND user2_id IS NOT NULL AND user1_id <> user2_id))"))
                            conn.execute(text("DROP INDEX IF EXISTS idx_unique_conversation_pair"))
                            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_conversation_pair ON conversations (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)) WHERE (type = 'direct' OR type IS NULL)"))
                            conn.execute(text("ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL"))
                            conn.execute(text("ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_not_self_message"))
                            conn.execute(text("ALTER TABLE messages ADD CONSTRAINT chk_not_self_message CHECK (receiver_id IS NULL OR sender_id <> receiver_id)"))

                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS conversation_members (
                            id BIGSERIAL PRIMARY KEY,
                            conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                            user_id UUID NOT NULL,
                            role VARCHAR(20) DEFAULT 'member' NOT NULL,
                            joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                    conn.commit()
                except Exception as inner_e:
                    logger.warning(f"[Database] Migration non-critical check: {inner_e}")
    except Exception as e:
        logger.warning(f"[Database] Migration check: {e}")

try:
    ensure_schema_migrations(engine)
except Exception:
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
