import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'cohere/north-mini-code:free';
const FASTAPI_URL = (process.env.FASTAPI_URL || '').replace(/\/$/, '');

const app = express();
app.use(express.json({ limit: '2mb' }));

interface AuthContext {
  uid: string | null;
  email: string | null;
}

function parseBearerTokenContext(req: Request): AuthContext {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { uid: null, email: null };
  }
  const token = header.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { uid: null, email: null };
  }
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<
      string,
      unknown
    >;
    return {
      uid: typeof decoded.user_id === 'string' ? decoded.user_id : typeof decoded.sub === 'string' ? decoded.sub : null,
      email: typeof decoded.email === 'string' ? decoded.email : null,
    };
  } catch {
    return { uid: null, email: null };
  }
}

function getValidOpenRouterKey(): string | null {
  const key = (process.env.OPENROUTER_API_KEY || '').trim();
  if (
    !key ||
    key === 'MY_OPENROUTER_API_KEY' ||
    key.startsWith('sk-or-v1-your')
  ) {
    return null;
  }
  return key;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callOpenRouterJson<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.2,
  maxTokens = 1600
): Promise<T | null> {
  const apiKey = getValidOpenRouterKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.APP_URL || `http://localhost:${PORT}`,
        'X-Title': 'CareerLoop',
      },
      body: JSON.stringify({
        model: DEFAULT_OPENROUTER_MODEL,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: `${systemPrompt}\nAlways respond with strictly valid JSON only.` },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = extractJsonObject(content);
    return parsed as T | null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const ROLE_SKILL_DEFAULTS: Record<string, Array<{ skill_name: string; category: string }>> = {
  'Full Stack Developer': [
    { skill_name: 'Python', category: 'Backend & Scripting' },
    { skill_name: 'SQL', category: 'Databases' },
    { skill_name: 'HTML & CSS', category: 'Frontend Foundations' },
    { skill_name: 'JavaScript ES6+ & Async', category: 'Frontend Engineering' },
    { skill_name: 'React 19', category: 'Frontend Engineering' },
    { skill_name: 'Node.js & Express', category: 'Backend Engineering' },
  ],
  'AI Engineer': [
    { skill_name: 'Python', category: 'Core' },
    { skill_name: 'SQL', category: 'Databases' },
    { skill_name: 'PyTorch & Deep Learning', category: 'Framework' },
    { skill_name: 'LLM Orchestration & LangGraph', category: 'Architecture' },
    { skill_name: 'Vector Databases & RAG', category: 'Architecture' },
  ],
  'Backend Engineer': [
    { skill_name: 'Python', category: 'Core' },
    { skill_name: 'SQL', category: 'Databases' },
    { skill_name: 'Node.js & Express', category: 'Backend Engineering' },
    { skill_name: 'System Design & Caching', category: 'Architecture' },
    { skill_name: 'Docker & Microservices', category: 'Tooling' },
  ],
  'Data Scientist': [
    { skill_name: 'Python', category: 'Core' },
    { skill_name: 'SQL', category: 'Databases' },
    { skill_name: 'Statistical Modeling', category: 'Core' },
    { skill_name: 'Machine Learning & Scikit-Learn', category: 'Framework' },
    { skill_name: 'Data Visualization', category: 'Tooling' },
  ],
};

function deterministicExtractSkills(
  targetRole: string,
  backgroundNote: string,
  selectedSkills: string[]
) {
  const seen = new Set<string>();
  const skills: Array<{
    skill_name: string;
    self_reported_confidence: 'Beginner' | 'Intermediate' | 'Advanced';
    category: string;
  }> = [];

  for (const raw of selectedSkills) {
    const clean = raw.trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      skills.push({
        skill_name: clean,
        self_reported_confidence: 'Intermediate',
        category: 'Self-Reported',
      });
    }
  }

  const lower = backgroundNote.toLowerCase();
  const keywordMatchers: Array<[string, string, string]> = [
    ['python', 'Python', 'Backend & Scripting'],
    ['sql', 'SQL', 'Databases'],
    ['postgres', 'SQL', 'Databases'],
    ['html', 'HTML & CSS', 'Frontend Foundations'],
    ['css', 'HTML & CSS', 'Frontend Foundations'],
    ['javascript', 'JavaScript ES6+ & Async', 'Frontend Engineering'],
    ['typescript', 'TypeScript', 'Frontend Engineering'],
    ['react', 'React 19', 'Frontend Engineering'],
    ['node', 'Node.js & Express', 'Backend Engineering'],
    ['fastapi', 'FastAPI & Model Deployment', 'Backend Engineering'],
    ['pytorch', 'PyTorch & Deep Learning', 'Framework'],
    ['docker', 'Docker & Microservices', 'Tooling'],
  ];

  for (const [token, name, category] of keywordMatchers) {
    if (lower.includes(token) && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      skills.push({
        skill_name: name,
        self_reported_confidence: 'Intermediate',
        category,
      });
    }
  }

  if (skills.length === 0) {
    const defaults = ROLE_SKILL_DEFAULTS[targetRole] || ROLE_SKILL_DEFAULTS['Full Stack Developer'];
    for (const item of defaults.slice(0, 3)) {
      skills.push({
        skill_name: item.skill_name,
        self_reported_confidence: 'Beginner',
        category: item.category,
      });
    }
  }

  return skills.slice(0, 8);
}

function buildDiagnosticForSkills(
  targetRole: string,
  skills: Array<{ skill_name: string }>
) {
  const tested = skills.map((s) => s.skill_name).slice(0, 3);
  const pad = ['Python', 'SQL', 'HTML & CSS'];
  for (const item of pad) {
    if (tested.length >= 3) break;
    if (!tested.some((t) => t.toLowerCase() === item.toLowerCase())) {
      tested.push(item);
    }
  }

  const bank: Record<
    string,
    { q: string; opts: string[]; idx: number; exp: string }
  > = {
    python: {
      q: 'Which Python data structure provides O(1) average lookup for membership checks?',
      opts: ['list', 'set', 'tuple', 'deque'],
      idx: 1,
      exp: 'A Python set is hash-backed for O(1) average-case membership lookup.',
    },
    sql: {
      q: 'Which SQL clause filters grouped rows after a GROUP BY aggregation?',
      opts: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
      idx: 1,
      exp: 'HAVING filters aggregated groups, whereas WHERE filters individual rows prior to grouping.',
    },
    html: {
      q: 'Which CSS Flexbox property aligns items along the main axis?',
      opts: ['align-items', 'justify-content', 'flex-wrap', 'place-self'],
      idx: 1,
      exp: 'justify-content distributes flex items along the main axis.',
    },
    javascript: {
      q: 'What does marking a JavaScript function `async` guarantee?',
      opts: [
        'It always returns a Promise',
        'It executes on a dedicated OS thread',
        'Loops inside it become non-blocking automatically',
        'Thrown errors are suppressed silently',
      ],
      idx: 0,
      exp: 'An async function always wraps its return value or rejection inside a Promise.',
    },
    react: {
      q: 'Why should React state updates treat objects and arrays immutably?',
      opts: [
        'React detects state changes via shallow reference comparison',
        'JavaScript forbids mutating arrays inside hooks',
        'Immutable state auto-syncs to PostgreSQL',
        'JSX only renders frozen objects',
      ],
      idx: 0,
      exp: 'Replacing object references lets React detect updates reliably and trigger re-renders.',
    },
    node: {
      q: 'In Express, why do middleware functions call `next()`?',
      opts: [
        'Restart the server process',
        'Pass control to the next middleware or route handler',
        'Close the database pool',
        'Send an HTTP 200 JSON response automatically',
      ],
      idx: 1,
      exp: 'Calling next() passes control to the subsequent middleware in the request pipeline.',
    },
  };

  const questions = tested.slice(0, 3).map((skill, idx) => {
    const low = skill.toLowerCase();
    const matchedKey = Object.keys(bank).find((k) => low.includes(k));
    const entry = matchedKey
      ? bank[matchedKey]
      : {
          q: `Which engineering practice best supports maintainability when building with ${skill}?`,
          opts: [
            'Clear modular boundaries, input validation, and automated tests',
            'Duplicating logic across global files',
            'Ignoring edge cases and asynchronous errors',
            'Hardcoding credentials inside source code',
          ],
          idx: 0,
          exp: `Modular structure, validation, and testing are core engineering practices in ${skill}.`,
        };
    return {
      id: `onb-q${idx + 1}`,
      skill_tested: skill,
      question: entry.q,
      options: entry.opts,
      correct_index: entry.idx,
      explanation: entry.exp,
    };
  });

  return {
    target_role: targetRole,
    estimated_seconds: 60,
    questions,
  };
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'CareerLoop API Proxy',
    model: DEFAULT_OPENROUTER_MODEL,
    openrouter_configured: Boolean(getValidOpenRouterKey()),
    fastapi_proxy: FASTAPI_URL || null,
  });
});

app.post('/api/onboarding/analyze', async (req: Request, res: Response) => {
  const authCtx = parseBearerTokenContext(req);
  const body = (req.body || {}) as Record<string, unknown>;
  const fullName = String(body.full_name || 'Learner').slice(0, 100);
  const targetRole = String(body.target_role || 'Full Stack Developer').slice(0, 80);
  const batchCohort = String(body.batch_cohort || 'Batch 2027').slice(0, 60);
  const experienceLevel = String(body.experience_level || 'Student').slice(0, 30);
  const backgroundNote = String(body.background_note || '').slice(0, 1500);
  const selectedSkills = Array.isArray(body.selected_skills)
    ? body.selected_skills.map((s) => String(s)).slice(0, 20)
    : [];

  if (FASTAPI_URL) {
    try {
      const upstream = await fetch(`${FASTAPI_URL}/api/onboarding/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
        body: JSON.stringify(body),
      });
      if (upstream.ok) {
        const data = await upstream.json();
        res.json(data);
        return;
      }
    } catch {
      // Fall through to serverless OpenRouter handler
    }
  }

  const fallbackSkills = deterministicExtractSkills(targetRole, backgroundNote, selectedSkills);
  const fallbackQuiz = buildDiagnosticForSkills(targetRole, fallbackSkills);

  interface AiOnboardingResponse {
    coach_message?: string;
    follow_up_question?: string;
    suggested_skills?: Array<{
      skill_name: string;
      self_reported_confidence?: 'Beginner' | 'Intermediate' | 'Advanced';
      category?: string;
    }>;
    diagnostic_quiz?: {
      target_role: string;
      estimated_seconds: number;
      questions: Array<{
        id: string;
        skill_tested: string;
        question: string;
        options: string[];
        correct_index: number;
        explanation: string;
      }>;
    };
  }

  const aiResult = await callOpenRouterJson<AiOnboardingResponse>(
    `You are CareerLoop's AI Onboarding Coach. Return JSON with keys:
- coach_message (2 crisp sentences welcoming the learner and summarizing how their background maps to their target role)
- follow_up_question (1 concise clarifying question about a project or experience)
- suggested_skills (array of 3-6 objects: { skill_name, self_reported_confidence: "Beginner"|"Intermediate"|"Advanced", category })
- diagnostic_quiz ({ target_role, estimated_seconds: 60, questions: array of EXACTLY 3 objects { id, skill_tested, question, options (4 strings), correct_index (0-3), explanation } }).`,
    `Learner UID: ${authCtx.uid || String(body.user_id || 'anonymous')}
Name: ${fullName}
Cohort/Track: ${batchCohort}
Experience Level: ${experienceLevel}
Target Role: ${targetRole}
Selected Skills: ${selectedSkills.join(', ') || 'None yet'}
Background Note: ${backgroundNote || 'None provided'}`
  );

  const validQuestions =
    aiResult?.diagnostic_quiz?.questions &&
    Array.isArray(aiResult.diagnostic_quiz.questions) &&
    aiResult.diagnostic_quiz.questions.length === 3 &&
    aiResult.diagnostic_quiz.questions.every(
      (q) =>
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correct_index === 'number' &&
        q.correct_index >= 0 &&
        q.correct_index <= 3
    );

  const resolvedSkills =
    aiResult?.suggested_skills && Array.isArray(aiResult.suggested_skills) && aiResult.suggested_skills.length > 0
      ? aiResult.suggested_skills.slice(0, 8).map((s) => ({
          skill_name: String(s.skill_name || 'Python').slice(0, 80),
          self_reported_confidence: (['Beginner', 'Intermediate', 'Advanced'].includes(
            String(s.self_reported_confidence)
          )
            ? s.self_reported_confidence
            : 'Intermediate') as 'Beginner' | 'Intermediate' | 'Advanced',
          category: String(s.category || 'Core').slice(0, 60),
        }))
      : fallbackSkills;

  const now = new Date().toISOString();
  res.json({
    coach_message:
      typeof aiResult?.coach_message === 'string' && aiResult.coach_message.trim().length > 10
        ? aiResult.coach_message.trim()
        : `Welcome to CareerLoop, ${fullName}. Based on your ${experienceLevel.toLowerCase()} background and goal of ${targetRole}, I calibrated your profile around ${resolvedSkills
            .slice(0, 3)
            .map((s) => s.skill_name)
            .join(', ')}.`,
    follow_up_question:
      typeof aiResult?.follow_up_question === 'string' && aiResult.follow_up_question.trim().length > 5
        ? aiResult.follow_up_question.trim()
        : `What is one recent project or class assignment where you applied ${resolvedSkills[0]?.skill_name || 'programming'}?`,
    suggested_skills: resolvedSkills,
    diagnostic_quiz: validQuestions ? aiResult!.diagnostic_quiz! : fallbackQuiz,
    agent_logs: [
      {
        agent_name: 'Profiler Agent',
        action_summary: `Calibrated ${resolvedSkills.length} claimed skills for ${fullName} targeting ${targetRole}`,
        timestamp: now,
      },
      {
        agent_name: 'Supervisor',
        action_summary: aiResult
          ? `Generated personalized 60-second baseline check via ${DEFAULT_OPENROUTER_MODEL}`
          : 'Prepared personalized 60-second baseline verification check',
        timestamp: now,
      },
    ],
  });
});

app.post('/api/mentor/chat', async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const topic = String(body.topic || 'JavaScript ES6+ & Async').slice(0, 120);
  const message = String(body.message || '').slice(0, 1500);
  const verifiedSkills = Array.isArray(body.verified_skills)
    ? body.verified_skills.map((s) => String(s)).slice(0, 10)
    : ['Python', 'SQL'];
  const targetRole = String(body.target_role || 'Full Stack Developer').slice(0, 80);

  if (FASTAPI_URL) {
    try {
      const upstream = await fetch(`${FASTAPI_URL}/api/mentor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (upstream.ok) {
        res.json(await upstream.json());
        return;
      }
    } catch {
      // Fall through to OpenRouter
    }
  }

  const aiReply = await callOpenRouterJson<{
    reply?: string;
    socratic_hint?: string;
    suggested_followups?: string[];
  }>(
    `You are CareerLoop's Socratic AI Mentor coaching a learner targeting ${targetRole}.
Verified strengths: ${verifiedSkills.join(', ')}.
Connect '${topic}' to concepts they already know, never give away quiz answers directly, and end with one probing question.
Return JSON with keys: reply (string), socratic_hint (string), suggested_followups (array of 2-3 short strings).`,
    `Topic: ${topic}\nLearner message: ${message}`,
    0.3,
    900
  );

  if (aiReply?.reply) {
    res.json({
      reply: aiReply.reply,
      socratic_hint:
        aiReply.socratic_hint || `Connect ${topic} state flow back to ${verifiedSkills[0] || 'Python'}.`,
      suggested_followups:
        Array.isArray(aiReply.suggested_followups) && aiReply.suggested_followups.length >= 2
          ? aiReply.suggested_followups.slice(0, 3)
          : [
              `Compare ${topic} with ${verifiedSkills[0] || 'Python'}`,
              `What common mistake occurs in ${topic}?`,
            ],
      agent_logs: [
        {
          agent_name: 'Mentor & Evaluator',
          action_summary: `Delivered Socratic coaching on ${topic} via ${DEFAULT_OPENROUTER_MODEL}`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
    return;
  }

  // Signal cleanly to client fallback if OpenRouter key is absent
  res.status(503).json({ detail: 'LLM provider not configured; use local deterministic mentor fallback.' });
});

app.post('/api/mentor/quiz/generate', async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const topic = String(body.topic || 'JavaScript ES6+ & Async').slice(0, 120);
  const targetRole = String(body.target_role || 'Full Stack Developer').slice(0, 80);
  const numQuestions = Math.min(5, Math.max(3, Number(body.num_questions || 5)));

  if (FASTAPI_URL) {
    try {
      const upstream = await fetch(`${FASTAPI_URL}/api/mentor/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (upstream.ok) {
        res.json(await upstream.json());
        return;
      }
    } catch {
      // Fall through
    }
  }

  const aiQuiz = await callOpenRouterJson<{
    topic?: string;
    target_role?: string;
    questions?: Array<{
      id: string;
      topic: string;
      question: string;
      options: string[];
      correct_index: number;
      explanation: string;
    }>;
  }>(
    `You are CareerLoop's Assessment Generator. Return JSON for a TopicQuiz with keys:
topic (string), target_role (string), questions (array of EXACTLY ${numQuestions} objects: { id, topic, question, options (4 concise strings), correct_index (0-3), explanation (1 sentence) }).`,
    `Generate a ${numQuestions}-question practical assessment on '${topic}' for a ${targetRole}.`,
    0.2,
    1800
  );

  if (
    aiQuiz?.questions &&
    Array.isArray(aiQuiz.questions) &&
    aiQuiz.questions.length >= 3 &&
    aiQuiz.questions.every(
      (q) =>
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correct_index === 'number'
    )
  ) {
    res.json({
      topic,
      target_role: targetRole,
      questions: aiQuiz.questions.slice(0, 5),
    });
    return;
  }

  res.status(503).json({ detail: 'LLM provider not configured; use local deterministic quiz bank.' });
});

function writeSseEvent(res: Response, event: string, data: Record<string, unknown>) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

app.post('/api/agent/stream', async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const action = String(body.requested_action || 'build_roadmap');
  const targetRole = String(body.target_role || 'Full Stack Developer');
  const topic = String(body.topic || 'JavaScript ES6+ & Async');
  const scorePercent = typeof body.score_percent === 'number' ? body.score_percent : 40;

  if (FASTAPI_URL) {
    try {
      const upstream = await fetch(`${FASTAPI_URL}/api/agent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (upstream.ok && upstream.body) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
        res.end();
        return;
      }
    } catch {
      // Fall through to local SSE sequence
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const steps: Array<{ node: string; agent: string; summary: string }> =
    action === 'evaluate_quiz' && scorePercent < 60
      ? [
          {
            node: 'mentor_evaluator_node',
            agent: 'Mentor & Evaluator',
            summary: `Evaluated ${topic} at ${Math.round(scorePercent)}% (< 60% threshold); flagged adaptive re-route`,
          },
          {
            node: 'supervisor_node',
            agent: 'Supervisor',
            summary: `Delegating to Curriculum Architect — Inserting prerequisite before ${topic}`,
          },
          {
            node: 'curriculum_architect_node',
            agent: 'Curriculum Architect',
            summary: `Injected prerequisite node and rewired DAG dependencies for ${targetRole}`,
          },
        ]
      : action === 'switch_role'
        ? [
            {
              node: 'supervisor_node',
              agent: 'Supervisor',
              summary: `Delegating to Market Strategist — Recalculating readiness for ${targetRole}`,
            },
            {
              node: 'market_strategist_node',
              agent: 'Market Strategist',
              summary: `Updated weighted skill gaps and readiness for ${targetRole}`,
            },
            {
              node: 'curriculum_architect_node',
              agent: 'Curriculum Architect',
              summary: `Rebuilt interactive DAG roadmap and matched resources for ${targetRole}`,
            },
          ]
        : [
            {
              node: 'supervisor_node',
              agent: 'Supervisor',
              summary: `Delegating to Market Strategist — Auditing competencies for ${targetRole}`,
            },
            {
              node: 'curriculum_architect_node',
              agent: 'Curriculum Architect',
              summary: `Built interactive DAG learning roadmap for ${targetRole}`,
            },
          ];

  for (const step of steps) {
    const entry = {
      agent_name: step.agent,
      action_summary: step.summary,
      timestamp: new Date().toISOString(),
    };
    writeSseEvent(res, 'agent_step', {
      node: step.node,
      active_agent: step.node,
      target_role: targetRole,
      logs: [entry],
    });
    await new Promise((resolve) => setTimeout(resolve, 140));
  }

  writeSseEvent(res, 'complete', {
    target_role: targetRole,
    completed_at: new Date().toISOString(),
  });
  res.end();
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CareerLoop server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
