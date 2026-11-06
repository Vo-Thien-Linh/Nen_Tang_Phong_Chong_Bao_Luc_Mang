import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

logger = logging.getLogger("uvicorn.error")

DATABASE_URL = settings.DATABASE_URL

# Chuẩn bị engine
engine = None
is_postgres = False

try:
    if "postgresql" in DATABASE_URL:
        # Nếu là PostgreSQL / Supabase (dùng pool size nhỏ để không chạm trần Supabase pooler)
        engine = create_engine(
            DATABASE_URL,
            pool_size=3,
            max_overflow=2,
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
            else:
                try:
                    conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_recalled BOOLEAN DEFAULT FALSE"))
                    conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT"))
                    conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'text'"))
                    conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS blocked_by UUID"))
                    conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'direct'"))
                    conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(100)"))
                    conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT"))
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
