-- ============================================================================
-- CareerLoop Supabase PostgreSQL + pgvector Schema & Seed Data
-- ============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Core Tables
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    batch_cohort TEXT,
    target_role TEXT NOT NULL,
    readiness_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    raw_resume_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    proficiency_level TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    category TEXT NOT NULL,
    UNIQUE (user_id, skill_name)
);

CREATE TABLE IF NOT EXISTS roadmaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_role TEXT NOT NULL,
    dag_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    dag_edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, target_role)
);

CREATE TABLE IF NOT EXISTS learning_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    target_skill TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    embedding vector(384)
);

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    score_percent NUMERIC(5, 2) NOT NULL,
    passed BOOLEAN NOT NULL,
    triggered_reroute BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    action_summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id ON roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user_id_created ON agent_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_resources_embedding
    ON learning_resources
    USING hnsw (embedding vector_cosine_ops);

-- 4. Semantic Vector Search RPC Function (pgvector)
CREATE OR REPLACE FUNCTION match_learning_resources(
    query_embedding vector(384),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    url TEXT,
    resource_type TEXT,
    target_skill TEXT,
    difficulty TEXT,
    similarity float
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        lr.id,
        lr.title,
        lr.url,
        lr.resource_type,
        lr.target_skill,
        lr.difficulty,
        1 - (lr.embedding <=> query_embedding) AS similarity
    FROM learning_resources lr
    WHERE lr.embedding IS NOT NULL
      AND 1 - (lr.embedding <=> query_embedding) >= match_threshold
    ORDER BY lr.embedding <=> query_embedding ASC
    LIMIT match_count;
$$;

-- 5. Seed Curated Learning Resources (JavaScript Fundamentals, JavaScript ES6+, React, Node.js)
INSERT INTO learning_resources (id, title, url, resource_type, target_skill, difficulty)
VALUES
    (
        'a1000001-0000-4000-8000-000000000001',
        'JavaScript Fundamentals Crash Course — Variables, Scope & Control Flow',
        'https://javascript.info/first-steps',
        'documentation',
        'JavaScript Fundamentals',
        'beginner'
    ),
    (
        'a1000001-0000-4000-8000-000000000002',
        'MDN JavaScript Basics & DOM Manipulation Lab',
        'https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/JavaScript_basics',
        'exercise',
        'JavaScript Fundamentals',
        'beginner'
    ),
    (
        'a1000001-0000-4000-8000-000000000003',
        'Modern JavaScript ES6+: Destructuring, Modules, Promises & Async/Await',
        'https://javascript.info/async',
        'course',
        'JavaScript ES6+',
        'intermediate'
    ),
    (
        'a1000001-0000-4000-8000-000000000004',
        'Understanding the JavaScript Event Loop & Asynchronous Patterns',
        'https://www.youtube.com/watch?v=8aGhZQkoFbQ',
        'video',
        'JavaScript ES6+',
        'intermediate'
    ),
    (
        'a1000001-0000-4000-8000-000000000005',
        'Official React Documentation: Thinking in React & Hooks Mastery',
        'https://react.dev/learn',
        'documentation',
        'React',
        'intermediate'
    ),
    (
        'a1000001-0000-4000-8000-000000000006',
        'Build an Interactive Task Dashboard with React State & Effects',
        'https://react.dev/learn/managing-state',
        'exercise',
        'React',
        'intermediate'
    ),
    (
        'a1000001-0000-4000-8000-000000000007',
        'Node.js & Express REST API Architecture Guide',
        'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs',
        'course',
        'Node.js',
        'intermediate'
    ),
    (
        'a1000001-0000-4000-8000-000000000008',
        'Node.js Async Streams, Middleware & PostgreSQL Integration Lab',
        'https://expressjs.com/en/guide/writing-middleware.html',
        'exercise',
        'Node.js',
        'intermediate'
    )
ON CONFLICT (id) DO NOTHING;

-- 6. Seed 1-Click Demo Persona: Sophia Vance (Batch 2027, Target: Full Stack Developer)
INSERT INTO profiles (id, full_name, email, batch_cohort, target_role, readiness_score, raw_resume_json)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'Sophia Vance',
    'sophia.vance@university.edu',
    'Batch 2027',
    'Full Stack Developer',
    45.00,
    '{
        "full_name": "Sophia Vance",
        "headline": "Computer Science Undergraduate (Class of 2027) | Python & Data Systems Builder",
        "education": [
            {
                "institution": "Pacific Institute of Technology",
                "degree": "B.S. in Computer Science",
                "graduation_year": "2027"
            }
        ],
        "experience": [
            {
                "company": "Campus Data Lab",
                "role": "Undergraduate Research Assistant",
                "duration": "May 2025 - Present",
                "highlights": [
                    "Built automated Python ETL pipelines processing 120k student survey records.",
                    "Designed normalized PostgreSQL queries and indexing strategies for analytics."
                ]
            }
        ],
        "projects": [
            {
                "name": "CoursePulse SQL Explorer",
                "description": "Python and SQLite/PostgreSQL web utility for querying university course prerequisites.",
                "technologies": ["Python", "SQL", "HTML & CSS"]
            },
            {
                "name": "StudyMetrics Dashboard",
                "description": "Static HTML/CSS portfolio and grade calculator with clean responsive layouts.",
                "technologies": ["HTML & CSS", "Python"]
            }
        ],
        "certifications": [
            "PCAP: Certified Associate in Python Programming",
            "PostgreSQL Relational Database Foundations"
        ],
        "claimed_skills": [
            {"skill_name": "Python", "self_reported_confidence": "Advanced", "category": "Backend & Scripting"},
            {"skill_name": "SQL", "self_reported_confidence": "Intermediate", "category": "Databases"},
            {"skill_name": "HTML & CSS", "self_reported_confidence": "Intermediate", "category": "Frontend Foundations"}
        ],
        "suggested_target_role": "Full Stack Developer"
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    batch_cohort = EXCLUDED.batch_cohort,
    target_role = EXCLUDED.target_role,
    readiness_score = EXCLUDED.readiness_score,
    raw_resume_json = EXCLUDED.raw_resume_json;

-- Verified Baseline Skills + Identified Missing Skills for Sophia Vance
INSERT INTO user_skills (user_id, skill_name, proficiency_level, is_verified, verification_score, category)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'Python', 'Verified', TRUE, 92.00, 'Backend & Scripting'),
    ('11111111-1111-4111-8111-111111111111', 'SQL', 'Verified', TRUE, 88.00, 'Databases'),
    ('11111111-1111-4111-8111-111111111111', 'HTML & CSS', 'Verified', TRUE, 85.00, 'Frontend Foundations'),
    ('11111111-1111-4111-8111-111111111111', 'JavaScript', 'Missing', FALSE, 0.00, 'Frontend Engineering'),
    ('11111111-1111-4111-8111-111111111111', 'React', 'Missing', FALSE, 0.00, 'Frontend Engineering'),
    ('11111111-1111-4111-8111-111111111111', 'Node.js', 'Missing', FALSE, 0.00, 'Backend Engineering')
ON CONFLICT (user_id, skill_name) DO UPDATE SET
    proficiency_level = EXCLUDED.proficiency_level,
    is_verified = EXCLUDED.is_verified,
    verification_score = EXCLUDED.verification_score,
    category = EXCLUDED.category;

-- Initial Agent Collaboration Logs for Demo Persona
INSERT INTO agent_logs (user_id, agent_name, action_summary)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'Profiler Agent', 'Extracted 3 verified baseline skills and 2 projects from Sophia Vance profile'),
    ('11111111-1111-4111-8111-111111111111', 'Profiler Agent', 'Verified Python (92%), SQL (88%), and HTML & CSS (85%) via 60-second diagnostic'),
    ('11111111-1111-4111-8111-111111111111', 'Gap Strategist', 'Flagged JavaScript, React, and Node.js as critical gaps for Full Stack Developer');
