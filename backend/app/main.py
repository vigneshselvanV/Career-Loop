from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_analytics import router as analytics_router
from app.api.routes_curriculum import router as curriculum_router
from app.api.routes_market import router as market_router
from app.api.routes_mentor import router as mentor_router
from app.api.routes_onboarding import router as onboarding_router
from app.api.routes_profiler import router as profiler_router
from app.api.routes_stream import router as stream_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "CareerLoop — Agentic AI-Powered Career Identity, Skill Verification, "
        "and Adaptive Learning Platform API."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(profiler_router)
app.include_router(onboarding_router)
app.include_router(market_router)
app.include_router(curriculum_router)
app.include_router(mentor_router)
app.include_router(stream_router)
app.include_router(analytics_router)


@app.get("/api/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """Health check endpoint verifying FastAPI service availability."""
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
