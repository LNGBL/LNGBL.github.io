from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "LangBlue AI Engine"
    log_level: str = "INFO"
    api_prefix: str = "/v1"
    allowed_origins: str = "https://lngbl.github.io"
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str = Field(repr=False)
    openai_api_key: str = Field(default="", repr=False)
    openai_model: str = "gpt-4.1-mini"
    request_timeout_seconds: int = Field(default=30, ge=5, le=90)
    max_context_items: int = Field(default=12, ge=1, le=30)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
