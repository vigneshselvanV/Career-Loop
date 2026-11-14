from datetime import datetime, timezone
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.agents.profiler_agent import IN_MEMORY_STORE, _persist_logs, get_stored_profile
from app.core.config import get_groq_llm, get_supabase_client
from app.schemas.mentor_schemas import (
    MentorChatResponse,
    TopicQuiz,
    TopicQuizQuestion,
)
from app.schemas.profiler_schemas import AgentLogEntry

CURATED_TOPIC_QUESTIONS: dict[str, list[dict[str, Any]]] = {
    "javascript": [
        {
            "question": "What does `async` before a JavaScript function declaration guarantee?",
            "options": [
                "The function always returns a Promise",
                "The function runs on a separate CPU thread",
                "All loops inside the function execute synchronously",
                "Errors inside the function are silently ignored",
            ],
            "correct_index": 0,
            "explanation": "An async function always wraps its return value (or thrown rejection) in a Promise.",
        },
        {
            "question": "Which queue has higher priority in the JavaScript event loop after the call stack clears?",
            "options": [
                "Macrotask queue (setTimeout)",
                "Microtask queue (Promise.then)",
                "Animation frame queue",
                "Network callback queue",
            ],
            "correct_index": 1,
            "explanation": "Microtasks such as Promise callbacks drain completely before the next macrotask runs.",
        },
        {
            "question": "What does `const { name, role = 'Engineer' } = user;` demonstrate?",
            "options": [
                "Object destructuring with a default value",
                "Prototype inheritance cloning",
                "Array spread assignment",
                "Deep object freezing",
            ],
            "correct_index": 0,
            "explanation": "ES6 object destructuring extracts properties and assigns fallback defaults when undefined.",
        },
        {
            "question": "Which method transforms every element in an array and returns a new array of equal length?",
            "options": [
                "Array.prototype.forEach()",
                "Array.prototype.map()",
                "Array.prototype.filter()",
                "Array.prototype.find()",
            ],
            "correct_index": 1,
            "explanation": "map() invokes a transform function on each item and returns a brand-new array.",
        },
        {
            "question": "How do you run two independent Promises concurrently and wait for both to resolve?",
            "options": [
                "await Promise.all([p1, p2])",
                "await p1; await p2;",
                "Promise.resolve([p1, p2])",
                "Promise.race([p1, p2])",
            ],
            "correct_index": 0,
            "explanation": "Promise.all executes promises concurrently and resolves once every promise fulfills.",
        },
    ],
    "react": [
        {
            "question": "Why should React state updates treat arrays and objects immutably?",
            "options": [
                "React detects state changes via shallow reference comparison",
                "JavaScript forbids mutating arrays inside functions",
                "Immutable objects automatically persist to localStorage",
                "React hooks cannot store objects otherwise",
            ],
            "correct_index": 0,
            "explanation": "Replacing references lets React detect changes accurately and avoid skipped re-renders.",
        },
        {
            "question": "When does a `useEffect(fn, [userId])` callback re-run?",
            "options": [
                "Only once on initial page load",
                "On mount and whenever `userId` changes between renders",
                "Before every DOM paint regardless of dependencies",
                "Only when the parent component unmounts",
            ],
            "correct_index": 1,
            "explanation": "React compares dependency array values with Object.is and re-runs the effect when `userId` changes.",
        },
        {
            "question": "What is the primary role of the `key` prop when rendering lists in React?",
            "options": [
                "Encrypting list data in the DOM",
                "Helping React track item identity across inserts, reorders, and deletes",
                "Styling alternating table rows automatically",
                "Binding click events to list elements",
            ],
            "correct_index": 1,
            "explanation": "Stable unique keys preserve component state and minimize DOM reconciliation work.",
        },
    ],
    "node": [
        {
            "question": "In Express, what is the purpose of calling `next()` inside a middleware function?",
            "options": [
                "Restart the Node.js server process",
                "Pass control to the next matching middleware or route handler",
                "Send an HTTP 200 JSON response immediately",
                "Close the PostgreSQL connection pool",
            ],
            "correct_index": 1,
            "explanation": "Calling next() hands execution to the subsequent middleware in the request pipeline.",
        },
        {
            "question": "Why does Node.js excel at I/O-heavy API servers despite running JS on a single main thread?",
            "options": [
                "Non-blocking asynchronous I/O delegated to libuv and OS kernels",
                "Automatic compilation of JavaScript into Rust binaries",
                "Blocking every request until the previous request completes",
                "Disabling TCP keep-alive connections",
            ],
            "correct_index": 0,
            "explanation": "Node.js offloads I/O operations asynchronously, keeping the event loop responsive for concurrent requests.",
        },
        {
            "question": "Which HTTP status code properly represents a newly created resource after a POST request?",
            "options": ["200 OK", "201 Created", "304 Not Modified", "422 Unprocessable Entity"],
            "correct_index": 1,
            "explanation": "201 Created signals that the request succeeded and resulted in a new server resource.",
        },
    ],
}


class SocraticOutputSchema(BaseModel):
    reply: str = Field(..., description="Concise Socratic mentor response with concrete analogy and guiding question.")
    socratic_hint: str = Field(..., description="One-sentence actionable hint pointing to the core mental model.")
    suggested_followups: list[str] = Field(..., min_length=2, max_length=3)


class MentorAssessmentAgent:
    """Sub-Agent 4: Generates topic quizzes, grades assessments, triggers reroutes (<60%), and runs Socratic mentoring."""

    async def generate_topic_quiz(
        self,
        user_id: str,
        topic: str,
        target_role: str,
        num_questions: int = 5,
    ) -> TopicQuiz:
        try:
            llm = get_groq_llm(fast=True, temperature=0.2, max_tokens=2048)
            quiz_llm = llm.with_structured_output(TopicQuiz)
            quiz: TopicQuiz = await quiz_llm.ainvoke(
                [
                    SystemMessage(
                        content=(
                            f"You are CareerLoop's rapid technical quiz generator using fast inference. "
                            f"Create exactly {num_questions} crisp, practical multiple-choice questions on '{topic}' "
                            f"tailored for a {target_role}. Each question must have 4 options, correct_index (0-3), "
                            "and a clear 1-sentence explanation."
                        )
                    ),
                    HumanMessage(content=f"Generate a {num_questions}-question TopicQuiz for '{topic}'."),
                ]
            )
            _persist_logs(
                user_id,
                [
                    AgentLogEntry(
                        agent_name="Mentor & Evaluator",
                        action_summary=f"Generated {len(quiz.questions)}-question assessment on {topic}",
                    )
                ],
            )
            return quiz
        except Exception:
            topic_low = topic.lower()
            if "react" in topic_low:
                pool = CURATED_TOPIC_QUESTIONS["react"]
            elif "node" in topic_low or "express" in topic_low:
                pool = CURATED_TOPIC_QUESTIONS["node"]
            else:
                pool = CURATED_TOPIC_QUESTIONS["javascript"]

            questions: list[TopicQuizQuestion] = []
            for idx in range(min(num_questions, len(pool))):
                item = pool[idx]
                questions.append(
                    TopicQuizQuestion(
                        id=f"tq-{idx + 1}",
                        topic=topic,
                        question=item["question"],
                        options=item["options"],
                        correct_index=item["correct_index"],
                        explanation=item["explanation"],
                    )
                )

            while len(questions) < num_questions:
                idx = len(questions) + 1
                questions.append(
                    TopicQuizQuestion(
                        id=f"tq-{idx}",
                        topic=topic,
                        question=f"Which practice best demonstrates mastery of {topic} in production?",
                        options=[
                            "Writing predictable, testable modules with clear error handling",
                            "Ignoring edge cases and asynchronous rejections",
                            "Mutating shared global state across unrelated components",
                            "Skipping code review and type validation",
                        ],
                        correct_index=0,
                        explanation=f"Predictable modular structure and explicit error handling are essential in {topic}.",
                    )
                )

            _persist_logs(
                user_id,
                [
                    AgentLogEntry(
                        agent_name="Mentor & Evaluator",
                        action_summary=f"Generated {len(questions)}-question assessment on {topic}",
                    )
                ],
            )
            return TopicQuiz(topic=topic, target_role=target_role, questions=questions)

    def evaluate_submission(
        self,
        user_id: str,
        topic: str,
        quiz: TopicQuiz,
        user_answers: list[int],
    ) -> dict[str, Any]:
        correct = 0
        feedback: list[dict[str, Any]] = []
        for idx, q in enumerate(quiz.questions):
            chosen = user_answers[idx] if idx < len(user_answers) else -1
            is_right = chosen == q.correct_index
            if is_right:
                correct += 1
            feedback.append(
                {
                    "question_id": q.id,
                    "question": q.question,
                    "selected_index": chosen,
                    "correct_index": q.correct_index,
                    "is_correct": is_right,
                    "explanation": q.explanation,
                }
            )

        score_percent = round((correct / max(len(quiz.questions), 1)) * 100.0, 2)
        return self._record_evaluation(
            user_id=user_id,
            topic=topic,
            score_percent=score_percent,
            feedback=feedback,
        )

    def record_simulated_score(
        self,
        user_id: str,
        topic: str,
        score_percent: float,
    ) -> dict[str, Any]:
        feedback = [
            {
                "question_id": "sim-1",
                "question": f"{topic} — Core Closure & Async Execution Check",
                "selected_index": 2,
                "correct_index": 0,
                "is_correct": False,
                "explanation": "Promises and closures require solid fundamentals in lexical scope and event loop ordering.",
            },
            {
                "question_id": "sim-2",
                "question": f"{topic} — Array Transformation & Immutability",
                "selected_index": 1,
                "correct_index": 1,
                "is_correct": True,
                "explanation": "map() creates a new transformed array without mutating the source array.",
            },
        ]
        return self._record_evaluation(
            user_id=user_id,
            topic=topic,
            score_percent=score_percent,
            feedback=feedback,
        )

    def _record_evaluation(
        self,
        user_id: str,
        topic: str,
        score_percent: float,
        feedback: list[dict[str, Any]],
    ) -> dict[str, Any]:
        passed = score_percent >= 60.0
        needs_reroute = not passed

        assessment_row = {
            "user_id": user_id,
            "topic": topic,
            "score_percent": score_percent,
            "passed": passed,
            "triggered_reroute": needs_reroute,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        IN_MEMORY_STORE.setdefault("assessments", {}).setdefault(user_id, []).append(assessment_row)

        # If passed, promote skill to verified in IN_MEMORY_STORE
        if passed:
            skills = IN_MEMORY_STORE.get("user_skills", {}).get(user_id, [])
            for skill in skills:
                if topic.lower() in skill["skill_name"].lower() or skill["skill_name"].lower() in topic.lower():
                    skill["is_verified"] = True
                    skill["proficiency_level"] = "Verified"
                    skill["verification_score"] = max(float(skill.get("verification_score", 0.0)), score_percent)
                    skill["status"] = "verified"

        supabase = get_supabase_client()
        if supabase is not None:
            try:
                supabase.table("assessments").insert(assessment_row).execute()
            except Exception:
                pass

        if needs_reroute:
            advice = (
                f"You scored {score_percent:.0f}% on {topic} (below the 60% mastery threshold). "
                "Let's strengthen your foundation first—I've notified the Supervisor to insert a focused "
                "prerequisite module before you retry."
            )
            log_summary = (
                f"Evaluated {topic} quiz at {score_percent:.0f}% (< 60% threshold); "
                "flagged adaptive roadmap re-route"
            )
        else:
            advice = (
                f"Great work—you scored {score_percent:.0f}% on {topic} and unlocked the next step on your roadmap."
            )
            log_summary = f"Evaluated {topic} quiz at {score_percent:.0f}% (Passed); updated skill verification"

        _persist_logs(
            user_id,
            [AgentLogEntry(agent_name="Mentor & Evaluator", action_summary=log_summary)],
        )

        return {
            "topic": topic,
            "score_percent": score_percent,
            "passed": passed,
            "needs_reroute": needs_reroute,
            "feedback": feedback,
            "mentor_advice": advice,
        }

    async def socratic_chat(
        self,
        user_id: str,
        topic: str,
        message: str,
        history: list[dict[str, str]],
    ) -> MentorChatResponse:
        profile = get_stored_profile(user_id)
        verified_names = [s.skill_name for s in profile.verified_skills] if profile else ["Python", "SQL"]
        target_role = profile.target_role if profile else "Full Stack Developer"

        try:
            llm = get_groq_llm(fast=False, temperature=0.3, max_tokens=1024)
            mentor_llm = llm.with_structured_output(SocraticOutputSchema)
            recent_context = "\n".join(f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history[-4:])

            result: SocraticOutputSchema = await mentor_llm.ainvoke(
                [
                    SystemMessage(
                        content=(
                            f"You are CareerLoop's Socratic AI Mentor coaching a learner targeting {target_role}. "
                            f"They already know {', '.join(verified_names)}. Connect '{topic}' concepts to what "
                            "they already know (e.g., Python/SQL analogies), never dump final quiz answers directly, "
                            "and end with one probing question."
                        )
                    ),
                    HumanMessage(
                        content=f"Topic: {topic}\nRecent conversation:\n{recent_context}\n\nLearner message: {message}"
                    ),
                ]
            )
            reply, hint, followups = result.reply, result.socratic_hint, result.suggested_followups
        except Exception:
            anchor = verified_names[0] if verified_names else "Python"
            if "async" in message.lower() or "promise" in message.lower() or "javascript" in topic.lower():
                reply = (
                    f"Think of a JavaScript Promise like a restaurant order ticket—or an `asyncio` Future in {anchor}. "
                    "When you call `fetch()`, JavaScript doesn't freeze the kitchen; it hands you a pending Promise and "
                    "continues handling UI events until the result settles. If you `await` two independent requests one "
                    "after another vs. grouping them with `Promise.all`, which one keeps total wait time lower and why?"
                )
                hint = "Compare sequential `await` calls against concurrent `Promise.all` execution."
                followups = [
                    "Walk me through Promise.all vs sequential await",
                    "How does the microtask queue order callbacks?",
                    "Quiz me on JavaScript Fundamentals",
                ]
            else:
                reply = (
                    f"Great question on {topic}. Since you already have a strong foundation in {', '.join(verified_names)}, "
                    f"try mapping this concept back to clear data flow: what input enters your {topic} layer, and what "
                    "predictable state or output should it return? Walk me through your mental model in one sentence."
                )
                hint = f"Trace input -> transformation -> output to simplify {topic} debugging."
                followups = [
                    f"Give me a {anchor}-to-{topic} analogy",
                    f"What is the most common pitfall in {topic}?",
                    f"Start a quick check on {topic}",
                ]

        log_entry = AgentLogEntry(
            agent_name="Mentor & Evaluator",
            action_summary=f"Delivered Socratic coaching on {topic} connecting to {verified_names[0] if verified_names else 'core'} skills",
        )
        _persist_logs(user_id, [log_entry])

        return MentorChatResponse(
            reply=reply,
            socratic_hint=hint,
            suggested_followups=followups,
            agent_logs=IN_MEMORY_STORE["agent_logs"].get(user_id, []),
        )
