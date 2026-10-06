from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # descarta conexiones caídas (p. ej. DB serverless que se suspende)
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # evita lazy-loads implícitos tras el commit (rompen en async)
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Una sesión por request. Los commits se hacen explícitamente en la capa crud."""
    async with AsyncSessionLocal() as session:
        yield session
