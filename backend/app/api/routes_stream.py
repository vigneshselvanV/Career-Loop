import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agents.orchestrator import stream_orchestrator

router = APIRouter(prefix="/api/agent", tags=["Live Agent Streaming"])


class StreamRequest(BaseModel):
    user_id: str
    requested_action: str = "build_roadmap"
    target_role: Optional[str] = None
    target_role_changed: bool = False
    topic: Optional[str] = None
    score_percent: Optional[float] = None


async def _sse_generator(
    user_id: str,
    requested_action: str,
    target_role: Optional[str],
    target_role_changed: bool,
    topic: Optional[str],
    score_percent: Optional[float],
):
    assessment_payload = None
    if requested_action == "evaluate_quiz":
        assessment_payload = {
            "mode": "simulate",
            "topic": topic or "JavaScript ES6+ & Async",
            "score_percent": score_percent if score_percent is not None else 40.0,
        }

    async for event in stream_orchestrator(
        user_id=user_id,
        requested_action=requested_action,
        target_role=target_role,
        target_role_changed=target_role_changed,
        assessment_payload=assessment_payload,
    ):
        yield {
            "event": event["event"],
            "data": json.dumps(event["data"]),
        }


@router.get("/stream", summary="Stream live LangGraph agent handoffs via SSE (EventSource)")
async def stream_agent_get(
    user_id: str = Query(...),
    requested_action: str = Query("build_roadmap"),
    target_role: Optional[str] = Query(None),
    target_role_changed: bool = Query(False),
    topic: Optional[str] = Query(None),
    score_percent: Optional[float] = Query(None),
):
    try:
        return EventSourceResponse(
            _sse_generator(
                user_id=user_id,
                requested_action=requested_action,
                target_role=target_role,
                target_role_changed=target_role_changed,
                topic=topic,
                score_percent=score_percent,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/stream", summary="Stream live LangGraph agent handoffs via SSE (POST)")
async def stream_agent_post(payload: StreamRequest):
    try:
        return EventSourceResponse(
            _sse_generator(
                user_id=payload.user_id,
                requested_action=payload.requested_action,
                target_role=payload.target_role,
                target_role_changed=payload.target_role_changed,
                topic=payload.topic,
                score_percent=payload.score_percent,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
