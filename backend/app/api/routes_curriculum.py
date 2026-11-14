from fastapi import APIRouter, HTTPException, status

from app.agents.curriculum_agent import get_stored_roadmap
from app.agents.orchestrator import run_orchestrator
from app.schemas.curriculum_schemas import (
    BuildRoadmapRequest,
    RoadmapDAG,
    RoadmapResponse,
)

router = APIRouter(prefix="/api/roadmap", tags=["Curriculum Architect"])


@router.post(
    "/build",
    response_model=RoadmapResponse,
    status_code=status.HTTP_200_OK,
    summary="Build interactive React Flow DAG learning roadmap via Supervisor -> Curriculum Architect",
)
async def build_roadmap(payload: BuildRoadmapRequest) -> RoadmapResponse:
    try:
        final_state = await run_orchestrator(
            user_id=payload.user_id,
            requested_action="build_roadmap",
            target_role=payload.target_role,
            target_role_changed=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Roadmap generation failed: {exc}",
        ) from exc

    dag_dict = final_state.get("roadmap_dag")
    if dag_dict is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Curriculum Architect did not produce a roadmap DAG.",
        )

    return RoadmapResponse(
        user_id=final_state["user_id"],
        target_role=final_state["target_role"],
        readiness_score=final_state["readiness_score"],
        roadmap=RoadmapDAG(**dag_dict),
        agent_logs=final_state.get("agent_logs", []),
    )


@router.get(
    "/{user_id}",
    response_model=RoadmapDAG,
    status_code=status.HTTP_200_OK,
    summary="Retrieve stored React Flow DAG roadmap for a candidate",
)
async def fetch_roadmap(user_id: str) -> RoadmapDAG:
    dag = get_stored_roadmap(user_id)
    if dag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No roadmap found for user '{user_id}'.",
        )
    return dag
