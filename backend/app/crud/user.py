from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import DUMMY_PASSWORD_HASH, hash_password, verify_password
from app.models import User, UserRole


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(User.email == email.strip().lower())
    return await db.scalar(stmt)


async def create(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    role: UserRole = UserRole.USER,
    first_name: str | None = None,
    last_name: str | None = None,
) -> User:
    user = User(
        email=email.strip().lower(),
        hashed_password=await hash_password(password),
        role=role,
        first_name=(first_name or "").strip() or None,
        last_name=(last_name or "").strip() or None,
    )
    db.add(user)
    await db.commit()
    return user


async def authenticate(db: AsyncSession, *, email: str, password: str) -> User | None:
    user = await get_by_email(db, email)
    if user is None:
        await verify_password(password, DUMMY_PASSWORD_HASH)  # iguala tiempos de respuesta
        return None
    if not await verify_password(password, user.hashed_password):
        return None
    return user


async def change_password(
    db: AsyncSession, user: User, *, current_password: str, new_password: str
) -> bool:
    """Cambia la contraseña si `current_password` es correcta. Devuelve False si no lo es."""
    if not await verify_password(current_password, user.hashed_password):
        return False
    user.hashed_password = await hash_password(new_password)
    await db.commit()
    return True


async def update_name(db: AsyncSession, user: User, *, first_name: str, last_name: str) -> User:
    user.first_name = first_name
    user.last_name = last_name
    await db.commit()
    return user


async def list_by_role(db: AsyncSession, role: UserRole) -> list[User]:
    stmt = select(User).where(User.role == role).order_by(User.first_name, User.email)
    return list((await db.scalars(stmt)).all())


async def get(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def set_role(db: AsyncSession, user: User, role: UserRole) -> User:
    user.role = role
    await db.commit()
    return user
