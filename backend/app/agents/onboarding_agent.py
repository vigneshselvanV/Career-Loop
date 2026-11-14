from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.profiler_agent import _persist_logs
from app.core.config import get_openrouter_llm
from app.schemas.onboarding_schemas import (
    OnboardingAnalyzeRequest,
    OnboardingAnalyzeResponse,
    OnboardingInsightSchema,
)
from app.schemas.profiler_schemas import (
    AgentLogEntry,
    BaselineDiagnosticQuiz,
    ClaimedSkillItem,
    DiagnosticQuestion,
)

ROLE_SKILL_SUGGESTIONS: dict[str, list[tuple[str, str]]] = {
    "Full Stack Developer": [
        ("Python", "Backend & Scripting"),
        ("SQL", "Databases"),
        ("HTML & CSS", "Frontend Foundations"),
        ("JavaScript ES6+ & Async", "Frontend Engineering"),
        ("React 19", "Frontend Engineering"),
        ("Node.js & Express", "Backend Engineering"),
    ],
    "AI Engineer": [
        ("Python", "Core"),
        ("SQL", "Databases"),
        ("FastAPI & Model Deployment", "Backend Engineering"),
        ("LLM Orchestration & LangGraph", "Agentic AI"),
        ("Vector Databases & RAG", "Retrieval & RAG"),
    ],
    "Backend Engineer": [
        ("Python", "Core"),
        ("SQL", "Databases"),
        ("Node.js & Express", "Backend Engineering"),
        ("Docker & Microservices", "Tooling"),
        ("System Design & Caching", "Architecture"),
    ],
    "Data Scientist": [
        ("Python", "Core"),
        ("SQL", "Databases"),
        ("Statistical Modeling", "Data Science"),
        ("Machine Learning & Scikit-Learn", "AI & Modeling"),
        ("Data Visualization", "Tooling"),
    ],
}

DIAGNOSTIC_QUESTION_BANK: dict[str, tuple[str, list[str], int, str]] = {
    "python": (
        "Which Python structure gives O(1) average lookup time for membership checks?",
        ["list", "set", "tuple", "deque"],
        1,
        "A Python set uses a hash table internally for O(1) average membership checks.",
    ),
    "sql": (
        "Which SQL clause filters grouped rows after GROUP BY aggregation?",
        ["WHERE", "HAVING", "ORDER BY", "DISTINCT"],
        1,
        "HAVING filters aggregated groups, whereas WHERE filters individual rows beforehand.",
    ),
    "html & css": (
        "Which CSS Flexbox property aligns items along the main axis?",
        ["align-items", "justify-content", "flex-wrap", "place-self"],
        1,
        "justify-content distributes flex items along the main axis.",
    ),
    "javascript": (
        "What does marking a JavaScript function `async` guarantee?",
        [
            "It always returns a Promise",
            "It runs on a separate OS thread",
            "Loops inside it become non-blocking",
            "Errors inside are silently ignored",
        ],
        0,
        "An async function always wraps its return value or rejection in a Promise.",
    ),
    "react": (
        "Why should React state updates treat arrays and objects immutably?",
        [
            "React detects state changes via shallow reference comparison",
            "JavaScript forbids mutating arrays inside hooks",
            "Immutable objects persist to databases automatically",
            "JSX only renders frozen objects",
        ],
        0,
        "Replacing references lets React detect updates reliably and trigger re-renders.",
    ),
    "node": (
        "In Express, why do middleware functions call `next()`?",
        [
            "Restart the server process",
            "Pass control to the next middleware or route handler",
            "Close the database pool",
            "Send an HTTP 200 response automatically",
        ],
        1,
        "Calling next() hands execution to the subsequent middleware in the request pipeline.",
    ),
}


def _extract_deterministic_skills(req: OnboardingAnalyzeRequest) -> list[ClaimedSkillItem]:
    seen: set[str] = set()
    items: list[ClaimedSkillItem] = []

    for raw in req.selected_skills:
        clean = raw.strip()
        if clean and clean.lower() not in seen:
            seen.add(clean.lower())
            items.append(
                ClaimedSkillItem(
                    skill_name=clean,
                    self_reported_confidence="Intermediate",
                    category="Self-Reported",
                )
            )

    note_low = req.background_note.lower()
    keyword_map = [
        ("python", "Python", "Backend & Scripting"),
        ("sql", "SQL", "Databases"),
        ("postgres", "SQL", "Databases"),
        ("html", "HTML & CSS", "Frontend Foundations"),
        ("css", "HTML & CSS", "Frontend Foundations"),
        ("javascript", "JavaScript ES6+ & Async", "Frontend Engineering"),
        ("typescript", "TypeScript", "Frontend Engineering"),
        ("react", "React 19", "Frontend Engineering"),
        ("node", "Node.js & Express", "Backend Engineering"),
        ("fastapi", "FastAPI & Model Deployment", "Backend Engineering"),
        ("pytorch", "PyTorch & Deep Learning", "AI & Modeling"),
        ("docker", "Docker & Microservices", "Tooling"),
    ]
    for token, canonical, cat in keyword_map:
        if token in note_low and canonical.lower() not in seen:
            seen.add(canonical.lower())
            items.append(
                ClaimedSkillItem(
                    skill_name=canonical,
                    self_reported_confidence="Intermediate",
                    category=cat,
                )
            )

    if not items:
        defaults = ROLE_SKILL_SUGGESTIONS.get(req.target_role, ROLE_SKILL_SUGGESTIONS["Full Stack Developer"])[:3]
        for name, cat in defaults:
            items.append(
                ClaimedSkillItem(
                    skill_name=name,
                    self_reported_confidence="Beginner",
                    category=cat,
                )
            )

    return items[:8]


def _build_deterministic_quiz(
    target_role: str,
    skills: list[ClaimedSkillItem],
) -> BaselineDiagnosticQuiz:
    skill_names = [s.skill_name for s in skills[:3]]
    fallback_defaults = ["Python", "SQL", "HTML & CSS"]
    while len(skill_names) < 3:
        candidate = fallback_defaults[len(skill_names)]
        if candidate not in skill_names:
            skill_names.append(candidate)

    questions: list[DiagnosticQuestion] = []
    for idx, skill in enumerate(skill_names[:3], start=1):
        low = skill.lower()
        bank_entry = None
        for key, entry in DIAGNOSTIC_QUESTION_BANK.items():
            if key in low:
                bank_entry = entry
                break
        if bank_entry:
            q_text, opts, c_idx, exp = bank_entry
        else:
            q_text = f"Which practice best demonstrates production reliability when working with {skill}?"
            opts = [
                "Modular structure with input validation and automated tests",
                "Duplicating business logic across global scripts",
                "Ignoring error states and asynchronous rejections",
                "Hardcoding API credentials inside client components",
            ]
            c_idx = 0
            exp = f"Modular design, validation, and testing are core engineering standards in {skill}."
        questions.append(
            DiagnosticQuestion(
                id=f"onb-q{idx}",
                skill_tested=skill,
                question=q_text,
                options=opts,
                correct_index=c_idx,
                explanation=exp,
            )
        )

    return BaselineDiagnosticQuiz(
        target_role=target_role,
        estimated_seconds=60,
        questions=questions,
    )


async def analyze_onboarding_context(
    req: OnboardingAnalyzeRequest,
) -> OnboardingAnalyzeResponse:
    """
    AI-powered onboarding coach & baseline diagnostic generator using OpenRouter
    (defaulting to cohere/north-mini-code:free) with deterministic fallback.
    """
    deterministic_skills = _extract_deterministic_skills(req)

    try:
        llm = get_openrouter_llm(temperature=0.2, max_tokens=2048)
        structured = llm.with_structured_output(OnboardingInsightSchema)
        insight: OnboardingInsightSchema = await structured.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are CareerLoop's AI Onboarding Coach. Analyze the learner's background, "
                        "experience level, and target career role. Produce: (1) a concise, encouraging "
                        "coach_message acknowledging their background, (2) one crisp follow_up_question "
                        "to calibrate their project depth, (3) normalized suggested_skills, and "
                        "(4) a 3-question 60-second BaselineDiagnosticQuiz tailored to their claimed skills."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Learner Name: {req.full_name}\n"
                        f"Cohort/Track: {req.batch_cohort}\n"
                        f"Experience Level: {req.experience_level}\n"
                        f"Target Role: {req.target_role}\n"
                        f"Selected Skills: {', '.join(req.selected_skills) or 'None selected yet'}\n"
                        f"Background & Projects Note: {req.background_note or 'No free-text note provided.'}"
                    )
                ),
            ]
        )
        coach_msg = insight.coach_message
        follow_up = insight.follow_up_question
        suggested_skills = insight.suggested_skills or deterministic_skills
        quiz = insight.diagnostic_quiz
    except Exception:
        skill_preview = ", ".join(s.skill_name for s in deterministic_skills[:3])
        coach_msg = (
            f"Welcome to CareerLoop, {req.full_name}. Based on your {req.experience_level.lower()} background "
            f"and target role as {req.target_role}, I mapped your initial strengths around {skill_preview}."
        )
        follow_up = (
            f"Which project or coursework gave you the most hands-on confidence with {deterministic_skills[0].skill_name}?"
        )
        suggested_skills = deterministic_skills
        quiz = _build_deterministic_quiz(req.target_role, suggested_skills)

    logs = [
        AgentLogEntry(
            agent_name="Profiler Agent",
            action_summary=(
                f"Calibrated {len(suggested_skills)} claimed skills for {req.full_name} targeting {req.target_role}"
            ),
        ),
        AgentLogEntry(
            agent_name="Supervisor",
            action_summary="Prepared personalized 60-second baseline verification check",
        ),
    ]
    _persist_logs(req.user_id, logs)

    return OnboardingAnalyzeResponse(
        coach_message=coach_msg,
        follow_up_question=follow_up,
        suggested_skills=suggested_skills,
        diagnostic_quiz=quiz,
        agent_logs=logs,
    )
