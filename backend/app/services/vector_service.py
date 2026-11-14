from typing import Any, Optional

from app.core.config import get_supabase_client
from app.schemas.curriculum_schemas import ResourceItem

CURATED_RESOURCES: list[dict[str, Any]] = [
    {
        "id": "a1000001-0000-4000-8000-000000000001",
        "title": "JavaScript Fundamentals Crash Course — Variables, Scope & Control Flow",
        "url": "https://javascript.info/first-steps",
        "resource_type": "documentation",
        "target_skill": "JavaScript Fundamentals",
        "difficulty": "beginner",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000002",
        "title": "MDN JavaScript Basics & DOM Manipulation Lab",
        "url": "https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/JavaScript_basics",
        "resource_type": "exercise",
        "target_skill": "JavaScript Fundamentals",
        "difficulty": "beginner",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000003",
        "title": "Modern JavaScript ES6+: Destructuring, Modules, Promises & Async/Await",
        "url": "https://javascript.info/async",
        "resource_type": "course",
        "target_skill": "JavaScript ES6+ & Async",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000004",
        "title": "Understanding the JavaScript Event Loop & Asynchronous Patterns",
        "url": "https://www.youtube.com/watch?v=8aGhZQkoFbQ",
        "resource_type": "video",
        "target_skill": "JavaScript ES6+ & Async",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000005",
        "title": "Official React 19 Documentation: Thinking in React & Hooks Mastery",
        "url": "https://react.dev/learn",
        "resource_type": "documentation",
        "target_skill": "React 19",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000006",
        "title": "Build an Interactive Task Dashboard with React State & Effects",
        "url": "https://react.dev/learn/managing-state",
        "resource_type": "exercise",
        "target_skill": "React 19",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000007",
        "title": "Node.js & Express REST API Architecture Guide",
        "url": "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs",
        "resource_type": "course",
        "target_skill": "Node.js & Express",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000008",
        "title": "Express Middleware, Routing & PostgreSQL Integration Lab",
        "url": "https://expressjs.com/en/guide/writing-middleware.html",
        "resource_type": "exercise",
        "target_skill": "Node.js & Express",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000009",
        "title": "Python Type Hints, AsyncIO & Clean Backend Patterns",
        "url": "https://docs.python.org/3/library/asyncio.html",
        "resource_type": "documentation",
        "target_skill": "Python",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000010",
        "title": "PostgreSQL Indexing, Joins & Query Optimization Workshop",
        "url": "https://www.postgresql.org/docs/current/tutorial.html",
        "resource_type": "documentation",
        "target_skill": "SQL",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000011",
        "title": "Modern CSS Layout: Flexbox, Grid & Responsive Design Systems",
        "url": "https://web.dev/learn/css",
        "resource_type": "course",
        "target_skill": "HTML & CSS",
        "difficulty": "beginner",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000012",
        "title": "PyTorch Deep Learning Fundamentals & Tensor Pipelines",
        "url": "https://pytorch.org/tutorials/beginner/basics/intro.html",
        "resource_type": "course",
        "target_skill": "PyTorch & Deep Learning",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000013",
        "title": "LangGraph Stateful Multi-Agent Orchestration Guide",
        "url": "https://langchain-ai.github.io/langgraph/",
        "resource_type": "documentation",
        "target_skill": "LLM Orchestration & LangGraph",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000014",
        "title": "pgvector & Semantic RAG Retrieval Engineering",
        "url": "https://supabase.com/docs/guides/ai/vector-columns",
        "resource_type": "documentation",
        "target_skill": "Vector Databases & RAG",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000015",
        "title": "FastAPI Production Deployment & Streaming Inference APIs",
        "url": "https://fastapi.tiangolo.com/tutorial/",
        "resource_type": "documentation",
        "target_skill": "FastAPI & Model Deployment",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000016",
        "title": "System Design Primer: Caching, Load Balancing & Queues",
        "url": "https://github.com/donnemartin/system-design-primer",
        "resource_type": "course",
        "target_skill": "System Design & Caching",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000017",
        "title": "Docker Containers & Microservice Compose Lab",
        "url": "https://docs.docker.com/get-started/",
        "resource_type": "exercise",
        "target_skill": "Docker & Microservices",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000018",
        "title": "Statistical Modeling & Hypothesis Testing in Python",
        "url": "https://www.statsmodels.org/stable/gettingstarted.html",
        "resource_type": "documentation",
        "target_skill": "Statistical Modeling",
        "difficulty": "intermediate",
    },
    {
        "id": "a1000001-0000-4000-8000-000000000019",
        "title": "Scikit-Learn Supervised & Unsupervised ML Pipelines",
        "url": "https://scikit-learn.org/stable/user_guide.html",
        "resource_type": "course",
        "target_skill": "Machine Learning & Scikit-Learn",
        "difficulty": "intermediate",
    },
]

_embedder: Optional[Any] = None
_embedder_attempted: bool = False


def _get_embedder() -> Optional[Any]:
    """Lazy-load FastEmbed (BAAI/bge-small-en-v1.5, 384-dim) on first query."""
    global _embedder, _embedder_attempted
    if _embedder_attempted:
        return _embedder
    _embedder_attempted = True
    try:
        from fastembed import TextEmbedding

        _embedder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    except Exception:
        _embedder = None
    return _embedder


def _embed_text(text: str) -> Optional[list[float]]:
    embedder = _get_embedder()
    if embedder is None:
        return None
    try:
        vectors = list(embedder.embed([text]))
        if vectors:
            return [float(x) for x in vectors[0]]
    except Exception:
        return None
    return None


def _token_similarity(query: str, candidate: str) -> float:
    q_tokens = {t for t in query.lower().replace("&", " ").replace("+", " ").split() if len(t) > 1}
    c_tokens = {t for t in candidate.lower().replace("&", " ").replace("+", " ").split() if len(t) > 1}
    if not q_tokens or not c_tokens:
        return 0.0
    overlap = len(q_tokens & c_tokens)
    return overlap / max(len(q_tokens), 1)


def search_learning_resources(skill_query: str, limit: int = 2) -> list[ResourceItem]:
    """
    Retrieve top curated learning resources via Supabase pgvector RPC (`match_learning_resources`)
    with lazy FastEmbed BAAI/bge-small-en-v1.5 embeddings, seamlessly falling back to local
    curated ranking if Supabase or model weights are unavailable.
    """
    supabase = get_supabase_client()
    if supabase is not None:
        embedding = _embed_text(skill_query)
        if embedding is not None:
            try:
                rpc_res = supabase.rpc(
                    "match_learning_resources",
                    {
                        "query_embedding": embedding,
                        "match_threshold": 0.45,
                        "match_count": limit,
                    },
                ).execute()
                if rpc_res.data:
                    return [
                        ResourceItem(
                            id=str(row["id"]),
                            title=row["title"],
                            url=row["url"],
                            resource_type=row["resource_type"],
                            target_skill=row["target_skill"],
                            difficulty=row["difficulty"],
                            similarity=round(float(row.get("similarity", 0.9)), 3),
                        )
                        for row in rpc_res.data[:limit]
                    ]
            except Exception:
                pass

    # Local curated semantic/token ranking fallback
    q_low = skill_query.strip().lower()
    scored: list[tuple[float, dict[str, Any]]] = []
    for res in CURATED_RESOURCES:
        target = res["target_skill"].lower()
        title = res["title"].lower()
        score = 0.0
        if target == q_low:
            score = 0.98
        elif q_low in target or target in q_low:
            score = 0.91
        else:
            score = 0.65 * _token_similarity(q_low, target) + 0.35 * _token_similarity(q_low, title)
        if score > 0.15:
            scored.append((score, res))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    if not scored:
        # Return general foundational docs if custom skill is queried
        return [
            ResourceItem(
                id=f"custom-{abs(hash(skill_query)) % 100000}",
                title=f"{skill_query} Official Documentation & Practical Guide",
                url=f"https://developer.mozilla.org/en-US/search?q={skill_query.replace(' ', '+')}",
                resource_type="documentation",
                target_skill=skill_query,
                difficulty="intermediate",
                similarity=0.82,
            )
        ]

    return [
        ResourceItem(
            id=item["id"],
            title=item["title"],
            url=item["url"],
            resource_type=item["resource_type"],
            target_skill=item["target_skill"],
            difficulty=item["difficulty"],
            similarity=round(min(score, 0.99), 3),
        )
        for score, item in scored[:limit]
    ]
