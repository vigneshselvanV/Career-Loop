import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_groq_llm, get_openrouter_llm, get_supabase_client
from app.schemas.profiler_schemas import (
    AgentLogEntry,
    BaselineDiagnosticQuiz,
    ExtractedProfileSchema,
    ProfileUploadResponse,
    QuestionFeedbackItem,
    VerifiedProfileResponse,
    VerifiedSkillResult,
)
from app.services.pdf_service import extract_text_from_pdf

DEMO_USER_ID = "11111111-1111-4111-8111-111111111111"

# Role benchmark expectations for initial gap detection prior to Phase 2 Strategist expansion
ROLE_CORE_SKILLS: dict[str, list[tuple[str, str]]] = {
    "Full Stack Developer": [
        ("Python", "Backend & Scripting"),
        ("SQL", "Databases"),
        ("HTML & CSS", "Frontend Foundations"),
        ("JavaScript", "Frontend Engineering"),
        ("React", "Frontend Engineering"),
        ("Node.js", "Backend Engineering"),
    ],
    "Data Scientist": [
        ("Python", "Backend & Scripting"),
        ("SQL", "Databases"),
        ("Statistics", "Data Science"),
        ("Machine Learning", "AI & Modeling"),
        ("Pandas", "Data Engineering"),
    ],
    "AI Engineer": [
        ("Python", "Backend & Scripting"),
        ("SQL", "Databases"),
        ("FastAPI", "Backend Engineering"),
        ("LangGraph", "Agentic AI"),
        ("Vector Databases", "Retrieval & RAG"),
    ],
}

# In-memory fallback store so local development and hackathon testing work without Supabase credentials
IN_MEMORY_STORE: dict[str, dict[str, Any]] = {
    "profiles": {},
    "user_skills": {},
    "assessments": {},
    "agent_logs": {},
    "pending_extractions": {},
    "roadmaps": {},
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _persist_logs(user_id: str, logs: list[AgentLogEntry]) -> Literal["supabase", "in_memory"]:
    existing = IN_MEMORY_STORE["agent_logs"].setdefault(user_id, [])
    existing.extend([log.model_dump() for log in logs])

    supabase = get_supabase_client()
    if supabase is None:
        return "in_memory"

    try:
        rows = [
            {
                "user_id": user_id,
                "agent_name": log.agent_name,
                "action_summary": log.action_summary,
                "created_at": log.timestamp,
            }
            for log in logs
        ]
        if rows:
            supabase.table("agent_logs").insert(rows).execute()
        return "supabase"
    except Exception:
        return "in_memory"


def _persist_profile_and_skills(
    user_id: str,
    full_name: str,
    batch_cohort: str,
    target_role: str,
    readiness_score: float,
    raw_resume_json: dict[str, Any],
    skills: list[VerifiedSkillResult],
    assessment_record: Optional[dict[str, Any]] = None,
) -> Literal["supabase", "in_memory"]:
    profile_record = {
        "id": user_id,
        "full_name": full_name,
        "batch_cohort": batch_cohort,
        "target_role": target_role,
        "readiness_score": readiness_score,
        "raw_resume_json": raw_resume_json,
        "created_at": _now_iso(),
    }
    IN_MEMORY_STORE["profiles"][user_id] = profile_record
    IN_MEMORY_STORE["user_skills"][user_id] = [skill.model_dump() for skill in skills]

    if assessment_record is not None:
        IN_MEMORY_STORE["assessments"].setdefault(user_id, []).append(assessment_record)

    supabase = get_supabase_client()
    if supabase is None:
        return "in_memory"

    try:
        supabase.table("profiles").upsert(
            {
                "id": user_id,
                "full_name": full_name,
                "batch_cohort": batch_cohort,
                "target_role": target_role,
                "readiness_score": readiness_score,
                "raw_resume_json": raw_resume_json,
            },
            on_conflict="id",
        ).execute()

        skill_rows = [
            {
                "user_id": user_id,
                "skill_name": skill.skill_name,
                "proficiency_level": skill.proficiency_level,
                "is_verified": skill.is_verified,
                "verification_score": skill.verification_score,
                "category": skill.category,
            }
            for skill in skills
        ]
        if skill_rows:
            supabase.table("user_skills").upsert(
                skill_rows,
                on_conflict="user_id,skill_name",
            ).execute()

        if assessment_record is not None:
            supabase.table("assessments").insert(assessment_record).execute()

        return "supabase"
    except Exception:
        return "in_memory"


async def extract_and_generate_diagnostic(
    pdf_bytes: bytes,
    target_role: str,
    user_id: Optional[str] = None,
) -> ProfileUploadResponse:
    """
    Sub-Agent 1 (Profiler & Verification Agent) Step 1:
    1. Extract clean resume text via PyMuPDF (with OpenRouter Gemini 2.5 Flash vision fallback).
    2. Extract structured career identity via OpenRouter google/gemini-2.5-flash.
    3. Generate a 60-second 3-question baseline diagnostic quiz via Groq llama-3.3-70b-versatile.
    """
    resolved_user_id = user_id or str(uuid.uuid4())
    logs: list[AgentLogEntry] = []

    raw_text, extraction_method = await extract_text_from_pdf(pdf_bytes)
    if extraction_method == "openrouter_vision":
        logs.append(
            AgentLogEntry(
                agent_name="Profiler Agent",
                action_summary="Detected image-based PDF and transcribed career document with vision fallback",
            )
        )

    # Structured resume/LinkedIn extraction using OpenRouter google/gemini-2.5-flash (with deterministic fallback)
    try:
        openrouter_llm = get_openrouter_llm(temperature=0.0, max_tokens=4096)
        extractor = openrouter_llm.with_structured_output(ExtractedProfileSchema)

        extracted_profile: ExtractedProfileSchema = await extractor.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are the CareerLoop Profiler & Verification Agent. Parse the provided resume or LinkedIn "
                        "PDF text into a clean, accurate structured profile. Normalize skill names cleanly (e.g., "
                        "'Python', 'SQL', 'HTML & CSS', 'JavaScript ES6+ & Async', 'React 19', 'Node.js & Express'). Never fabricate experience."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Target role requested by candidate: {target_role}\n\n"
                        f"Document Text:\n{raw_text[:18000]}"
                    )
                ),
            ]
        )
    except Exception:
        first_line = next((line.strip() for line in raw_text.splitlines() if len(line.strip()) > 2), "Candidate Profile")
        known_keywords = [
            ("Python", "Backend & Scripting"),
            ("SQL", "Databases"),
            ("HTML & CSS", "Frontend Foundations"),
            ("JavaScript", "Frontend Engineering"),
            ("React", "Frontend Engineering"),
            ("Node.js", "Backend Engineering"),
            ("TypeScript", "Frontend Engineering"),
            ("Docker", "Tooling"),
        ]
        lower_text = raw_text.lower()
        detected_skills = [
            {"skill_name": name, "self_reported_confidence": "Intermediate", "category": cat}
            for name, cat in known_keywords
            if name.lower().split()[0] in lower_text
        ]
        if not detected_skills:
            detected_skills = [
                {"skill_name": "Python", "self_reported_confidence": "Intermediate", "category": "Backend & Scripting"},
                {"skill_name": "SQL", "self_reported_confidence": "Intermediate", "category": "Databases"},
                {"skill_name": "HTML & CSS", "self_reported_confidence": "Intermediate", "category": "Frontend Foundations"},
            ]
        extracted_profile = ExtractedProfileSchema(
            full_name=first_line[:60],
            headline=f"Candidate targeting {target_role}",
            education=[],
            experience=[],
            projects=[],
            certifications=[],
            claimed_skills=detected_skills,  # type: ignore[arg-type]
            suggested_target_role=target_role,
        )

    claimed_skill_names = [s.skill_name for s in extracted_profile.claimed_skills]
    logs.append(
        AgentLogEntry(
            agent_name="Profiler Agent",
            action_summary=(
                f"Extracted {len(claimed_skill_names)} skills and {len(extracted_profile.projects)} projects "
                f"for {extracted_profile.full_name}"
            ),
        )
    )

    # Generate 60-second 3-question diagnostic quiz via Groq llama-3.3-70b-versatile (with deterministic fallback)
    skills_to_test = claimed_skill_names[:3] if claimed_skill_names else ["Python", "SQL", "HTML & CSS"]
    while len(skills_to_test) < 3:
        skills_to_test.append(["Python", "SQL", "HTML & CSS"][len(skills_to_test)])

    try:
        groq_llm = get_groq_llm(fast=False, temperature=0.2, max_tokens=2048)
        quiz_generator = groq_llm.with_structured_output(BaselineDiagnosticQuiz)

        diagnostic_quiz: BaselineDiagnosticQuiz = await quiz_generator.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are a fast technical skill verifier. Generate exactly 3 concise multiple-choice "
                        "questions designed to be completed in 60 seconds total (20 seconds each). "
                        "Each question must test practical understanding of one of the candidate's claimed skills, "
                        "have exactly 4 short options, a valid correct_index (0-3), and a 1-sentence explanation."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Candidate: {extracted_profile.full_name}\n"
                        f"Target Role: {target_role}\n"
                        f"Claimed Skills to Verify: {', '.join(skills_to_test)}\n"
                        "Return a BaselineDiagnosticQuiz with ids q1, q2, q3."
                    )
                ),
            ]
        )
    except Exception:
        from app.schemas.profiler_schemas import DiagnosticQuestion

        fallback_bank = {
            "python": (
                "Which Python structure provides O(1) average lookup time for membership checks?",
                ["list", "set", "tuple", "deque"],
                1,
                "A set uses hash tables internally, providing O(1) average-case membership lookup.",
            ),
            "sql": (
                "Which SQL clause filters aggregated groups created by GROUP BY?",
                ["WHERE", "HAVING", "ORDER BY", "DISTINCT"],
                1,
                "HAVING filters grouped rows after aggregation, whereas WHERE filters individual rows prior to grouping.",
            ),
            "html & css": (
                "Which CSS property distributes flex items along the main axis?",
                ["align-items", "justify-content", "flex-wrap", "grid-template"],
                1,
                "justify-content aligns and distributes flex items along the container's main axis.",
            ),
        }
        questions = []
        for idx, sk in enumerate(skills_to_test[:3], start=1):
            key = sk.lower()
            if key in fallback_bank:
                q_text, opts, c_idx, exp = fallback_bank[key]
            else:
                q_text = f"In production {sk} workflows, what best supports maintainability and reliability?"
                opts = [
                    "Clear modular boundaries and automated tests",
                    "Duplicating logic across global files",
                    "Ignoring input validation and error handling",
                    "Hardcoding environment secrets in source code",
                ]
                c_idx = 0
                exp = f"Modular boundaries and automated tests are foundational engineering practices in {sk}."
            questions.append(
                DiagnosticQuestion(
                    id=f"q{idx}",
                    skill_tested=sk,
                    question=q_text,
                    options=opts,
                    correct_index=c_idx,
                    explanation=exp,
                )
            )
        diagnostic_quiz = BaselineDiagnosticQuiz(
            target_role=target_role,
            estimated_seconds=60,
            questions=questions,
        )

    logs.append(
        AgentLogEntry(
            agent_name="Profiler Agent",
            action_summary=(
                f"Generated 60-second baseline diagnostic testing {', '.join(q.skill_tested for q in diagnostic_quiz.questions)}"
            ),
        )
    )

    # Cache extracted profile & logs so verify-diagnostic can enrich and persist seamlessly
    IN_MEMORY_STORE["pending_extractions"][resolved_user_id] = {
        "target_role": target_role,
        "extracted_profile": extracted_profile.model_dump(),
    }
    _persist_logs(resolved_user_id, logs)

    return ProfileUploadResponse(
        user_id=resolved_user_id,
        target_role=target_role,
        extraction_method=extraction_method,
        extracted_profile=extracted_profile,
        diagnostic_quiz=diagnostic_quiz,
        agent_logs=logs,
    )


async def verify_baseline_skills(
    user_id: str,
    quiz: BaselineDiagnosticQuiz,
    user_answers: list[int],
    target_role: Optional[str] = None,
    extracted_profile: Optional[ExtractedProfileSchema] = None,
) -> VerifiedProfileResponse:
    """
    Sub-Agent 1 (Profiler & Verification Agent) Step 2:
    Deterministically grades the 3 baseline diagnostic answers, marks passed skills as
    verified, flags failed or missing target-role skills as gaps, and persists to Supabase
    (with in-memory fallback).
    """
    pending = IN_MEMORY_STORE["pending_extractions"].get(user_id, {})
    resolved_profile: Optional[ExtractedProfileSchema] = extracted_profile
    if resolved_profile is None and pending.get("extracted_profile"):
        resolved_profile = ExtractedProfileSchema(**pending["extracted_profile"])

    resolved_target_role = (
        target_role
        or pending.get("target_role")
        or quiz.target_role
        or (resolved_profile.suggested_target_role if resolved_profile else "Full Stack Developer")
    )
    full_name = resolved_profile.full_name if resolved_profile else "Candidate"
    batch_cohort = "Batch 2027"

    # Build lookup for claimed skill categories
    claimed_categories: dict[str, str] = {}
    if resolved_profile:
        for item in resolved_profile.claimed_skills:
            claimed_categories[item.skill_name.lower()] = item.category

    question_feedback: list[QuestionFeedbackItem] = []
    skill_results_map: dict[str, VerifiedSkillResult] = {}
    correct_count = 0

    for idx, question in enumerate(quiz.questions):
        selected = user_answers[idx] if idx < len(user_answers) else -1
        is_correct = selected == question.correct_index
        if is_correct:
            correct_count += 1

        question_feedback.append(
            QuestionFeedbackItem(
                question_id=question.id,
                skill_tested=question.skill_tested,
                selected_index=selected,
                correct_index=question.correct_index,
                is_correct=is_correct,
                explanation=question.explanation,
            )
        )

        skill_key = question.skill_tested.strip()
        category = claimed_categories.get(skill_key.lower(), "Core Competency")
        if is_correct:
            skill_results_map[skill_key.lower()] = VerifiedSkillResult(
                skill_name=skill_key,
                proficiency_level="Verified",
                is_verified=True,
                verification_score=100.0,
                category=category,
                status="verified",
            )
        else:
            skill_results_map[skill_key.lower()] = VerifiedSkillResult(
                skill_name=skill_key,
                proficiency_level="Needs Review",
                is_verified=False,
                verification_score=0.0,
                category=category,
                status="gap",
            )

    # Carry forward any additional claimed skills not directly in the 3-question sample
    if resolved_profile:
        for claimed in resolved_profile.claimed_skills:
            lower_name = claimed.skill_name.lower()
            if lower_name not in skill_results_map:
                skill_results_map[lower_name] = VerifiedSkillResult(
                    skill_name=claimed.skill_name,
                    proficiency_level=f"Claimed ({claimed.self_reported_confidence})",
                    is_verified=False,
                    verification_score=50.0,
                    category=claimed.category,
                    status="unverified",
                )

    # Add missing target-role benchmark skills as gaps
    role_benchmarks = ROLE_CORE_SKILLS.get(resolved_target_role, [])
    for req_skill, req_category in role_benchmarks:
        if req_skill.lower() not in skill_results_map:
            skill_results_map[req_skill.lower()] = VerifiedSkillResult(
                skill_name=req_skill,
                proficiency_level="Missing",
                is_verified=False,
                verification_score=0.0,
                category=req_category,
                status="gap",
            )

    all_skills = list(skill_results_map.values())
    verified_skills = [s for s in all_skills if s.is_verified]
    skill_gaps = [s for s in all_skills if not s.is_verified]

    total_questions = max(len(quiz.questions), 1)
    quiz_score_percent = round((correct_count / total_questions) * 100.0, 2)

    denominator = max(len(role_benchmarks), len(all_skills), 1)
    readiness_score = round(min((len(verified_skills) / denominator) * 100.0, 100.0), 2)

    logs = [
        AgentLogEntry(
            agent_name="Profiler Agent",
            action_summary=(
                f"Graded 60-second diagnostic at {quiz_score_percent:.0f}% — "
                f"verified {len(verified_skills)} skills and flagged {len(skill_gaps)} gaps"
            ),
        )
    ]

    raw_resume_json = resolved_profile.model_dump() if resolved_profile else {}
    assessment_record = {
        "user_id": user_id,
        "topic": f"{resolved_target_role} Baseline Diagnostic",
        "score_percent": quiz_score_percent,
        "passed": quiz_score_percent >= 60.0,
        "triggered_reroute": False,
        "created_at": _now_iso(),
    }

    storage_mode = _persist_profile_and_skills(
        user_id=user_id,
        full_name=full_name,
        batch_cohort=batch_cohort,
        target_role=resolved_target_role,
        readiness_score=readiness_score,
        raw_resume_json=raw_resume_json,
        skills=all_skills,
        assessment_record=assessment_record,
    )
    _persist_logs(user_id, logs)

    combined_logs = [
        AgentLogEntry(**entry) for entry in IN_MEMORY_STORE["agent_logs"].get(user_id, [])
    ]

    return VerifiedProfileResponse(
        user_id=user_id,
        full_name=full_name,
        batch_cohort=batch_cohort,
        target_role=resolved_target_role,
        readiness_score=readiness_score,
        quiz_score_percent=quiz_score_percent,
        verified_skills=verified_skills,
        skill_gaps=skill_gaps,
        question_feedback=question_feedback,
        extracted_profile=resolved_profile,
        agent_logs=combined_logs,
        storage_mode=storage_mode,
    )


def load_demo_persona() -> VerifiedProfileResponse:
    """
    Instant 1-Click Demo Persona loader for Sophia Vance (Batch 2027, Full Stack Developer).
    Verified baseline: Python, SQL, HTML & CSS.
    Identified gaps: JavaScript, React, Node.js.
    """
    demo_profile = ExtractedProfileSchema(
        full_name="Sophia Vance",
        headline="Computer Science Undergraduate (Class of 2027) | Python & Data Systems Builder",
        education=[
            {
                "institution": "Pacific Institute of Technology",
                "degree": "B.S. in Computer Science",
                "graduation_year": "2027",
            }
        ],
        experience=[
            {
                "company": "Campus Data Lab",
                "role": "Undergraduate Research Assistant",
                "duration": "May 2025 - Present",
                "highlights": [
                    "Built automated Python ETL pipelines processing 120k student survey records.",
                    "Designed normalized PostgreSQL queries and indexing strategies for analytics.",
                ],
            }
        ],
        projects=[
            {
                "name": "CoursePulse SQL Explorer",
                "description": "Python and SQLite/PostgreSQL web utility for querying university course prerequisites.",
                "technologies": ["Python", "SQL", "HTML & CSS"],
            },
            {
                "name": "StudyMetrics Dashboard",
                "description": "Static HTML/CSS portfolio and grade calculator with clean responsive layouts.",
                "technologies": ["HTML & CSS", "Python"],
            },
        ],
        certifications=[
            "PCAP: Certified Associate in Python Programming",
            "PostgreSQL Relational Database Foundations",
        ],
        claimed_skills=[
            {"skill_name": "Python", "self_reported_confidence": "Advanced", "category": "Backend & Scripting"},
            {"skill_name": "SQL", "self_reported_confidence": "Intermediate", "category": "Databases"},
            {"skill_name": "HTML & CSS", "self_reported_confidence": "Intermediate", "category": "Frontend Foundations"},
        ],
        suggested_target_role="Full Stack Developer",
    )

    verified_skills = [
        VerifiedSkillResult(
            skill_name="Python",
            proficiency_level="Verified",
            is_verified=True,
            verification_score=92.0,
            category="Backend & Scripting",
            status="verified",
        ),
        VerifiedSkillResult(
            skill_name="SQL",
            proficiency_level="Verified",
            is_verified=True,
            verification_score=88.0,
            category="Databases",
            status="verified",
        ),
        VerifiedSkillResult(
            skill_name="HTML & CSS",
            proficiency_level="Verified",
            is_verified=True,
            verification_score=85.0,
            category="Frontend Foundations",
            status="verified",
        ),
    ]

    skill_gaps = [
        VerifiedSkillResult(
            skill_name="JavaScript ES6+ & Async",
            proficiency_level="Missing",
            is_verified=False,
            verification_score=0.0,
            category="Frontend Engineering",
            status="gap",
        ),
        VerifiedSkillResult(
            skill_name="React 19",
            proficiency_level="Missing",
            is_verified=False,
            verification_score=0.0,
            category="Frontend Engineering",
            status="gap",
        ),
        VerifiedSkillResult(
            skill_name="Node.js & Express",
            proficiency_level="Missing",
            is_verified=False,
            verification_score=0.0,
            category="Backend Engineering",
            status="gap",
        ),
    ]

    demo_logs = [
        AgentLogEntry(
            agent_name="Profiler Agent",
            action_summary="Loaded Sophia Vance profile (Batch 2027) targeting Full Stack Developer",
        ),
        AgentLogEntry(
            agent_name="Profiler Agent",
            action_summary="Verified Python (92%), SQL (88%), and HTML & CSS (85%) baseline skills",
        ),
        AgentLogEntry(
            agent_name="Gap Strategist",
            action_summary="Identified 3 priority gaps: JavaScript ES6+ & Async, React 19, and Node.js & Express",
        ),
    ]

    # Reset demo logs & roadmap cleanly before persisting
    IN_MEMORY_STORE["agent_logs"][DEMO_USER_ID] = []
    IN_MEMORY_STORE.setdefault("roadmaps", {}).pop(DEMO_USER_ID, None)
    storage_mode = _persist_profile_and_skills(
        user_id=DEMO_USER_ID,
        full_name="Sophia Vance",
        batch_cohort="Batch 2027",
        target_role="Full Stack Developer",
        readiness_score=64.0,
        raw_resume_json=demo_profile.model_dump(),
        skills=verified_skills + skill_gaps,
    )
    _persist_logs(DEMO_USER_ID, demo_logs)

    return VerifiedProfileResponse(
        user_id=DEMO_USER_ID,
        full_name="Sophia Vance",
        batch_cohort="Batch 2027",
        target_role="Full Stack Developer",
        readiness_score=64.0,
        quiz_score_percent=100.0,
        verified_skills=verified_skills,
        skill_gaps=skill_gaps,
        extracted_profile=demo_profile,
        agent_logs=demo_logs,
        storage_mode=storage_mode,
    )


def get_stored_profile(user_id: str) -> Optional[VerifiedProfileResponse]:
    """Retrieve a stored profile from Supabase or the in-memory fallback store."""
    profile_row = IN_MEMORY_STORE["profiles"].get(user_id)
    skill_rows = IN_MEMORY_STORE["user_skills"].get(user_id)
    log_rows = IN_MEMORY_STORE["agent_logs"].get(user_id, [])
    storage_mode: Literal["supabase", "in_memory"] = "in_memory"

    if profile_row is None:
        supabase = get_supabase_client()
        if supabase is not None:
            try:
                p_res = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
                if p_res.data:
                    profile_row = p_res.data[0]
                    s_res = supabase.table("user_skills").select("*").eq("user_id", user_id).execute()
                    l_res = (
                        supabase.table("agent_logs")
                        .select("*")
                        .eq("user_id", user_id)
                        .order("created_at", desc=False)
                        .execute()
                    )
                    skill_rows = s_res.data or []
                    log_rows = [
                        {
                            "agent_name": row["agent_name"],
                            "action_summary": row["action_summary"],
                            "timestamp": row["created_at"],
                        }
                        for row in (l_res.data or [])
                    ]
                    storage_mode = "supabase"
            except Exception:
                return None

    if profile_row is None:
        return None

    parsed_skills = [
        VerifiedSkillResult(
            skill_name=s["skill_name"],
            proficiency_level=s["proficiency_level"],
            is_verified=bool(s["is_verified"]),
            verification_score=float(s["verification_score"]),
            category=s["category"],
            status="verified" if s["is_verified"] else ("gap" if float(s["verification_score"]) == 0 else "unverified"),
        )
        for s in (skill_rows or [])
    ]

    raw_json = profile_row.get("raw_resume_json") or {}
    extracted = ExtractedProfileSchema(**raw_json) if raw_json else None

    return VerifiedProfileResponse(
        user_id=profile_row["id"],
        full_name=profile_row["full_name"],
        batch_cohort=profile_row.get("batch_cohort") or "Batch 2027",
        target_role=profile_row["target_role"],
        readiness_score=float(profile_row.get("readiness_score") or 0.0),
        quiz_score_percent=100.0,
        verified_skills=[s for s in parsed_skills if s.is_verified],
        skill_gaps=[s for s in parsed_skills if not s.is_verified],
        extracted_profile=extracted,
        agent_logs=[AgentLogEntry(**l) for l in log_rows],
        storage_mode=storage_mode,
    )
