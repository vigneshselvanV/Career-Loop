from fastapi import APIRouter, HTTPException, status

from app.agents.orchestrator import run_orchestrator
from app.schemas.market_schemas import (
    JobRoleBenchmark,
    MarketAnalysisRequest,
    MarketAnalysisResponse,
    RoleSwitchRequest,
    SkillGapItem,
)
from app.services.role_benchmarks import list_role_benchmarks

router = APIRouter(prefix="/api/market", tags=["Market & Gap Strategist"])


@router.get(
    "/roles",
    response_model=list[JobRoleBenchmark],
    status_code=status.HTTP_200_OK,
    summary="List curated target job roles and their weighted benchmark skills",
)
async def get_available_roles() -> list[JobRoleBenchmark]:
    return list_role_benchmarks()


@router.post(
    "/analyze-gaps",
    response_model=MarketAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Run Supervisor -> Market Strategist to compute role readiness and skill gaps",
)
async def analyze_gaps(payload: MarketAnalysisRequest) -> MarketAnalysisResponse:
    try:
        final_state = await run_orchestrator(
            user_id=payload.user_id,
            requested_action="analyze_gaps",
            target_role=payload.target_role,
            target_role_changed=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Market gap analysis failed: {exc}",
        ) from exc

    return MarketAnalysisResponse(
        user_id=final_state["user_id"],
        target_role=final_state["target_role"],
        readiness_score=final_state["readiness_score"],
        matched_verified_skills=final_state.get("matched_verified_skills", []),
        skill_gaps=[SkillGapItem(**g) for g in final_state.get("skill_gaps", [])],
        role_summary=final_state.get("role_summary", ""),
        agent_logs=final_state.get("agent_logs", []),
    )


@router.post(
    "/switch-role",
    response_model=MarketAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Switch target job role and dynamically recalculate readiness and gaps via Supervisor",
)
async def switch_target_role(payload: RoleSwitchRequest) -> MarketAnalysisResponse:
    try:
        final_state = await run_orchestrator(
            user_id=payload.user_id,
            requested_action="switch_role",
            target_role=payload.new_target_role,
            target_role_changed=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Role switch orchestration failed: {exc}",
        ) from exc

    return MarketAnalysisResponse(
        user_id=final_state["user_id"],
        target_role=final_state["target_role"],
        readiness_score=final_state["readiness_score"],
        matched_verified_skills=final_state.get("matched_verified_skills", []),
        skill_gaps=[SkillGapItem(**g) for g in final_state.get("skill_gaps", [])],
        role_summary=final_state.get("role_summary", ""),
        agent_logs=final_state.get("agent_logs", []),
    )
