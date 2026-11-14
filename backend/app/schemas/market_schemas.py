from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class RoleSkillRequirement(BaseModel):
    """Single benchmark skill requirement for a target career role."""

    skill_name: str = Field(..., description="Standardized technical skill name.")
    category: Literal["Core", "Framework", "Backend", "Tooling", "Architecture"] = Field(
        ...,
        description="Competency domain category.",
    )
    importance_weight: float = Field(
        ...,
        ge=1.0,
        le=3.0,
        description="Relative weight in readiness calculation (1.0 to 3.0).",
    )
    required_proficiency: Literal["Beginner", "Intermediate", "Advanced"] = Field(
        default="Intermediate",
        description="Minimum target proficiency level for role readiness.",
    )


class JobRoleBenchmark(BaseModel):
    """Complete competency benchmark for a target job role."""

    role_title: str = Field(..., description="Target job title.")
    description: str = Field(..., description="Concise summary of role responsibilities.")
    required_skills: list[RoleSkillRequirement] = Field(
        ...,
        min_length=1,
        description="Weighted skills required for job readiness.",
    )


class SkillGapItem(BaseModel):
    """Prioritized skill gap identified for a candidate against a target role."""

    skill_name: str
    category: str
    priority: Literal["Critical", "High", "Moderate"]
    importance_weight: float
    reason: str
    current_status: Literal["Missing", "Unverified", "Below Threshold"]


class MarketAnalysisRequest(BaseModel):
    """Request payload for running Market & Gap Strategist analysis."""

    user_id: str = Field(..., description="Candidate UUID.")
    target_role: Optional[str] = Field(
        default=None,
        description="Optional target role override; defaults to candidate's stored target role.",
    )


class MarketAnalysisResponse(BaseModel):
    """Response payload summarizing readiness score, matched strengths, and prioritized gaps."""

    user_id: str
    target_role: str
    readiness_score: float = Field(..., ge=0.0, le=100.0)
    matched_verified_skills: list[str]
    skill_gaps: list[SkillGapItem]
    role_summary: str
    agent_logs: list[dict[str, Any]] = Field(default_factory=list)


class RoleSwitchRequest(BaseModel):
    """Request payload to pivot a candidate's target career role."""

    user_id: str = Field(..., description="Candidate UUID.")
    new_target_role: str = Field(..., min_length=2, description="New target career role title.")
