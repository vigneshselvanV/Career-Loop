from typing import Any

from fastapi import APIRouter

from app.agents.profiler_agent import DEMO_USER_ID, get_stored_profile

router = APIRouter(prefix="/api/analytics", tags=["University Cohort Analytics"])


@router.get("/cohort", summary="University Batch 2027 Cohort Readiness & Skill Heatmap")
async def get_cohort_analytics() -> dict[str, Any]:
    sophia = get_stored_profile(DEMO_USER_ID)
    sophia_readiness = round(sophia.readiness_score, 1) if sophia else 64.0
    sophia_role = sophia.target_role if sophia else "Full Stack Developer"

    def _skill_score(skill_name: str, default_val: float) -> float:
        if not sophia:
            return default_val
        for s in sophia.verified_skills + sophia.skill_gaps:
            if skill_name.lower() in s.skill_name.lower():
                return round(float(s.verification_score), 1)
        return default_val

    students = [
        {
            "id": DEMO_USER_ID,
            "name": "Sophia Vance",
            "cohort": "Batch 2027 · CS",
            "target_role": sophia_role,
            "readiness": sophia_readiness,
            "skills": {
                "Python": _skill_score("Python", 92),
                "SQL": _skill_score("SQL", 88),
                "HTML & CSS": _skill_score("HTML", 85),
                "JavaScript ES6+": _skill_score("JavaScript", 0),
                "React 19": _skill_score("React", 0),
                "Node.js": _skill_score("Node", 0),
            },
        },
        {
            "id": "student-2027-02",
            "name": "Marcus Chen",
            "cohort": "Batch 2027 · CS",
            "target_role": "Backend Engineer",
            "readiness": 78.0,
            "skills": {
                "Python": 94,
                "SQL": 91,
                "HTML & CSS": 68,
                "JavaScript ES6+": 72,
                "React 19": 40,
                "Node.js": 84,
            },
        },
        {
            "id": "student-2027-03",
            "name": "Aanya Patel",
            "cohort": "Batch 2027 · AI Track",
            "target_role": "AI Engineer",
            "readiness": 81.0,
            "skills": {
                "Python": 96,
                "SQL": 82,
                "HTML & CSS": 70,
                "JavaScript ES6+": 55,
                "React 19": 35,
                "Node.js": 48,
            },
        },
        {
            "id": "student-2027-04",
            "name": "Liam O'Connor",
            "cohort": "Batch 2027 · CS",
            "target_role": "Full Stack Developer",
            "readiness": 72.0,
            "skills": {
                "Python": 76,
                "SQL": 74,
                "HTML & CSS": 90,
                "JavaScript ES6+": 84,
                "React 19": 78,
                "Node.js": 52,
            },
        },
        {
            "id": "student-2027-05",
            "name": "Elena Rostova",
            "cohort": "Batch 2027 · Data Track",
            "target_role": "Data Scientist",
            "readiness": 69.0,
            "skills": {
                "Python": 90,
                "SQL": 89,
                "HTML & CSS": 62,
                "JavaScript ES6+": 32,
                "React 19": 20,
                "Node.js": 25,
            },
        },
        {
            "id": "student-2027-06",
            "name": "Devon Brooks",
            "cohort": "Batch 2027 · Systems",
            "target_role": "Full Stack Developer",
            "readiness": 54.0,
            "skills": {
                "Python": 81,
                "SQL": 72,
                "HTML & CSS": 79,
                "JavaScript ES6+": 38,
                "React 19": 22,
                "Node.js": 30,
            },
        },
    ]

    avg_readiness = round(sum(s["readiness"] for s in students) / len(students), 1)
    skill_columns = ["Python", "SQL", "HTML & CSS", "JavaScript ES6+", "React 19", "Node.js"]
    bottlenecks = []
    for col in skill_columns:
        avg_skill = round(sum(s["skills"][col] for s in students) / len(students), 1)
        below_threshold = sum(1 for s in students if s["skills"][col] < 60)
        bottlenecks.append(
            {
                "skill": col,
                "cohort_average": avg_skill,
                "students_needing_support": below_threshold,
            }
        )
    bottlenecks.sort(key=lambda b: b["cohort_average"])

    return {
        "cohort_name": "Computer Science — Batch 2027",
        "total_students": len(students),
        "average_readiness": avg_readiness,
        "skill_columns": skill_columns,
        "students": students,
        "bottlenecks": bottlenecks,
    }
