from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.agents.profiler_agent import (
    IN_MEMORY_STORE,
    _persist_logs,
    _persist_profile_and_skills,
)
from app.core.config import get_groq_llm
from app.schemas.market_schemas import (
    JobRoleBenchmark,
    MarketAnalysisResponse,
    RoleSkillRequirement,
    SkillGapItem,
)
from app.schemas.profiler_schemas import AgentLogEntry, VerifiedSkillResult
from app.services.role_benchmarks import get_role_benchmark

SKILL_ALIASES: dict[str, set[str]] = {
    "javascript es6+ & async": {
        "javascript",
        "js",
        "es6",
        "javascript es6+",
        "javascript es6+ & async",
        "ecmascript",
    },
    "html & css": {"html", "css", "html/css", "html & css", "html5", "css3"},
    "python": {"python", "python3"},
    "sql": {"sql", "postgresql", "mysql", "sqlite"},
    "react 19": {"react", "reactjs", "react.js", "react 19"},
    "node.js & express": {"node", "nodejs", "node.js", "express", "node.js & express"},
}


class GapReasonItem(BaseModel):
    skill_name: str
    reason: str


class GapNarrativeEnrichment(BaseModel):
    role_summary: str = Field(..., description="Two-sentence summary of role fit and strength transfer.")
    gap_reasons: list[GapReasonItem] = Field(
        default_factory=list,
        description="Personalized 1-sentence reason explaining why each missing/unverified skill matters.",
    )


def _canonical_tokens(skill_name: str) -> set[str]:
    lowered = skill_name.strip().lower()
    tokens = {lowered}
    for canonical, aliases in SKILL_ALIASES.items():
        if lowered == canonical or lowered in aliases:
            tokens.add(canonical)
            tokens.update(aliases)
    return tokens


def _skills_match(candidate_skill: str, benchmark_skill: str) -> bool:
    cand_tokens = _canonical_tokens(candidate_skill)
    bench_tokens = _canonical_tokens(benchmark_skill)
    if cand_tokens & bench_tokens:
        return True
    c_low = candidate_skill.strip().lower()
    b_low = benchmark_skill.strip().lower()
    return (len(c_low) >= 3 and c_low in b_low) or (len(b_low) >= 3 and b_low in c_low)


def _compute_priority(req: RoleSkillRequirement, current_status: str) -> str:
    if current_status == "Unverified":
        return "High" if req.importance_weight >= 1.5 else "Moderate"
    if req.importance_weight >= 1.5:
        return "Critical"
    if req.importance_weight >= 1.0:
        return "High"
    return "Moderate"


class MarketStrategistAgent:
    """Sub-Agent 2: Compares verified skills against role benchmarks and prioritizes skill gaps."""

    async def _generate_narrative(
        self,
        target_role: str,
        readiness_score: float,
        matched_verified: list[str],
        raw_gaps: list[SkillGapItem],
        benchmark: JobRoleBenchmark,
    ) -> tuple[str, dict[str, str]]:
        gap_names = [g.skill_name for g in raw_gaps]
        try:
            llm = get_groq_llm(fast=False, temperature=0.2, max_tokens=1024)
            enricher = llm.with_structured_output(GapNarrativeEnrichment)
            result: GapNarrativeEnrichment = await enricher.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "You are CareerLoop's Market & Gap Strategist. Write crisp, encouraging, "
                            "evidence-based career guidance in plain English. Keep each gap reason to "
                            "one actionable sentence connecting the skill to the target role."
                        )
                    ),
                    HumanMessage(
                        content=(
                            f"Target Role: {target_role} ({benchmark.description})\n"
                            f"Readiness Score: {readiness_score:.1f}%\n"
                            f"Verified Strengths: {', '.join(matched_verified) or 'None yet'}\n"
                            f"Identified Gaps: {', '.join(gap_names) or 'None'}"
                        )
                    ),
                ]
            )
            reason_map = {item.skill_name.lower(): item.reason for item in result.gap_reasons}
            return result.role_summary, reason_map
        except Exception:
            strengths_text = ", ".join(matched_verified) if matched_verified else "foundational engineering"
            if gap_names:
                fallback_summary = (
                    f"Your verified background in {strengths_text} establishes a {readiness_score:.0f}% "
                    f"baseline for {target_role}. Closing {len(gap_names)} targeted gaps "
                    f"({', '.join(gap_names)}) will unlock full role readiness."
                )
            else:
                fallback_summary = (
                    f"Your verified skills cover 100% of the core {target_role} benchmark requirements."
                )
            fallback_reasons = {
                g.skill_name.lower(): (
                    f"{g.skill_name} is a {g.priority.lower()}-priority {g.category.lower()} competency "
                    f"required for production {target_role} workflows."
                )
                for g in raw_gaps
            }
            return fallback_summary, fallback_reasons

    async def analyze_role_and_gaps(
        self,
        user_id: str,
        target_role: str,
        verified_skills: list[dict[str, Any]],
        unverified_skills: list[dict[str, Any]],
    ) -> MarketAnalysisResponse:
        benchmark = await get_role_benchmark(target_role)
        resolved_role = benchmark.role_title

        total_weight = sum(req.importance_weight for req in benchmark.required_skills)
        earned_weight = 0.0
        matched_verified_skills: list[str] = []
        raw_gaps: list[SkillGapItem] = []

        for req in benchmark.required_skills:
            verified_match = next(
                (s for s in verified_skills if _skills_match(str(s.get("skill_name", "")), req.skill_name)),
                None,
            )
            if verified_match is not None:
                earned_weight += req.importance_weight
                matched_verified_skills.append(req.skill_name)
                continue

            unverified_match = next(
                (s for s in unverified_skills if _skills_match(str(s.get("skill_name", "")), req.skill_name)),
                None,
            )
            if (
                unverified_match is not None
                and float(unverified_match.get("verification_score", 0.0)) > 0.0
                and str(unverified_match.get("proficiency_level", "")).lower() != "missing"
            ):
                earned_weight += 0.25 * req.importance_weight
                status = "Unverified"
                default_reason = (
                    f"{req.skill_name} is listed on your profile but requires verification for {resolved_role}."
                )
            else:
                status = "Missing"
                default_reason = (
                    f"{req.skill_name} is a core {req.category.lower()} requirement not yet verified for {resolved_role}."
                )

            priority = _compute_priority(req, status)
            raw_gaps.append(
                SkillGapItem(
                    skill_name=req.skill_name,
                    category=req.category,
                    priority=priority,  # type: ignore[arg-type]
                    importance_weight=req.importance_weight,
                    reason=default_reason,
                    current_status=status,  # type: ignore[arg-type]
                )
            )

        # Sort gaps by priority rank then descending importance_weight
        priority_rank = {"Critical": 0, "High": 1, "Moderate": 2}
        raw_gaps.sort(key=lambda g: (priority_rank[g.priority], -g.importance_weight))

        readiness_score = round(min(max((earned_weight / max(total_weight, 1e-6)) * 100.0, 0.0), 100.0), 2)

        role_summary, reason_map = await self._generate_narrative(
            target_role=resolved_role,
            readiness_score=readiness_score,
            matched_verified=matched_verified_skills,
            raw_gaps=raw_gaps,
            benchmark=benchmark,
        )

        enriched_gaps = [
            gap.model_copy(update={"reason": reason_map.get(gap.skill_name.lower(), gap.reason)})
            for gap in raw_gaps
        ]

        gap_names_preview = ", ".join(g.skill_name for g in enriched_gaps[:4])
        if len(enriched_gaps) > 4:
            gap_names_preview += f", +{len(enriched_gaps) - 4} more"

        summary_msg = (
            f"Calculated {readiness_score:.0f}% readiness for {resolved_role}; "
            f"identified {len(enriched_gaps)} priority gaps"
            + (f" ({gap_names_preview})" if gap_names_preview else "")
        )
        new_log = AgentLogEntry(agent_name="Market Strategist", action_summary=summary_msg)

        # Persist updated profile, skills, and gap metadata back to in-memory store & Supabase
        stored_profile = IN_MEMORY_STORE["profiles"].get(user_id, {})
        full_name = stored_profile.get("full_name", "Candidate")
        batch_cohort = stored_profile.get("batch_cohort", "Batch 2027")
        raw_resume_json = stored_profile.get("raw_resume_json", {})

        updated_skills: list[VerifiedSkillResult] = []
        for s in verified_skills:
            updated_skills.append(
                VerifiedSkillResult(
                    skill_name=s["skill_name"],
                    proficiency_level=s.get("proficiency_level", "Verified"),
                    is_verified=True,
                    verification_score=float(s.get("verification_score", 90.0)),
                    category=s.get("category", "Core"),
                    status="verified",
                )
            )
        for g in enriched_gaps:
            updated_skills.append(
                VerifiedSkillResult(
                    skill_name=g.skill_name,
                    proficiency_level="Missing" if g.current_status == "Missing" else "Unverified",
                    is_verified=False,
                    verification_score=0.0 if g.current_status == "Missing" else 25.0,
                    category=g.category,
                    status="gap" if g.current_status == "Missing" else "unverified",
                )
            )

        _persist_profile_and_skills(
            user_id=user_id,
            full_name=full_name,
            batch_cohort=batch_cohort,
            target_role=resolved_role,
            readiness_score=readiness_score,
            raw_resume_json=raw_resume_json,
            skills=updated_skills,
        )
        _persist_logs(user_id, [new_log])

        all_logs = IN_MEMORY_STORE["agent_logs"].get(user_id, [])

        return MarketAnalysisResponse(
            user_id=user_id,
            target_role=resolved_role,
            readiness_score=readiness_score,
            matched_verified_skills=matched_verified_skills,
            skill_gaps=enriched_gaps,
            role_summary=role_summary,
            agent_logs=all_logs,
        )
