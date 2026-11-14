from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_groq_llm
from app.schemas.market_schemas import JobRoleBenchmark, RoleSkillRequirement

ROLE_BENCHMARKS: dict[str, JobRoleBenchmark] = {
    "Full Stack Developer": JobRoleBenchmark(
        role_title="Full Stack Developer",
        description=(
            "Designs, builds, and ships end-to-end web applications spanning interactive client interfaces, "
            "REST/API backends, and relational persistence."
        ),
        required_skills=[
            RoleSkillRequirement(
                skill_name="Python",
                category="Backend",
                importance_weight=2.6,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="SQL",
                category="Backend",
                importance_weight=2.2,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="HTML & CSS",
                category="Core",
                importance_weight=1.6,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="JavaScript ES6+ & Async",
                category="Core",
                importance_weight=1.5,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="React 19",
                category="Framework",
                importance_weight=1.1,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="Node.js & Express",
                category="Backend",
                importance_weight=1.0,
                required_proficiency="Intermediate",
            ),
        ],
    ),
    "AI Engineer": JobRoleBenchmark(
        role_title="AI Engineer",
        description=(
            "Architects production LLM workflows, retrieval-augmented generation pipelines, model APIs, "
            "and multi-agent orchestration systems."
        ),
        required_skills=[
            RoleSkillRequirement(
                skill_name="Python",
                category="Core",
                importance_weight=2.5,
                required_proficiency="Advanced",
            ),
            RoleSkillRequirement(
                skill_name="SQL",
                category="Backend",
                importance_weight=1.5,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="PyTorch & Deep Learning",
                category="Framework",
                importance_weight=2.2,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="LLM Orchestration & LangGraph",
                category="Architecture",
                importance_weight=2.5,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="Vector Databases & RAG",
                category="Architecture",
                importance_weight=2.0,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="FastAPI & Model Deployment",
                category="Backend",
                importance_weight=1.8,
                required_proficiency="Intermediate",
            ),
        ],
    ),
    "Backend Engineer": JobRoleBenchmark(
        role_title="Backend Engineer",
        description=(
            "Builds resilient, scalable server-side APIs, distributed data layers, caching tiers, "
            "and containerized microservices."
        ),
        required_skills=[
            RoleSkillRequirement(
                skill_name="Python",
                category="Core",
                importance_weight=2.2,
                required_proficiency="Advanced",
            ),
            RoleSkillRequirement(
                skill_name="SQL",
                category="Backend",
                importance_weight=2.2,
                required_proficiency="Advanced",
            ),
            RoleSkillRequirement(
                skill_name="Node.js",
                category="Backend",
                importance_weight=1.8,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="System Design & Caching",
                category="Architecture",
                importance_weight=2.5,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="Docker & Microservices",
                category="Tooling",
                importance_weight=1.8,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="REST & GraphQL APIs",
                category="Backend",
                importance_weight=2.0,
                required_proficiency="Intermediate",
            ),
        ],
    ),
    "Data Scientist": JobRoleBenchmark(
        role_title="Data Scientist",
        description=(
            "Transforms complex datasets into predictive models, statistical insights, and decision-ready "
            "visualizations."
        ),
        required_skills=[
            RoleSkillRequirement(
                skill_name="Python",
                category="Core",
                importance_weight=2.5,
                required_proficiency="Advanced",
            ),
            RoleSkillRequirement(
                skill_name="SQL",
                category="Backend",
                importance_weight=2.0,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="Statistical Modeling",
                category="Core",
                importance_weight=2.2,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="Machine Learning & Scikit-Learn",
                category="Framework",
                importance_weight=2.5,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="Data Visualization",
                category="Tooling",
                importance_weight=1.5,
                required_proficiency="Intermediate",
            ),
            RoleSkillRequirement(
                skill_name="Feature Engineering",
                category="Architecture",
                importance_weight=1.8,
                required_proficiency="Intermediate",
            ),
        ],
    ),
}


def list_role_benchmarks() -> list[JobRoleBenchmark]:
    """Return all curated target job role benchmarks."""
    return list(ROLE_BENCHMARKS.values())


def _find_curated_benchmark(role_title: str) -> JobRoleBenchmark | None:
    normalized = role_title.strip().lower()
    for title, benchmark in ROLE_BENCHMARKS.items():
        if title.lower() == normalized:
            return benchmark
    return None


async def get_role_benchmark(role_title: str) -> JobRoleBenchmark:
    """
    Retrieve a curated JobRoleBenchmark by title, or dynamically synthesize one
    using Groq (llama-3.3-70b-versatile) for custom target roles.
    """
    curated = _find_curated_benchmark(role_title)
    if curated is not None:
        return curated

    try:
        llm = get_groq_llm(fast=False, temperature=0.1, max_tokens=1536)
        synthesizer = llm.with_structured_output(JobRoleBenchmark)
        generated: JobRoleBenchmark = await synthesizer.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are an industry labor-market architect. Create a realistic, structured "
                        "JobRoleBenchmark with 5 to 6 essential technical skills, accurate categories "
                        "(Core, Framework, Backend, Tooling, Architecture), importance weights between "
                        "1.0 and 3.0, and required proficiency levels."
                    )
                ),
                HumanMessage(content=f"Generate a benchmark for target job role: {role_title}"),
            ]
        )
        return generated
    except Exception:
        # Deterministic fallback when offline or API key is absent
        return JobRoleBenchmark(
            role_title=role_title.strip() or "Software Engineer",
            description=(
                f"Core engineering competency benchmark for {role_title.strip() or 'Software Engineer'}."
            ),
            required_skills=[
                RoleSkillRequirement(
                    skill_name="Python",
                    category="Core",
                    importance_weight=2.2,
                    required_proficiency="Intermediate",
                ),
                RoleSkillRequirement(
                    skill_name="SQL",
                    category="Backend",
                    importance_weight=2.0,
                    required_proficiency="Intermediate",
                ),
                RoleSkillRequirement(
                    skill_name="System Design & Architecture",
                    category="Architecture",
                    importance_weight=2.2,
                    required_proficiency="Intermediate",
                ),
                RoleSkillRequirement(
                    skill_name="Testing & CI/CD",
                    category="Tooling",
                    importance_weight=1.5,
                    required_proficiency="Intermediate",
                ),
                RoleSkillRequirement(
                    skill_name="API Development",
                    category="Backend",
                    importance_weight=1.8,
                    required_proficiency="Intermediate",
                ),
            ],
        )
