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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
