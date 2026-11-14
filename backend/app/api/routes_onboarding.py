from fastapi import APIRouter, HTTPException, status

from app.agents.onboarding_agent import analyze_onboarding_context
from app.schemas.onboarding_schemas import (
    OnboardingAnalyzeRequest,
    OnboardingAnalyzeResponse,
)

router = APIRouter(prefix="/api/onboarding", tags=["AI Onboarding"])


@router.post(
    "/analyze",
    response_model=OnboardingAnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze learner onboarding background and generate personalized 60s diagnostic",
)
async def analyze_onboarding(
    payload: OnboardingAnalyzeRequest,
) -> OnboardingAnalyzeResponse:
    try:
        return await analyze_onboarding_context(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Onboarding analysis failed: {exc}",
        ) from exc
