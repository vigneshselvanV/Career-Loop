from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schemas.curriculum_schemas import RoadmapDAG


class TopicQuizQuestion(BaseModel):
    id: str
    topic: str
    question: str
    options: list[str] = Field(..., min_length=4, max_length=4)
    correct_index: int = Field(..., ge=0, le=3)
    explanation: str


class TopicQuiz(BaseModel):
    topic: str
    target_role: str
    questions: list[TopicQuizQuestion] = Field(..., min_length=3, max_length=5)


class GenerateQuizRequest(BaseModel):
    user_id: str
    topic: str
    num_questions: int = Field(default=5, ge=3, le=5)


class SubmitQuizRequest(BaseModel):
    user_id: str
    topic: str
    quiz: TopicQuiz
    user_answers: list[int]


class SimulateFailRequest(BaseModel):
    user_id: str
    topic: str = "JavaScript ES6+ & Async"
    score_percent: float = Field(default=40.0, ge=0.0, le=100.0)


class AssessmentEvaluationResponse(BaseModel):
    user_id: str
    topic: str
    score_percent: float
    passed: bool
    needs_reroute: bool
    feedback: list[dict[str, Any]]
    mentor_advice: str
    updated_roadmap: Optional[RoadmapDAG] = None
    readiness_score: float
    agent_logs: list[dict[str, Any]] = Field(default_factory=list)


class MentorChatRequest(BaseModel):
    user_id: str
    topic: str
    message: str
    history: list[dict[str, str]] = Field(default_factory=list)


class MentorChatResponse(BaseModel):
    reply: str
    socratic_hint: str
    suggested_followups: list[str]
    agent_logs: list[dict[str, Any]] = Field(default_factory=list)
