import operator
from datetime import datetime, timezone
from typing import Annotated, Any, AsyncIterator, Literal, Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from app.agents.curriculum_agent import CurriculumArchitectAgent, get_stored_roadmap
from app.agents.market_agent import MarketStrategistAgent
from app.agents.mentor_agent import MentorAssessmentAgent
from app.agents.profiler_agent import IN_MEMORY_STORE, _persist_logs, get_stored_profile
from app.core.config import get_groq_llm
from app.schemas.profiler_schemas import AgentLogEntry

SubAgentNodeName = Literal[
    "profiler_node",
    "market_strategist_node",
    "curriculum_architect_node",
    "mentor_evaluator_node",
    "FINISH",
]


class CareerLoopState(TypedDict):
    """Shared typed LangGraph state flowing across the Supervisor and 4 Sub-Agents."""

    user_id: str
    full_name: str
    target_role: str
    target_role_changed: bool
    verified_skills: list[dict[str, Any]]
    unverified_skills: list[dict[str, Any]]
    readiness_score: float
    skill_gaps: list[dict[str, Any]]
    roadmap_dag: Optional[dict[str, Any]]
    last_assessment: Optional[dict[str, Any]]
    needs_reroute: bool
    requested_action: str
    active_agent: str
    step_count: int
    role_summary: str
    matched_verified_skills: list[str]
    assessment_payload: Optional[dict[str, Any]]
    agent_logs: Annotated[list[dict[str, Any]], operator.add]


class SupervisorRouteDecision(BaseModel):
    """Structured routing output returned by the Main Supervisor Orchestrator."""

    next_node: SubAgentNodeName = Field(..., description="Next sub-agent node to execute or FINISH.")
    rationale: str = Field(..., description="Short plain-English rationale for the delegation decision.")


def _make_log(agent_name: str, action_summary: str) -> dict[str, Any]:
    return {
        "agent_name": agent_name,
        "action_summary": action_summary,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _deterministic_route(state: CareerLoopState) -> SupervisorRouteDecision:
    """Deterministic routing policy enforcing safety, role-pivot cascades, and adaptive re-routing."""
    step_count = state.get("step_count", 0)
    if step_count >= 10:
        return SupervisorRouteDecision(
            next_node="FINISH",
            rationale="Reached orchestration step budget; returning latest verified state.",
        )

    action = state.get("requested_action", "analyze_gaps")
    active = state.get("active_agent", "")
    needs_reroute = state.get("needs_reroute", False)
    role_changed = state.get("target_role_changed", False)

    # Adaptive re-route loop triggered by <60% quiz score
    if needs_reroute:
        last_assess = state.get("last_assessment") or {}
        topic = last_assess.get("topic", "JavaScript ES6+ & Async")
        score = last_assess.get("score_percent", 40)
        return SupervisorRouteDecision(
            next_node="curriculum_architect_node",
            rationale=(
                f"Score {score:.0f}% on {topic} is below 60%; instructing Curriculum Architect "
                "to inject a prerequisite remediation node."
            ),
        )

    # Role switch cascades: Market Strategist -> Curriculum Architect -> FINISH
    if role_changed or action == "switch_role":
        if active not in ("market_strategist_node", "curriculum_architect_node"):
            return SupervisorRouteDecision(
                next_node="market_strategist_node",
                rationale=f"Evaluating updated career target ({state.get('target_role')}) and recalculating gaps.",
            )
        if active == "market_strategist_node":
            return SupervisorRouteDecision(
                next_node="curriculum_architect_node",
                rationale=f"Regenerating DAG learning roadmap for new target role ({state.get('target_role')}).",
            )
        return SupervisorRouteDecision(
            next_node="FINISH",
            rationale=f"Completed target role pivot and roadmap update for {state.get('target_role')}.",
        )

    if action == "analyze_gaps":
        if active != "market_strategist_node":
            return SupervisorRouteDecision(
                next_node="market_strategist_node",
                rationale=f"Evaluating {state.get('target_role')} role readiness and skill gaps.",
            )
        return SupervisorRouteDecision(
            next_node="FINISH",
            rationale=f"Completed gap analysis for {state.get('target_role')}.",
        )

    if action == "build_roadmap":
        if not state.get("skill_gaps") and active not in ("market_strategist_node", "curriculum_architect_node"):
            return SupervisorRouteDecision(
                next_node="market_strategist_node",
                rationale=f"Computing skill gaps before generating {state.get('target_role')} roadmap.",
            )
        if active != "curriculum_architect_node":
            return SupervisorRouteDecision(
                next_node="curriculum_architect_node",
                rationale=f"Building interactive DAG learning roadmap for {state.get('target_role')}.",
            )
        return SupervisorRouteDecision(
            next_node="FINISH",
            rationale="Roadmap generation completed.",
        )

    if action == "evaluate_quiz":
        if active not in ("mentor_evaluator_node", "curriculum_architect_node"):
            return SupervisorRouteDecision(
                next_node="mentor_evaluator_node",
                rationale="Grading assessment and checking mastery threshold.",
            )
        return SupervisorRouteDecision(
            next_node="FINISH",
            rationale="Assessment evaluation and roadmap sync completed.",
        )

    if not state.get("verified_skills") and active != "profiler_node":
        return SupervisorRouteDecision(
            next_node="profiler_node",
            rationale="Loading candidate baseline profile and verified skills.",
        )

    return SupervisorRouteDecision(
        next_node="FINISH",
        rationale="All requested agent steps completed.",
    )


async def supervisor_node(state: CareerLoopState) -> dict[str, Any]:
    """
    Main Agent — CareerLoop Orchestrator (Supervisor).
    Inspects CareerLoopState using Groq structured output + deterministic guardrails
    and delegates to the appropriate sub-agent or FINISH.
    """
    next_step = state.get("step_count", 0) + 1
    policy_decision = _deterministic_route(state)
    chosen_decision = policy_decision

    if policy_decision.next_node != "FINISH" and next_step <= 8:
        try:
            llm = get_groq_llm(fast=False, temperature=0.0, max_tokens=256)
            router_llm = llm.with_structured_output(SupervisorRouteDecision)
            llm_decision: SupervisorRouteDecision = await router_llm.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "You are the CareerLoop Main Supervisor Orchestrator. Inspect the workflow state "
                            "and select the single best next_node among: profiler_node, market_strategist_node, "
                            "curriculum_architect_node, mentor_evaluator_node, or FINISH. Provide a crisp 1-sentence rationale."
                        )
                    ),
                    HumanMessage(
                        content=(
                            f"requested_action={state.get('requested_action')}\n"
                            f"target_role={state.get('target_role')}\n"
                            f"target_role_changed={state.get('target_role_changed')}\n"
                            f"needs_reroute={state.get('needs_reroute')}\n"
                            f"active_agent={state.get('active_agent')}\n"
                            f"verified_skills_count={len(state.get('verified_skills', []))}\n"
                            f"skill_gaps_count={len(state.get('skill_gaps', []))}\n"
                            f"recommended_policy_node={policy_decision.next_node}"
                        )
                    ),
                ]
            )
            if llm_decision.next_node == policy_decision.next_node:
                chosen_decision = llm_decision
        except Exception:
            chosen_decision = policy_decision

    node_labels = {
        "profiler_node": "Profiler Agent",
        "market_strategist_node": "Market Strategist",
        "curriculum_architect_node": "Curriculum Architect",
        "mentor_evaluator_node": "Mentor & Evaluator",
        "FINISH": "Finish",
    }
    target_label = node_labels.get(chosen_decision.next_node, chosen_decision.next_node)
    if chosen_decision.next_node == "FINISH":
        summary = f"Completed orchestration workflow — {chosen_decision.rationale}"
    else:
        summary = f"Delegating to {target_label} — {chosen_decision.rationale}"

    log_entry = _make_log("Supervisor", summary)
    _persist_logs(state["user_id"], [AgentLogEntry(**log_entry)])

    return {
        "step_count": next_step,
        "active_agent": chosen_decision.next_node,
        "agent_logs": [log_entry],
    }


async def profiler_node(state: CareerLoopState) -> dict[str, Any]:
    """Sub-Agent 1 node: ensures verified baseline skills are hydrated into graph state."""
    profile = get_stored_profile(state["user_id"])
    if profile is not None:
        verified = [s.model_dump() for s in profile.verified_skills]
        unverified = [s.model_dump() for s in profile.skill_gaps]
        log_entry = _make_log(
            "Profiler Agent",
            f"Loaded {len(verified)} verified baseline skills for {profile.full_name}",
        )
        _persist_logs(state["user_id"], [AgentLogEntry(**log_entry)])
        return {
            "full_name": profile.full_name,
            "verified_skills": verified,
            "unverified_skills": unverified,
            "active_agent": "profiler_node",
            "agent_logs": [log_entry],
        }

    log_entry = _make_log("Profiler Agent", "No stored profile found; awaiting PDF upload or demo persona")
    return {
        "active_agent": "profiler_node",
        "agent_logs": [log_entry],
    }


async def market_strategist_node(state: CareerLoopState) -> dict[str, Any]:
    """Sub-Agent 2 node: executes MarketStrategistAgent against target_role."""
    strategist = MarketStrategistAgent()
    analysis = await strategist.analyze_role_and_gaps(
        user_id=state["user_id"],
        target_role=state["target_role"],
        verified_skills=state.get("verified_skills", []),
        unverified_skills=state.get("unverified_skills", []),
    )

    latest_log = (
        analysis.agent_logs[-1]
        if analysis.agent_logs
        else _make_log(
            "Market Strategist",
            f"Calculated {analysis.readiness_score:.0f}% readiness for {analysis.target_role}",
        )
    )

    return {
        "target_role": analysis.target_role,
        "target_role_changed": False,
        "readiness_score": analysis.readiness_score,
        "skill_gaps": [gap.model_dump() for gap in analysis.skill_gaps],
        "role_summary": analysis.role_summary,
        "matched_verified_skills": analysis.matched_verified_skills,
        "active_agent": "market_strategist_node",
        "agent_logs": [latest_log],
    }


async def curriculum_architect_node(state: CareerLoopState) -> dict[str, Any]:
    """Sub-Agent 3 node: generates DAG roadmap or injects prerequisite remediation node."""
    architect = CurriculumArchitectAgent()
    existing_dag = state.get("roadmap_dag")
    if existing_dag is None:
        stored = get_stored_roadmap(state["user_id"])
        existing_dag = stored.model_dump() if stored else None

    reroute_topic: Optional[str] = None
    reroute_score: Optional[float] = None
    if state.get("needs_reroute") and state.get("last_assessment"):
        reroute_topic = state["last_assessment"].get("topic")
        reroute_score = float(state["last_assessment"].get("score_percent", 40.0))

        # Ensure an initial roadmap exists before injecting remediation
        if existing_dag is None:
            initial_dag = await architect.build_or_reroute_roadmap(
                user_id=state["user_id"],
                target_role=state["target_role"],
                verified_skills=state.get("verified_skills", []),
                skill_gaps=state.get("skill_gaps", []),
            )
            existing_dag = initial_dag.model_dump()

    dag = await architect.build_or_reroute_roadmap(
        user_id=state["user_id"],
        target_role=state["target_role"],
        verified_skills=state.get("verified_skills", []),
        skill_gaps=state.get("skill_gaps", []),
        existing_dag=existing_dag,
        reroute_topic=reroute_topic,
        reroute_score=reroute_score,
    )

    latest_logs = IN_MEMORY_STORE.get("agent_logs", {}).get(state["user_id"], [])
    latest_entry = (
        latest_logs[-1]
        if latest_logs
        else _make_log("Curriculum Architect", f"Updated DAG roadmap for {state['target_role']}")
    )

    return {
        "roadmap_dag": dag.model_dump(),
        "needs_reroute": False,
        "active_agent": "curriculum_architect_node",
        "agent_logs": [latest_entry],
    }


async def mentor_evaluator_node(state: CareerLoopState) -> dict[str, Any]:
    """Sub-Agent 4 node: grades topic assessment or simulated score and sets needs_reroute."""
    mentor = MentorAssessmentAgent()
    payload = state.get("assessment_payload") or {}
    mode = payload.get("mode", "simulate")
    topic = payload.get("topic", "JavaScript ES6+ & Async")

    if mode == "quiz_submission" and payload.get("quiz") is not None:
        from app.schemas.mentor_schemas import TopicQuiz

        quiz_obj = TopicQuiz(**payload["quiz"])
        result = mentor.evaluate_submission(
            user_id=state["user_id"],
            topic=topic,
            quiz=quiz_obj,
            user_answers=payload.get("user_answers", []),
        )
    else:
        score = float(payload.get("score_percent", 40.0))
        result = mentor.record_simulated_score(
            user_id=state["user_id"],
            topic=topic,
            score_percent=score,
        )

    # Refresh readiness if quiz passed and promoted a skill
    updated_profile = get_stored_profile(state["user_id"])
    verified = [s.model_dump() for s in updated_profile.verified_skills] if updated_profile else state.get("verified_skills", [])
    unverified = [s.model_dump() for s in updated_profile.skill_gaps] if updated_profile else state.get("unverified_skills", [])

    readiness = state.get("readiness_score", 64.0)
    if result["passed"]:
        strategist = MarketStrategistAgent()
        recalc = await strategist.analyze_role_and_gaps(
            user_id=state["user_id"],
            target_role=state["target_role"],
            verified_skills=verified,
            unverified_skills=unverified,
        )
        readiness = recalc.readiness_score

    latest_logs = IN_MEMORY_STORE.get("agent_logs", {}).get(state["user_id"], [])
    latest_entry = (
        latest_logs[-1]
        if latest_logs
        else _make_log("Mentor & Evaluator", f"Evaluated {topic} at {result['score_percent']:.0f}%")
    )

    return {
        "verified_skills": verified,
        "unverified_skills": unverified,
        "readiness_score": readiness,
        "last_assessment": result,
        "needs_reroute": bool(result["needs_reroute"]),
        "active_agent": "mentor_evaluator_node",
        "agent_logs": [latest_entry],
    }


def _route_from_supervisor(state: CareerLoopState) -> str:
    target = state.get("active_agent", "FINISH")
    if target == "FINISH":
        return END
    if target in {
        "profiler_node",
        "market_strategist_node",
        "curriculum_architect_node",
        "mentor_evaluator_node",
    }:
        return target
    return END


def build_careerloop_graph():
    """Compile the 5-node hierarchical CareerLoop Supervisor StateGraph."""
    builder = StateGraph(CareerLoopState)

    builder.add_node("supervisor_node", supervisor_node)
    builder.add_node("profiler_node", profiler_node)
    builder.add_node("market_strategist_node", market_strategist_node)
    builder.add_node("curriculum_architect_node", curriculum_architect_node)
    builder.add_node("mentor_evaluator_node", mentor_evaluator_node)

    builder.add_edge(START, "supervisor_node")
    builder.add_conditional_edges(
        "supervisor_node",
        _route_from_supervisor,
        {
            "profiler_node": "profiler_node",
            "market_strategist_node": "market_strategist_node",
            "curriculum_architect_node": "curriculum_architect_node",
            "mentor_evaluator_node": "mentor_evaluator_node",
            END: END,
        },
    )

    builder.add_edge("profiler_node", "supervisor_node")
    builder.add_edge("market_strategist_node", "supervisor_node")
    builder.add_edge("curriculum_architect_node", "supervisor_node")
    builder.add_edge("mentor_evaluator_node", "supervisor_node")

    return builder.compile()


careerloop_graph = build_careerloop_graph()


def _build_initial_state(
    user_id: str,
    requested_action: str,
    target_role: Optional[str] = None,
    target_role_changed: bool = False,
    assessment_payload: Optional[dict[str, Any]] = None,
) -> tuple[CareerLoopState, list[dict[str, Any]]]:
    profile = get_stored_profile(user_id)
    if profile is None:
        raise ValueError(f"Profile '{user_id}' not found.")

    resolved_role = (target_role or profile.target_role).strip()
    verified = [s.model_dump() for s in profile.verified_skills]
    unverified = [s.model_dump() for s in profile.skill_gaps]
    existing_dag = get_stored_roadmap(user_id)
    existing_logs = list(IN_MEMORY_STORE["agent_logs"].get(user_id, []))

    initial_state: CareerLoopState = {
        "user_id": user_id,
        "full_name": profile.full_name,
        "target_role": resolved_role,
        "target_role_changed": target_role_changed,
        "verified_skills": verified,
        "unverified_skills": unverified,
        "readiness_score": profile.readiness_score,
        "skill_gaps": [s for s in unverified],
        "roadmap_dag": existing_dag.model_dump() if existing_dag and not target_role_changed else None,
        "last_assessment": None,
        "needs_reroute": False,
        "requested_action": requested_action,
        "active_agent": "",
        "step_count": 0,
        "role_summary": "",
        "matched_verified_skills": [s["skill_name"] for s in verified],
        "assessment_payload": assessment_payload,
        "agent_logs": [],
    }
    return initial_state, existing_logs


async def run_orchestrator(
    user_id: str,
    requested_action: str,
    target_role: Optional[str] = None,
    target_role_changed: bool = False,
    assessment_payload: Optional[dict[str, Any]] = None,
) -> CareerLoopState:
    """Hydrate CareerLoopState from storage and execute the compiled LangGraph orchestrator."""
    initial_state, existing_logs = _build_initial_state(
        user_id=user_id,
        requested_action=requested_action,
        target_role=target_role,
        target_role_changed=target_role_changed,
        assessment_payload=assessment_payload,
    )

    final_state: CareerLoopState = await careerloop_graph.ainvoke(
        initial_state,
        config={"recursion_limit": 12},
    )

    if existing_logs:
        final_state["agent_logs"] = IN_MEMORY_STORE["agent_logs"].get(user_id, final_state["agent_logs"])

    return final_state


async def stream_orchestrator(
    user_id: str,
    requested_action: str,
    target_role: Optional[str] = None,
    target_role_changed: bool = False,
    assessment_payload: Optional[dict[str, Any]] = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream real-time LangGraph agent transitions for Server-Sent Events (SSE)."""
    initial_state, _ = _build_initial_state(
        user_id=user_id,
        requested_action=requested_action,
        target_role=target_role,
        target_role_changed=target_role_changed,
        assessment_payload=assessment_payload,
    )

    latest_state: dict[str, Any] = dict(initial_state)
    async for chunk in careerloop_graph.astream(
        initial_state,
        config={"recursion_limit": 12},
    ):
        for node_name, node_output in chunk.items():
            if isinstance(node_output, dict):
                for key, val in node_output.items():
                    if key == "agent_logs" and isinstance(val, list):
                        latest_state["agent_logs"] = latest_state.get("agent_logs", []) + val
                    else:
                        latest_state[key] = val

                yield {
                    "event": "agent_step",
                    "data": {
                        "node": node_name,
                        "active_agent": node_output.get("active_agent", node_name),
                        "readiness_score": latest_state.get("readiness_score"),
                        "target_role": latest_state.get("target_role"),
                        "needs_reroute": latest_state.get("needs_reroute", False),
                        "logs": node_output.get("agent_logs", []),
                        "roadmap_dag": node_output.get("roadmap_dag"),
                    },
                }

    yield {
        "event": "complete",
        "data": {
            "user_id": user_id,
            "target_role": latest_state.get("target_role"),
            "readiness_score": latest_state.get("readiness_score"),
            "roadmap_dag": latest_state.get("roadmap_dag"),
            "last_assessment": latest_state.get("last_assessment"),
            "agent_logs": IN_MEMORY_STORE["agent_logs"].get(user_id, latest_state.get("agent_logs", [])),
        },
    }
