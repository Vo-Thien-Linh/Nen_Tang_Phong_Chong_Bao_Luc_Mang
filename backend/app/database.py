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
        # Nếu là PostgreSQL / Supabase
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            connect_args={"sslmode": "require", "connect_timeout": 3} if "supabase" in DATABASE_URL else {"connect_timeout": 3}
        )
        # Test kết nối nhanh
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
                existing_msg_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(messages)")).fetchall()]
                if existing_msg_cols:
                    if "is_recalled" not in existing_msg_cols:
                        conn.execute(text("ALTER TABLE messages ADD COLUMN is_recalled BOOLEAN DEFAULT 0"))
                    if "media_url" not in existing_msg_cols:
                        conn.execute(text("ALTER TABLE messages ADD COLUMN media_url TEXT"))
                    if "media_type" not in existing_msg_cols:
                        conn.execute(text("ALTER TABLE messages ADD COLUMN media_type VARCHAR(20) DEFAULT 'text'"))

                existing_conv_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(conversations)")).fetchall()]
                if existing_conv_cols:
                    if "blocked_by" not in existing_conv_cols:
                        conn.execute(text("ALTER TABLE conversations ADD COLUMN blocked_by TEXT"))
                conn.commit()
            else:
                conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_recalled BOOLEAN DEFAULT FALSE"))
                conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT"))
                conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'text'"))
                conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS blocked_by UUID"))
                conn.commit()
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
