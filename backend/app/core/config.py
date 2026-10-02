from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # el .env también trae POSTGRES_* que usa docker-compose
        env_ignore_empty=True,  # "VAR=" en el .env cuenta como "no definida"
    )

    PROJECT_NAME: str = "AJR Data API"
    ENVIRONMENT: str = "development"  # "production" activa los controles estrictos

    DATABASE_URL: str
    SECRET_KEY: str = Field(min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 24, gt=0)

    # Admin inicial (opcional). Los nombres FIRST_ADMIN_* se aceptan como alias legacy.
    ADMIN_EMAIL: str | None = Field(
        default=None, validation_alias=AliasChoices("ADMIN_EMAIL", "FIRST_ADMIN_EMAIL")
    )
    ADMIN_PASSWORD: str | None = Field(
        default=None, validation_alias=AliasChoices("ADMIN_PASSWORD", "FIRST_ADMIN_PASSWORD")
    )
    ADMIN_FULL_NAME: str | None = None

    # Orígenes CORS separados por coma (solo importa en desarrollo: en producción
    # el frontend se sirve desde el mismo dominio).
    CORS_ORIGINS: str = "http://localhost:5173"

    # Cloudflare Turnstile (anti-bots en formularios públicos)
    TURNSTILE_SECRET_KEY: str | None = None

    # Email. EMAIL_BACKEND="smtp" (default) manda por SMTP; "console" es un mock que solo
    # loguea el mail completo (útil en desarrollo y para probar sin proveedor).
    # Con "smtp" y sin SMTP_HOST, los mails se omiten (se loguea).
    EMAIL_BACKEND: str = "smtp"  # "smtp" | "console"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None  # default: SMTP_USER
    SMTP_TLS: str = "starttls"  # "starttls" | "ssl" | "none"
    ADMIN_NOTIFY_EMAIL: str | None = None  # default: ADMIN_EMAIL

    # URL pública del sitio (sin barra final). Se usa para los links dentro de los mails.
    PUBLIC_BASE_URL: str | None = None

    # Papelera: los pedidos/postulaciones borrados se eliminan de verdad pasados N días.
    TRASH_RETENTION_DAYS: int = Field(default=30, gt=0)
    TRASH_PURGE_INTERVAL_MINUTES: int = Field(default=60, gt=0)
    SCHEDULER_ENABLED: bool = True  # False desactiva las tareas periódicas (APScheduler)

    # Límite de envíos por IP en los formularios públicos
    RATE_LIMIT_PER_HOUR: int = Field(default=5, gt=0)

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        """Acepta URLs "estándar" de proveedores (postgres://, postgresql://, sslmode=...)
        y las convierte a lo que espera SQLAlchemy + asyncpg."""
        url = make_url(value)
        if url.drivername in ("postgres", "postgresql"):
            url = url.set(drivername="postgresql+asyncpg")

        query = dict(url.query)
        if "sslmode" in query:  # asyncpg usa "ssl" en lugar de "sslmode"
            query["ssl"] = query.pop("sslmode")
        query.pop("channel_binding", None)  # parámetro de libpq que asyncpg no entiende
        url = url.set(query=query)

        return url.render_as_string(hide_password=False)

    @model_validator(mode="after")
    def _reject_example_secret_in_production(self) -> "Settings":
        if self.is_production and self.SECRET_KEY.lower().startswith("cambiame"):
            raise ValueError(
                "SECRET_KEY es el valor de ejemplo del .env.example: generá una propia "
                "(python -c \"import secrets; print(secrets.token_urlsafe(48))\")."
            )
        return self

    @field_validator("EMAIL_BACKEND")
    @classmethod
    def _check_email_backend(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ("smtp", "console"):
            raise ValueError('EMAIL_BACKEND debe ser "smtp" o "console"')
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    @property
    def notify_email(self) -> str | None:
        return self.ADMIN_NOTIFY_EMAIL or self.ADMIN_EMAIL


settings = Settings()  # type: ignore[call-arg]
