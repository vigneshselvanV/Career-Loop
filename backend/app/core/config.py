from functools import lru_cache
from typing import Optional

from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client


class Settings(BaseSettings):
    """Central application configuration loaded from environment variables."""

    APP_NAME: str = "CareerLoop API"
    APP_VERSION: str = "1.0.0"

    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "cohere/north-mini-code:free"
    OPENROUTER_APP_URL: str = "http://localhost:3000"
    OPENROUTER_APP_NAME: str = "CareerLoop"

    GROQ_SUPERVISOR_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FAST_MODEL: str = "llama-3.1-8b-instant"

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()


def get_openrouter_llm(
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> ChatOpenAI:
    """Initialize OpenRouter ChatOpenAI client targeting google/gemini-2.5-flash."""
    settings = get_settings()
    if not settings.OPENROUTER_API_KEY or settings.OPENROUTER_API_KEY.startswith("sk-or-v1-your"):
        raise ValueError(
            "OPENROUTER_API_KEY is not configured. Set it in backend/.env to run PDF vision or structured extraction."
        )

    return ChatOpenAI(
        model=settings.OPENROUTER_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=temperature,
        max_tokens=max_tokens,
        default_headers={
            "HTTP-Referer": settings.OPENROUTER_APP_URL,
            "X-Title": settings.OPENROUTER_APP_NAME,
        },
    )


def get_groq_llm(
    fast: bool = False,
    temperature: float = 0.2,
    max_tokens: int = 2048,
) -> ChatGroq | ChatOpenAI:
    """
    Initialize Groq ChatGroq client for supervisor routing, diagnostics, or fast grading.
    If GROQ_API_KEY is unset and OPENROUTER_API_KEY is configured, seamlessly routes
    through OpenRouter using the configured OPENROUTER_MODEL.
    """
    settings = get_settings()
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("gsk_your"):
        return get_openrouter_llm(temperature=temperature, max_tokens=max_tokens)

    model_name = settings.GROQ_FAST_MODEL if fast else settings.GROQ_SUPERVISOR_MODEL
    return ChatGroq(
        model=model_name,
        api_key=settings.GROQ_API_KEY,
        temperature=temperature,
        max_tokens=max_tokens,
    )


_supabase_client: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """Return singleton Supabase client if valid credentials are configured, else None."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    settings = get_settings()
    url = settings.SUPABASE_URL.strip()
    key = settings.SUPABASE_SERVICE_ROLE_KEY.strip()

    if (
        not url
        or not key
        or "your-project-ref" in url
        or key.startswith("your_supabase")
    ):
        return None

    _supabase_client = create_client(url, key)
    return _supabase_client
