from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.profiler_schemas import (
    AgentLogEntry,
    BaselineDiagnosticQuiz,
    ClaimedSkillItem,
)


class OnboardingAnalyzeRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=100)
    target_role: str = Field(..., min_length=2, max_length=80)
    batch_cohort: str = Field(default="Batch 2027", max_length=60)
    experience_level: Literal["Student", "Entry Level", "Mid Level", "Career Switcher"] = "Student"
    background_note: str = Field(default="", max_length=1500)
    selected_skills: list[str] = Field(default_factory=list, max_length=20)


class OnboardingInsightSchema(BaseModel):
    coach_message: str = Field(
        ...,
        description="Warm 2-sentence onboarding response acknowledging the learner's background and target role.",
    )
    follow_up_question: str = Field(
        ...,
        description="One concise clarifying question to uncover deeper project experience.",
    )
    suggested_skills: list[ClaimedSkillItem] = Field(
        default_factory=list,
        description="Normalized technical skills inferred from the user's background note and selections.",
    )
    diagnostic_quiz: BaselineDiagnosticQuiz


class OnboardingAnalyzeResponse(BaseModel):
    coach_message: str
    follow_up_question: str
    suggested_skills: list[ClaimedSkillItem]
    diagnostic_quiz: BaselineDiagnosticQuiz
    agent_logs: list[AgentLogEntry] = Field(default_factory=list)
