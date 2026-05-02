from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

final_db_url = settings.DATABASE_URL
if final_db_url:
    if final_db_url.startswith("postgres://"):
        final_db_url = final_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif final_db_url.startswith("postgresql://") and "asyncpg" not in final_db_url:
        final_db_url = final_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Internal Railway URL needs no SSL, public URL needs no SSL either (Railway handles it)
is_railway = "railway.internal" in final_db_url or "rlwy.net" in final_db_url

engine = create_async_engine(
    final_db_url,
    connect_args={
        "statement_cache_size": 0,
        "server_settings": {"jit": "off"},   # prevents asyncpg JIT memory spikes
        "timeout": 30,                        # connection timeout in seconds
    },
    pool_size=5,          # was 10 — Railway hobby DB has ~25 max connections, keep headroom
    max_overflow=10,      # was 20 — total max 15 connections, safe for Railway
    pool_recycle=120,     # was 300 — Railway drops idle connections after ~2min, recycle before that
    pool_pre_ping=True,   # validates connection before use — fixes ConnectionDoesNotExistError
    pool_timeout=20,      # was 30 — fail faster, don't queue forever
    echo=False
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)