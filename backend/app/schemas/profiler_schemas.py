from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field


class EducationItem(BaseModel):
    institution: str = Field(..., description="University, college, or school name.")
    degree: str = Field(..., description="Degree or program pursued.")
    graduation_year: Optional[str] = Field(default=None, description="Expected or actual graduation year.")


class ExperienceItem(BaseModel):
    company: str = Field(..., description="Organization or lab name.")
    role: str = Field(..., description="Job title or position held.")
    duration: Optional[str] = Field(default=None, description="Employment timeframe.")
    highlights: list[str] = Field(default_factory=list, description="Key responsibilities or measurable achievements.")


class ProjectItem(BaseModel):
    name: str = Field(..., description="Project title.")
    description: str = Field(..., description="Brief summary of what was built and its impact.")
    technologies: list[str] = Field(default_factory=list, description="Tools, frameworks, or languages used.")


class ClaimedSkillItem(BaseModel):
    skill_name: str = Field(..., description="Normalized technical or domain skill name (e.g., Python, SQL, React).")
    self_reported_confidence: Literal["Beginner", "Intermediate", "Advanced"] = Field(
        default="Intermediate",
        description="Inferred confidence based on project/work depth.",
    )
    category: str = Field(
        default="General Engineering",
        description="Skill domain such as Backend & Scripting, Databases, Frontend Engineering, Cloud & DevOps.",
    )


class ExtractedProfileSchema(BaseModel):
    """Structured career identity extracted from a LinkedIn or resume PDF."""

    full_name: str = Field(..., description="Candidate full name.")
    headline: str = Field(..., description="Concise professional or academic headline.")
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    claimed_skills: list[ClaimedSkillItem] = Field(
        default_factory=list,
        description="Technical skills claimed on the resume/LinkedIn profile.",
    )
    suggested_target_role: str = Field(
        ...,
        description="Best-aligned career role based on trajectory (e.g., Full Stack Developer).",
    )


class DiagnosticQuestion(BaseModel):
    """Single multiple-choice question in the 60-second baseline diagnostic."""

    id: str = Field(..., description="Unique identifier such as q1, q2, q3.")
    skill_tested: str = Field(..., description="Exact skill name being verified.")
    question: str = Field(..., description="Crisp conceptual or practical verification question answerable in 20 seconds.")
    options: list[str] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Exactly 4 concise multiple-choice answer options.",
    )
    correct_index: int = Field(..., ge=0, le=3, description="Zero-based index of the correct option (0-3).")
    explanation: str = Field(..., description="One-sentence explanation of why the correct option is right.")


class BaselineDiagnosticQuiz(BaseModel):
    """Rapid 3-question baseline quiz designed for 60-second skill verification."""

    target_role: str = Field(..., description="Target career role context.")
    estimated_seconds: int = Field(default=60, description="Target completion time in seconds.")
    questions: list[DiagnosticQuestion] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactly 3 multiple-choice verification questions covering top claimed skills.",
    )


class AgentLogEntry(BaseModel):
    agent_name: str
    action_summary: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProfileUploadResponse(BaseModel):
    user_id: str
    target_role: str
    extraction_method: Literal["pymupdf", "openrouter_vision"]
    extracted_profile: ExtractedProfileSchema
    diagnostic_quiz: BaselineDiagnosticQuiz
    agent_logs: list[AgentLogEntry]


class DiagnosticSubmissionRequest(BaseModel):
    user_id: str = Field(..., description="Candidate UUID returned from /api/profile/upload.")
    target_role: Optional[str] = Field(default=None, description="Optional override for target career role.")
    quiz: BaselineDiagnosticQuiz
    user_answers: list[int] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="List of 3 chosen option indices (0-3) corresponding to quiz.questions.",
    )
    extracted_profile: Optional[ExtractedProfileSchema] = Field(
        default=None,
        description="Optional extracted profile payload if continuing statelessly.",
    )


class VerifiedSkillResult(BaseModel):
    skill_name: str
    proficiency_level: str
    is_verified: bool
    verification_score: float
    category: str
    status: Literal["verified", "gap", "unverified"]


class QuestionFeedbackItem(BaseModel):
    question_id: str
    skill_tested: str
    selected_index: int
    correct_index: int
    is_correct: bool
    explanation: str


class VerifiedProfileResponse(BaseModel):
    user_id: str
    full_name: str
    batch_cohort: str
    target_role: str
    readiness_score: float
    quiz_score_percent: float
    verified_skills: list[VerifiedSkillResult]
    skill_gaps: list[VerifiedSkillResult]
    question_feedback: list[QuestionFeedbackItem] = Field(default_factory=list)
    extracted_profile: Optional[ExtractedProfileSchema] = None
    agent_logs: list[AgentLogEntry] = Field(default_factory=list)
    storage_mode: Literal["supabase", "in_memory"] = "in_memory"
