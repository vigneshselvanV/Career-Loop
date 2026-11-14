from fastapi import APIRouter, HTTPException, status

from app.agents.mentor_agent import MentorAssessmentAgent
from app.agents.orchestrator import run_orchestrator
from app.agents.profiler_agent import get_stored_profile
from app.schemas.curriculum_schemas import RoadmapDAG
from app.schemas.mentor_schemas import (
    AssessmentEvaluationResponse,
    GenerateQuizRequest,
    MentorChatRequest,
    MentorChatResponse,
    SimulateFailRequest,
    SubmitQuizRequest,
    TopicQuiz,
)

router = APIRouter(prefix="/api/mentor", tags=["AI Mentor & Assessments"])


@router.post(
    "/quiz/generate",
    response_model=TopicQuiz,
    status_code=status.HTTP_200_OK,
    summary="Generate a topic-specific quiz via Groq llama-3.1-8b-instant",
)
async def generate_quiz(payload: GenerateQuizRequest) -> TopicQuiz:
    profile = get_stored_profile(payload.user_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile '{payload.user_id}' not found.",
        )

    mentor = MentorAssessmentAgent()
    return await mentor.generate_topic_quiz(
        user_id=payload.user_id,
        topic=payload.topic,
        target_role=profile.target_role,
        num_questions=payload.num_questions,
    )


@router.post(
    "/quiz/submit",
    response_model=AssessmentEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Grade topic quiz and trigger Supervisor adaptive DAG re-routing if score < 60%",
)
async def submit_quiz(payload: SubmitQuizRequest) -> AssessmentEvaluationResponse:
    try:
        final_state = await run_orchestrator(
            user_id=payload.user_id,
            requested_action="evaluate_quiz",
            assessment_payload={
                "mode": "quiz_submission",
                "topic": payload.topic,
                "quiz": payload.quiz.model_dump(),
                "user_answers": payload.user_answers,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    last_assess = final_state.get("last_assessment") or {}
    dag_dict = final_state.get("roadmap_dag")

    return AssessmentEvaluationResponse(
        user_id=payload.user_id,
        topic=last_assess.get("topic", payload.topic),
        score_percent=float(last_assess.get("score_percent", 0.0)),
        passed=bool(last_assess.get("passed", False)),
        needs_reroute=bool(last_assess.get("triggered_reroute", not last_assess.get("passed", False))),
        feedback=last_assess.get("feedback", []),
        mentor_advice=last_assess.get("mentor_advice", ""),
        updated_roadmap=RoadmapDAG(**dag_dict) if dag_dict else None,
        readiness_score=float(final_state.get("readiness_score", 64.0)),
        agent_logs=final_state.get("agent_logs", []),
    )


@router.post(
    "/quiz/simulate-fail",
    response_model=AssessmentEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="1-Click Demo Trigger: simulate 40% JS quiz score to trigger adaptive DAG remediation",
)
async def simulate_quiz_fail(payload: SimulateFailRequest) -> AssessmentEvaluationResponse:
    try:
        final_state = await run_orchestrator(
            user_id=payload.user_id,
            requested_action="evaluate_quiz",
            assessment_payload={
                "mode": "simulate",
                "topic": payload.topic,
                "score_percent": payload.score_percent,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    last_assess = final_state.get("last_assessment") or {}
    dag_dict = final_state.get("roadmap_dag")

    return AssessmentEvaluationResponse(
        user_id=payload.user_id,
        topic=last_assess.get("topic", payload.topic),
        score_percent=float(last_assess.get("score_percent", payload.score_percent)),
        passed=bool(last_assess.get("passed", False)),
        needs_reroute=bool(last_assess.get("needs_reroute", True)),
        feedback=last_assess.get("feedback", []),
        mentor_advice=last_assess.get("mentor_advice", ""),
        updated_roadmap=RoadmapDAG(**dag_dict) if dag_dict else None,
        readiness_score=float(final_state.get("readiness_score", 64.0)),
        agent_logs=final_state.get("agent_logs", []),
    )


@router.post(
    "/chat",
    response_model=MentorChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Socratic AI Mentor chat grounded in candidate's verified skills",
)
async def mentor_chat(payload: MentorChatRequest) -> MentorChatResponse:
    mentor = MentorAssessmentAgent()
    return await mentor.socratic_chat(
        user_id=payload.user_id,
        topic=payload.topic,
        message=payload.message,
        history=payload.history,
    )
