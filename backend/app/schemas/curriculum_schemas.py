from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ResourceItem(BaseModel):
    """Curated learning resource matched via pgvector or local semantic ranking."""

    id: str
    title: str
    url: str
    resource_type: Literal["course", "video", "documentation", "exercise"]
    target_skill: str
    difficulty: Literal["beginner", "intermediate", "advanced"]
    similarity: float = 1.0


class RoadmapNodeData(BaseModel):
    """Payload rendered inside each React Flow curriculum node."""

    label: str
    skill_name: str
    status: Literal["verified", "in_progress", "locked", "remediation"]
    badge_text: Optional[str] = None
    estimated_hours: int = Field(default=6, ge=1, le=80)
    description: str
    resources: list[ResourceItem] = Field(default_factory=list)
    is_remediation: bool = False
    mastery_score: Optional[float] = None


class ReactFlowNode(BaseModel):
    id: str
    type: str = "curriculumNode"
    position: dict[str, float]
    data: RoadmapNodeData


class ReactFlowEdge(BaseModel):
    id: str
    source: str
    target: str
    animated: bool = False
    label: Optional[str] = None
    style: Optional[dict[str, Any]] = None


class RoadmapDAG(BaseModel):
    """Complete Directed Acyclic Graph formatted directly for @xyflow/react."""

    user_id: str
    target_role: str
    nodes: list[ReactFlowNode]
    edges: list[ReactFlowEdge]
    rerouted: bool = False
    reroute_reason: Optional[str] = None


class BuildRoadmapRequest(BaseModel):
    user_id: str
    target_role: Optional[str] = None


class RoadmapResponse(BaseModel):
    user_id: str
    target_role: str
    readiness_score: float
    roadmap: RoadmapDAG
    agent_logs: list[dict[str, Any]] = Field(default_factory=list)
