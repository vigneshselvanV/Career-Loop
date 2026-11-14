import re
from typing import Any, Optional

from app.agents.profiler_agent import IN_MEMORY_STORE, _persist_logs
from app.core.config import get_supabase_client
from app.schemas.curriculum_schemas import (
    ReactFlowEdge,
    ReactFlowNode,
    RoadmapDAG,
    RoadmapNodeData,
)
from app.schemas.profiler_schemas import AgentLogEntry
from app.services.vector_service import search_learning_resources


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "node"


def _persist_roadmap(user_id: str, roadmap: RoadmapDAG) -> None:
    IN_MEMORY_STORE.setdefault("roadmaps", {})[user_id] = roadmap.model_dump()
    supabase = get_supabase_client()
    if supabase is not None:
        try:
            supabase.table("roadmaps").upsert(
                {
                    "user_id": user_id,
                    "target_role": roadmap.target_role,
                    "dag_nodes": [n.model_dump() for n in roadmap.nodes],
                    "dag_edges": [e.model_dump() for e in roadmap.edges],
                },
                on_conflict="user_id,target_role",
            ).execute()
        except Exception:
            pass


def get_stored_roadmap(user_id: str) -> Optional[RoadmapDAG]:
    cached = IN_MEMORY_STORE.get("roadmaps", {}).get(user_id)
    if cached:
        return RoadmapDAG(**cached)

    supabase = get_supabase_client()
    if supabase is not None:
        try:
            res = (
                supabase.table("roadmaps")
                .select("*")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                dag = RoadmapDAG(
                    user_id=user_id,
                    target_role=row["target_role"],
                    nodes=[ReactFlowNode(**n) for n in row["dag_nodes"]],
                    edges=[ReactFlowEdge(**e) for e in row["dag_edges"]],
                )
                IN_MEMORY_STORE.setdefault("roadmaps", {})[user_id] = dag.model_dump()
                return dag
        except Exception:
            pass
    return None


class CurriculumArchitectAgent:
    """Sub-Agent 3: Builds interactive React Flow DAG learning roadmaps and injects remediation prerequisites."""

    async def build_or_reroute_roadmap(
        self,
        user_id: str,
        target_role: str,
        verified_skills: list[dict[str, Any]],
        skill_gaps: list[dict[str, Any]],
        existing_dag: Optional[dict[str, Any]] = None,
        reroute_topic: Optional[str] = None,
        reroute_score: Optional[float] = None,
    ) -> RoadmapDAG:
        # Case 1: Adaptive Re-Routing — inject remediation prerequisite node before failed topic
        if reroute_topic and existing_dag:
            current_dag = RoadmapDAG(**existing_dag)
            return await self._inject_remediation_node(
                user_id=user_id,
                dag=current_dag,
                failed_topic=reroute_topic,
                score_percent=reroute_score if reroute_score is not None else 40.0,
            )

        # Case 2: Fresh DAG generation from verified baseline + prioritized gaps
        nodes: list[ReactFlowNode] = []
        edges: list[ReactFlowEdge] = []

        verified_list = verified_skills[:4]
        baseline_ids: list[str] = []
        y_start = 40.0
        y_step = 135.0

        for idx, skill in enumerate(verified_list):
            skill_name = str(skill.get("skill_name", "Core Skill"))
            node_id = f"node-verified-{_slugify(skill_name)}"
            baseline_ids.append(node_id)
            score_val = float(skill.get("verification_score", 90.0))
            resources = search_learning_resources(skill_name, limit=2)
            nodes.append(
                ReactFlowNode(
                    id=node_id,
                    type="curriculumNode",
                    position={"x": 40.0, "y": y_start + idx * y_step},
                    data=RoadmapNodeData(
                        label=skill_name,
                        skill_name=skill_name,
                        status="verified",
                        badge_text=f"Verified · {score_val:.0f}%",
                        estimated_hours=2,
                        description=f"Verified baseline competency in {skill_name} ready for {target_role} projects.",
                        resources=resources,
                        is_remediation=False,
                        mastery_score=score_val,
                    ),
                )
            )

        if not baseline_ids:
            fallback_id = "node-verified-foundation"
            baseline_ids.append(fallback_id)
            nodes.append(
                ReactFlowNode(
                    id=fallback_id,
                    type="curriculumNode",
                    position={"x": 40.0, "y": 140.0},
                    data=RoadmapNodeData(
                        label="Engineering Foundations",
                        skill_name="Engineering Foundations",
                        status="verified",
                        badge_text="Baseline Ready",
                        estimated_hours=2,
                        description="Core problem-solving and environment setup baseline.",
                        resources=search_learning_resources("Python", limit=1),
                    ),
                )
            )

        # Chain gap nodes sequentially across columns so dependencies read clearly left-to-right
        gaps_to_map = skill_gaps[:4]
        prev_column_ids = baseline_ids
        x_base = 370.0
        x_step = 320.0
        center_y = y_start + max(len(verified_list) - 1, 0) * y_step * 0.45

        for g_idx, gap in enumerate(gaps_to_map):
            gap_name = str(gap.get("skill_name", f"Skill {g_idx + 1}"))
            gap_id = f"node-gap-{_slugify(gap_name)}"
            is_first_gap = g_idx == 0
            resources = search_learning_resources(gap_name, limit=2)
            hours = 12 if gap.get("priority") == "Critical" else 8

            nodes.append(
                ReactFlowNode(
                    id=gap_id,
                    type="curriculumNode",
                    position={"x": x_base + g_idx * x_step, "y": center_y},
                    data=RoadmapNodeData(
                        label=gap_name,
                        skill_name=gap_name,
                        status="in_progress" if is_first_gap else "locked",
                        badge_text="Next focus" if is_first_gap else f"{gap.get('priority', 'High')} priority",
                        estimated_hours=hours,
                        description=str(
                            gap.get(
                                "reason",
                                f"Master {gap_name} to satisfy {target_role} industry benchmarks.",
                            )
                        ),
                        resources=resources,
                        is_remediation=False,
                    ),
                )
            )

            for src_id in prev_column_ids:
                edges.append(
                    ReactFlowEdge(
                        id=f"edge-{src_id}-to-{gap_id}",
                        source=src_id,
                        target=gap_id,
                        animated=is_first_gap,
                    )
                )
            prev_column_ids = [gap_id]

        # Add final Role Capstone node
        capstone_id = f"node-capstone-{_slugify(target_role)}"
        capstone_x = x_base + len(gaps_to_map) * x_step
        nodes.append(
            ReactFlowNode(
                id=capstone_id,
                type="curriculumNode",
                position={"x": capstone_x, "y": center_y},
                data=RoadmapNodeData(
                    label=f"{target_role} Capstone",
                    skill_name=f"{target_role} Capstone",
                    status="locked",
                    badge_text="Role readiness milestone",
                    estimated_hours=16,
                    description=(
                        f"Integrate your verified strengths and newly mastered modules into a production {target_role} deliverable."
                    ),
                    resources=[],
                ),
            )
        )
        for src_id in prev_column_ids:
            edges.append(
                ReactFlowEdge(
                    id=f"edge-{src_id}-to-{capstone_id}",
                    source=src_id,
                    target=capstone_id,
                    animated=False,
                )
            )

        dag = RoadmapDAG(
            user_id=user_id,
            target_role=target_role,
            nodes=nodes,
            edges=edges,
            rerouted=False,
        )
        _persist_roadmap(user_id, dag)

        log_entry = AgentLogEntry(
            agent_name="Curriculum Architect",
            action_summary=(
                f"Generated {len(nodes)}-node DAG roadmap for {target_role} with curated vector-matched resources"
            ),
        )
        _persist_logs(user_id, [log_entry])
        return dag

    async def _inject_remediation_node(
        self,
        user_id: str,
        dag: RoadmapDAG,
        failed_topic: str,
        score_percent: float,
    ) -> RoadmapDAG:
        """
        Dynamically insert a prerequisite remediation node before `failed_topic`,
        rewire incoming edges, and shift downstream nodes cleanly to avoid overlap.
        """
        failed_lower = failed_topic.strip().lower()
        target_node: Optional[ReactFlowNode] = None
        for node in dag.nodes:
            if (
                node.data.skill_name.lower() == failed_lower
                or failed_lower in node.data.skill_name.lower()
                or node.data.skill_name.lower() in failed_lower
            ):
                target_node = node
                break

        if target_node is None:
            # Default to first non-verified node if exact string differs
            target_node = next(
                (n for n in dag.nodes if n.data.status != "verified"),
                dag.nodes[0],
            )

        # Determine remediation label & resources
        if "javascript" in target_node.data.skill_name.lower() or "js" in failed_lower:
            remediation_label = "JavaScript Fundamentals"
            remediation_desc = (
                "Focused crash course covering variables, closures, scope, array methods, and event loop basics "
                "before tackling ES6+ & Async patterns."
            )
        else:
            remediation_label = f"{target_node.data.skill_name} Fundamentals"
            remediation_desc = (
                f"Targeted prerequisite refresher covering core concepts required to pass {target_node.data.skill_name}."
            )

        remediation_id = f"node-remediation-{_slugify(remediation_label)}"
        badge_text = f"Added after {score_percent:.0f}% quiz score"

        # If already injected, update its badge and return cleanly
        existing_rem = next((n for n in dag.nodes if n.id == remediation_id), None)
        if existing_rem is not None:
            existing_rem.data.badge_text = badge_text
            existing_rem.data.status = "remediation"
            dag.rerouted = True
            dag.reroute_reason = f"Updated prerequisite remediation after {score_percent:.0f}% score on {failed_topic}"
            _persist_roadmap(user_id, dag)
            return dag

        insert_x = target_node.position["x"]
        insert_y = target_node.position["y"]
        shift_delta = 320.0

        # Shift target node and all downstream nodes right by 320px for crisp spacing
        for node in dag.nodes:
            if node.position["x"] >= insert_x - 10.0 and node.data.status != "verified":
                node.position["x"] = node.position["x"] + shift_delta

        # Demote target node to locked until remediation completes
        target_node.data.status = "locked"
        target_node.data.badge_text = f"Unlocks after {remediation_label}"

        remediation_resources = search_learning_resources(remediation_label, limit=2)
        remediation_node = ReactFlowNode(
            id=remediation_id,
            type="curriculumNode",
            position={"x": insert_x, "y": insert_y},
            data=RoadmapNodeData(
                label=remediation_label,
                skill_name=remediation_label,
                status="remediation",
                badge_text=badge_text,
                estimated_hours=6,
                description=remediation_desc,
                resources=remediation_resources,
                is_remediation=True,
                mastery_score=score_percent,
            ),
        )

        # Rewire edges pointing into target_node so they point into remediation_node instead
        new_edges: list[ReactFlowEdge] = []
        for edge in dag.edges:
            if edge.target == target_node.id:
                new_edges.append(
                    ReactFlowEdge(
                        id=f"edge-{edge.source}-to-{remediation_id}",
                        source=edge.source,
                        target=remediation_id,
                        animated=True,
                    )
                )
            else:
                new_edges.append(edge)

        # Connect remediation_node -> target_node
        new_edges.append(
            ReactFlowEdge(
                id=f"edge-{remediation_id}-to-{target_node.id}",
                source=remediation_id,
                target=target_node.id,
                animated=True,
                label="Prerequisite",
            )
        )

        dag.nodes.append(remediation_node)
        dag.edges = new_edges
        dag.rerouted = True
        dag.reroute_reason = (
            f"Injected '{remediation_label}' before '{target_node.data.skill_name}' "
            f"after {score_percent:.0f}% assessment score"
        )

        _persist_roadmap(user_id, dag)

        log_entry = AgentLogEntry(
            agent_name="Curriculum Architect",
            action_summary=(
                f"Injected '{remediation_label}' prerequisite node before '{target_node.data.skill_name}' "
                f"({badge_text})"
            ),
        )
        _persist_logs(user_id, [log_entry])
        return dag
