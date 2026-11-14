import type {
  AgentLogEntry,
  AssessmentEvaluationResponse,
  BaselineDiagnosticQuiz,
  ClaimedSkillItem,
  CohortAnalyticsData,
  CohortStudent,
  MarketAnalysisResponse,
  MentorChatResponse,
  OnboardingAnalyzeRequest,
  OnboardingAnalyzeResponse,
  PersistedWorkspacePayload,
  ProfileUploadResponse,
  ResourceItem,
  RoadmapDAG,
  RoadmapFlowEdge,
  RoadmapFlowNode,
  RoleBenchmarkSummary,
  SkillGapItem,
  TopicQuiz,
  VerifiedProfileResponse,
  VerifiedSkillResult,
} from '../types/careerloop';

const DEMO_USER_ID = '11111111-1111-4111-8111-111111111111';

const nowIso = () => new Date().toISOString();

const slugify = (val: string) =>
  val
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'node';

export const FALLBACK_ROLE_BENCHMARKS: RoleBenchmarkSummary[] = [
  {
    role_title: 'Full Stack Developer',
    description:
      'Designs, builds, and ships end-to-end web applications spanning interactive client interfaces, REST/API backends, and relational persistence.',
    required_skills: [
      { skill_name: 'Python', category: 'Backend', importance_weight: 2.6, required_proficiency: 'Intermediate' },
      { skill_name: 'SQL', category: 'Backend', importance_weight: 2.2, required_proficiency: 'Intermediate' },
      { skill_name: 'HTML & CSS', category: 'Core', importance_weight: 1.6, required_proficiency: 'Intermediate' },
      { skill_name: 'JavaScript ES6+ & Async', category: 'Core', importance_weight: 1.5, required_proficiency: 'Intermediate' },
      { skill_name: 'React 19', category: 'Framework', importance_weight: 1.1, required_proficiency: 'Intermediate' },
      { skill_name: 'Node.js & Express', category: 'Backend', importance_weight: 1.0, required_proficiency: 'Intermediate' },
    ],
  },
  {
    role_title: 'AI Engineer',
    description:
      'Architects production LLM workflows, retrieval-augmented generation pipelines, model APIs, and multi-agent orchestration systems.',
    required_skills: [
      { skill_name: 'Python', category: 'Core', importance_weight: 2.5, required_proficiency: 'Advanced' },
      { skill_name: 'SQL', category: 'Backend', importance_weight: 1.5, required_proficiency: 'Intermediate' },
      { skill_name: 'PyTorch & Deep Learning', category: 'Framework', importance_weight: 2.2, required_proficiency: 'Intermediate' },
      { skill_name: 'LLM Orchestration & LangGraph', category: 'Architecture', importance_weight: 2.5, required_proficiency: 'Intermediate' },
      { skill_name: 'Vector Databases & RAG', category: 'Architecture', importance_weight: 2.0, required_proficiency: 'Intermediate' },
      { skill_name: 'FastAPI & Model Deployment', category: 'Backend', importance_weight: 1.8, required_proficiency: 'Intermediate' },
    ],
  },
  {
    role_title: 'Backend Engineer',
    description:
      'Builds resilient, scalable server-side APIs, distributed data layers, caching tiers, and containerized microservices.',
    required_skills: [
      { skill_name: 'Python', category: 'Core', importance_weight: 2.2, required_proficiency: 'Advanced' },
      { skill_name: 'SQL', category: 'Backend', importance_weight: 2.2, required_proficiency: 'Advanced' },
      { skill_name: 'Node.js & Express', category: 'Backend', importance_weight: 1.8, required_proficiency: 'Intermediate' },
      { skill_name: 'System Design & Caching', category: 'Architecture', importance_weight: 2.5, required_proficiency: 'Intermediate' },
      { skill_name: 'Docker & Microservices', category: 'Tooling', importance_weight: 1.8, required_proficiency: 'Intermediate' },
      { skill_name: 'REST & GraphQL APIs', category: 'Backend', importance_weight: 2.0, required_proficiency: 'Intermediate' },
    ],
  },
  {
    role_title: 'Data Scientist',
    description:
      'Transforms complex datasets into predictive models, statistical insights, and decision-ready visualizations.',
    required_skills: [
      { skill_name: 'Python', category: 'Core', importance_weight: 2.5, required_proficiency: 'Advanced' },
      { skill_name: 'SQL', category: 'Backend', importance_weight: 2.0, required_proficiency: 'Intermediate' },
      { skill_name: 'Statistical Modeling', category: 'Core', importance_weight: 2.2, required_proficiency: 'Intermediate' },
      { skill_name: 'Machine Learning & Scikit-Learn', category: 'Framework', importance_weight: 2.5, required_proficiency: 'Intermediate' },
      { skill_name: 'Data Visualization', category: 'Tooling', importance_weight: 1.5, required_proficiency: 'Intermediate' },
      { skill_name: 'Feature Engineering', category: 'Architecture', importance_weight: 1.8, required_proficiency: 'Intermediate' },
    ],
  },
];

const RESOURCE_CATALOG: Record<string, ResourceItem[]> = {
  python: [
    {
      id: 'res-py-1',
      title: 'Python Type Hints, AsyncIO & Clean Backend Patterns',
      url: 'https://docs.python.org/3/library/asyncio.html',
      resource_type: 'documentation',
      target_skill: 'Python',
      difficulty: 'intermediate',
      similarity: 0.96,
    },
  ],
  sql: [
    {
      id: 'res-sql-1',
      title: 'PostgreSQL Indexing, Joins & Query Optimization Workshop',
      url: 'https://www.postgresql.org/docs/current/tutorial.html',
      resource_type: 'documentation',
      target_skill: 'SQL',
      difficulty: 'intermediate',
      similarity: 0.95,
    },
  ],
  'html & css': [
    {
      id: 'res-html-1',
      title: 'Modern CSS Layout: Flexbox, Grid & Responsive Systems',
      url: 'https://web.dev/learn/css',
      resource_type: 'course',
      target_skill: 'HTML & CSS',
      difficulty: 'beginner',
      similarity: 0.94,
    },
  ],
  'javascript fundamentals': [
    {
      id: 'res-jsf-1',
      title: 'JavaScript Fundamentals Crash Course — Variables, Scope & Control Flow',
      url: 'https://javascript.info/first-steps',
      resource_type: 'documentation',
      target_skill: 'JavaScript Fundamentals',
      difficulty: 'beginner',
      similarity: 0.99,
    },
    {
      id: 'res-jsf-2',
      title: 'MDN JavaScript Basics & DOM Manipulation Lab',
      url: 'https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/JavaScript_basics',
      resource_type: 'exercise',
      target_skill: 'JavaScript Fundamentals',
      difficulty: 'beginner',
      similarity: 0.96,
    },
  ],
  'javascript es6+ & async': [
    {
      id: 'res-js-1',
      title: 'Modern JavaScript ES6+: Destructuring, Promises & Async/Await',
      url: 'https://javascript.info/async',
      resource_type: 'course',
      target_skill: 'JavaScript ES6+ & Async',
      difficulty: 'intermediate',
      similarity: 0.98,
    },
    {
      id: 'res-js-2',
      title: 'Understanding the JavaScript Event Loop & Asynchronous Patterns',
      url: 'https://www.youtube.com/watch?v=8aGhZQkoFbQ',
      resource_type: 'video',
      target_skill: 'JavaScript ES6+ & Async',
      difficulty: 'intermediate',
      similarity: 0.95,
    },
  ],
  'react 19': [
    {
      id: 'res-react-1',
      title: 'Official React 19 Documentation: Thinking in React & Hooks Mastery',
      url: 'https://react.dev/learn',
      resource_type: 'documentation',
      target_skill: 'React 19',
      difficulty: 'intermediate',
      similarity: 0.98,
    },
    {
      id: 'res-react-2',
      title: 'Build an Interactive Task Dashboard with React State & Effects',
      url: 'https://react.dev/learn/managing-state',
      resource_type: 'exercise',
      target_skill: 'React 19',
      difficulty: 'intermediate',
      similarity: 0.94,
    },
  ],
  'node.js & express': [
    {
      id: 'res-node-1',
      title: 'Node.js & Express REST API Architecture Guide',
      url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs',
      resource_type: 'course',
      target_skill: 'Node.js & Express',
      difficulty: 'intermediate',
      similarity: 0.97,
    },
    {
      id: 'res-node-2',
      title: 'Express Middleware, Routing & PostgreSQL Integration Lab',
      url: 'https://expressjs.com/en/guide/writing-middleware.html',
      resource_type: 'exercise',
      target_skill: 'Node.js & Express',
      difficulty: 'intermediate',
      similarity: 0.93,
    },
  ],
};

function findResources(skill: string): ResourceItem[] {
  const key = skill.toLowerCase();
  if (RESOURCE_CATALOG[key]) return RESOURCE_CATALOG[key];
  const matchedKey = Object.keys(RESOURCE_CATALOG).find(
    (k) => k.includes(key) || key.includes(k)
  );
  if (matchedKey) return RESOURCE_CATALOG[matchedKey];
  return [
    {
      id: `res-${slugify(skill)}`,
      title: `${skill} Official Guide & Interactive Practice Lab`,
      url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(skill)}`,
      resource_type: 'documentation',
      target_skill: skill,
      difficulty: 'intermediate',
      similarity: 0.86,
    },
  ];
}

// Local in-browser state store mirroring FastAPI IN_MEMORY_STORE & Firestore hydration
let localProfile: VerifiedProfileResponse | null = null;
let localRoadmap: RoadmapDAG | null = null;
let localGaps: SkillGapItem[] = [];
let localRoleSummary = '';
let pendingUpload: ProfileUploadResponse | null = null;

function skillsMatch(a: string, b: string): boolean {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al === bl) return true;
  if ((al.includes('javascript') || al === 'js') && bl.includes('javascript')) return true;
  if (al.includes('react') && bl.includes('react')) return true;
  if (al.includes('node') && bl.includes('node')) return true;
  if (al.includes('html') && bl.includes('html')) return true;
  return (al.length >= 3 && bl.includes(al)) || (bl.length >= 3 && al.includes(bl));
}

export function localHydrateFromFirestore(params: {
  userId: string;
  fullName: string;
  batchCohort: string;
  workspace: PersistedWorkspacePayload;
}): VerifiedProfileResponse {
  const { userId, fullName, batchCohort, workspace } = params;
  const gapAsVerifiedShape: VerifiedSkillResult[] = workspace.skillGaps.map((g) => ({
    skill_name: g.skill_name,
    proficiency_level: g.current_status === 'Missing' ? 'Missing' : 'Unverified',
    is_verified: false,
    verification_score: 0,
    category: g.category,
    status: g.current_status === 'Missing' ? 'gap' : 'unverified',
  }));

  localProfile = {
    user_id: userId,
    full_name: fullName,
    batch_cohort: batchCohort,
    target_role: workspace.targetRole,
    readiness_score: workspace.readinessScore,
    quiz_score_percent: workspace.quizScorePercent ?? 100,
    verified_skills: workspace.verifiedSkills,
    skill_gaps: gapAsVerifiedShape,
    extracted_profile: null,
    agent_logs: workspace.agentLogs,
    storage_mode: 'firestore',
  };
  localGaps = workspace.skillGaps;
  localRoleSummary = workspace.roleSummary;
  localRoadmap = {
    user_id: userId,
    target_role: workspace.targetRole,
    nodes: workspace.roadmapNodes,
    edges: workspace.roadmapEdges,
    rerouted: workspace.rerouted,
    reroute_reason: workspace.rerouteReason ?? null,
  };
  return localProfile;
}

export function localAnalyzeOnboarding(req: OnboardingAnalyzeRequest): OnboardingAnalyzeResponse {
  const seen = new Set<string>();
  const skills: ClaimedSkillItem[] = [];

  for (const raw of req.selected_skills) {
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

  const lower = req.background_note.toLowerCase();
  const matchers: Array<[string, string, string]> = [
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

  for (const [token, canonical, category] of matchers) {
    if (lower.includes(token) && !seen.has(canonical.toLowerCase())) {
      seen.add(canonical.toLowerCase());
      skills.push({
        skill_name: canonical,
        self_reported_confidence: 'Intermediate',
        category,
      });
    }
  }

  if (skills.length === 0) {
    skills.push(
      { skill_name: 'Python', self_reported_confidence: 'Beginner', category: 'Backend & Scripting' },
      { skill_name: 'SQL', self_reported_confidence: 'Beginner', category: 'Databases' },
      { skill_name: 'HTML & CSS', self_reported_confidence: 'Beginner', category: 'Frontend Foundations' }
    );
  }

  const tested = skills.map((s) => s.skill_name).slice(0, 3);
  for (const pad of ['Python', 'SQL', 'HTML & CSS']) {
    if (tested.length >= 3) break;
    if (!tested.some((t) => skillsMatch(t, pad))) tested.push(pad);
  }

  const quizBank: Record<string, { q: string; opts: string[]; idx: number; exp: string }> = {
    python: {
      q: 'Which Python data structure gives O(1) average lookup for membership checks?',
      opts: ['list', 'set', 'tuple', 'deque'],
      idx: 1,
      exp: 'A Python set is hash-backed for O(1) average membership checks.',
    },
    sql: {
      q: 'Which SQL clause filters grouped rows after GROUP BY aggregation?',
      opts: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
      idx: 1,
      exp: 'HAVING filters aggregated groups, while WHERE filters rows before grouping.',
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
      exp: 'Calling next() hands execution to the subsequent middleware in the pipeline.',
    },
  };

  const questions = tested.slice(0, 3).map((skill, idx) => {
    const low = skill.toLowerCase();
    const key = Object.keys(quizBank).find((k) => low.includes(k));
    const entry = key
      ? quizBank[key]
      : {
          q: `In production ${skill} workflows, what best supports long-term reliability?`,
          opts: [
            'Modular boundaries, input validation, and automated tests',
            'Duplicating business logic across global files',
            'Ignoring edge cases and asynchronous errors',
            'Hardcoding secrets in client code',
          ],
          idx: 0,
          exp: `Modular boundaries, validation, and tests are foundational in ${skill}.`,
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

  const skillPreview = skills
    .slice(0, 3)
    .map((s) => s.skill_name)
    .join(', ');

  return {
    coach_message: `Welcome to CareerLoop, ${req.full_name}. Based on your ${req.experience_level.toLowerCase()} background and goal of ${req.target_role}, I calibrated your initial skill check around ${skillPreview}.`,
    follow_up_question: `What is one recent project or coursework assignment where you used ${skills[0].skill_name}?`,
    suggested_skills: skills.slice(0, 8),
    diagnostic_quiz: {
      target_role: req.target_role,
      estimated_seconds: 60,
      questions,
    },
    agent_logs: [
      {
        agent_name: 'Profiler Agent',
        action_summary: `Calibrated ${skills.length} claimed skills for ${req.full_name} targeting ${req.target_role}`,
        timestamp: nowIso(),
      },
      {
        agent_name: 'Supervisor',
        action_summary: 'Prepared personalized 60-second baseline verification check',
        timestamp: nowIso(),
      },
    ],
  };
}

export function localLoadDemoPersona(): VerifiedProfileResponse {
  const verifiedSkills: VerifiedSkillResult[] = [
    {
      skill_name: 'Python',
      proficiency_level: 'Verified',
      is_verified: true,
      verification_score: 92,
      category: 'Backend & Scripting',
      status: 'verified',
    },
    {
      skill_name: 'SQL',
      proficiency_level: 'Verified',
      is_verified: true,
      verification_score: 88,
      category: 'Databases',
      status: 'verified',
    },
    {
      skill_name: 'HTML & CSS',
      proficiency_level: 'Verified',
      is_verified: true,
      verification_score: 85,
      category: 'Frontend Foundations',
      status: 'verified',
    },
  ];

  const skillGaps: VerifiedSkillResult[] = [
    {
      skill_name: 'JavaScript ES6+ & Async',
      proficiency_level: 'Missing',
      is_verified: false,
      verification_score: 0,
      category: 'Frontend Engineering',
      status: 'gap',
    },
    {
      skill_name: 'React 19',
      proficiency_level: 'Missing',
      is_verified: false,
      verification_score: 0,
      category: 'Frontend Engineering',
      status: 'gap',
    },
    {
      skill_name: 'Node.js & Express',
      proficiency_level: 'Missing',
      is_verified: false,
      verification_score: 0,
      category: 'Backend Engineering',
      status: 'gap',
    },
  ];

  const logs: AgentLogEntry[] = [
    {
      agent_name: 'Profiler Agent',
      action_summary: 'Loaded Sophia Vance profile (Batch 2027) targeting Full Stack Developer',
      timestamp: nowIso(),
    },
    {
      agent_name: 'Profiler Agent',
      action_summary: 'Verified Python (92%), SQL (88%), and HTML & CSS (85%) baseline skills',
      timestamp: nowIso(),
    },
    {
      agent_name: 'Market Strategist',
      action_summary: 'Calculated 64% readiness for Full Stack Developer; identified 3 priority gaps',
      timestamp: nowIso(),
    },
  ];

  localProfile = {
    user_id: DEMO_USER_ID,
    full_name: 'Sophia Vance',
    batch_cohort: 'Batch 2027',
    target_role: 'Full Stack Developer',
    readiness_score: 64,
    quiz_score_percent: 100,
    verified_skills: verifiedSkills,
    skill_gaps: skillGaps,
    extracted_profile: {
      full_name: 'Sophia Vance',
      headline: 'Computer Science Undergraduate (Batch 2027) · Python & Data Systems Builder',
      education: [
        {
          institution: 'Pacific Institute of Technology',
          degree: 'B.S. in Computer Science',
          graduation_year: '2027',
        },
      ],
      experience: [
        {
          company: 'Campus Data Lab',
          role: 'Undergraduate Research Assistant',
          duration: 'May 2025 – Present',
          highlights: [
            'Built automated Python ETL pipelines processing 120,000 student survey records.',
            'Designed normalized PostgreSQL schemas and indexing strategies for analytics.',
          ],
        },
      ],
      projects: [
        {
          name: 'CoursePulse SQL Explorer',
          description: 'Python and PostgreSQL web utility for querying university course prerequisites.',
          technologies: ['Python', 'SQL', 'HTML & CSS'],
        },
        {
          name: 'StudyMetrics Dashboard',
          description: 'Responsive HTML & CSS portfolio and academic GPA planner.',
          technologies: ['HTML & CSS', 'Python'],
        },
      ],
      certifications: [
        'PCAP: Certified Associate in Python Programming',
        'PostgreSQL Relational Database Foundations',
      ],
      claimed_skills: [
        { skill_name: 'Python', self_reported_confidence: 'Advanced', category: 'Backend & Scripting' },
        { skill_name: 'SQL', self_reported_confidence: 'Intermediate', category: 'Databases' },
        { skill_name: 'HTML & CSS', self_reported_confidence: 'Intermediate', category: 'Frontend Foundations' },
      ],
      suggested_target_role: 'Full Stack Developer',
    },
    agent_logs: logs,
    storage_mode: 'in_memory',
  };
  localRoadmap = null;
  return localProfile;
}

export function localAnalyzeGaps(userId: string, targetRole?: string): MarketAnalysisResponse {
  if (!localProfile || localProfile.user_id !== userId) {
    localLoadDemoPersona();
  }
  const profile = localProfile!;
  const resolvedRole = targetRole || profile.target_role;
  const benchmark =
    FALLBACK_ROLE_BENCHMARKS.find((r) => r.role_title.toLowerCase() === resolvedRole.toLowerCase()) ||
    FALLBACK_ROLE_BENCHMARKS[0];

  const totalWeight = benchmark.required_skills.reduce((acc, s) => acc + s.importance_weight, 0);
  let earnedWeight = 0;
  const matchedVerified: string[] = [];
  const gaps: SkillGapItem[] = [];

  for (const req of benchmark.required_skills) {
    const match = profile.verified_skills.find((v) => skillsMatch(v.skill_name, req.skill_name));
    if (match) {
      earnedWeight += req.importance_weight;
      matchedVerified.push(req.skill_name);
    } else {
      const priority = req.importance_weight >= 1.5 ? 'Critical' : req.importance_weight >= 1.0 ? 'High' : 'Moderate';
      gaps.push({
        skill_name: req.skill_name,
        category: req.category,
        priority,
        importance_weight: req.importance_weight,
        reason: `${req.skill_name} is a ${priority.toLowerCase()}-priority ${req.category.toLowerCase()} skill required for ${benchmark.role_title}.`,
        current_status: 'Missing',
      });
    }
  }

  const readiness = Math.round((earnedWeight / Math.max(totalWeight, 1)) * 100);
  profile.target_role = benchmark.role_title;
  profile.readiness_score = readiness;
  profile.skill_gaps = gaps.map((g) => ({
    skill_name: g.skill_name,
    proficiency_level: 'Missing',
    is_verified: false,
    verification_score: 0,
    category: g.category,
    status: 'gap',
  }));

  localGaps = gaps;
  localRoleSummary = `Your verified strengths in ${matchedVerified.join(', ') || 'foundations'} deliver a ${readiness}% baseline for ${benchmark.role_title}. Closing ${gaps.length} targeted modules will bring you to full role readiness.`;

  profile.agent_logs = [
    ...profile.agent_logs,
    {
      agent_name: 'Supervisor',
      action_summary: `Delegating to Market Strategist — Evaluating ${benchmark.role_title} readiness and skill gaps`,
      timestamp: nowIso(),
    },
    {
      agent_name: 'Market Strategist',
      action_summary: `Calculated ${readiness}% readiness for ${benchmark.role_title}; identified ${gaps.length} priority gaps`,
      timestamp: nowIso(),
    },
  ];

  return {
    user_id: profile.user_id,
    target_role: benchmark.role_title,
    readiness_score: readiness,
    matched_verified_skills: matchedVerified,
    skill_gaps: gaps,
    role_summary: localRoleSummary,
    agent_logs: profile.agent_logs,
  };
}

export function localBuildRoadmap(userId: string, targetRole?: string): {
  roadmap: RoadmapDAG;
  readiness_score: number;
  agent_logs: AgentLogEntry[];
} {
  if (!localProfile || localProfile.user_id !== userId) {
    localLoadDemoPersona();
  }
  const analysis = localAnalyzeGaps(userId, targetRole);
  const profile = localProfile!;

  const nodes: RoadmapFlowNode[] = [];
  const edges: RoadmapFlowEdge[] = [];
  const baselineIds: string[] = [];
  const yStart = 35;
  const yStep = 132;

  profile.verified_skills.slice(0, 4).forEach((skill, idx) => {
    const id = `node-verified-${slugify(skill.skill_name)}`;
    baselineIds.push(id);
    nodes.push({
      id,
      type: 'curriculumNode',
      position: { x: 40, y: yStart + idx * yStep },
      data: {
        label: skill.skill_name,
        skill_name: skill.skill_name,
        status: 'verified',
        badge_text: `Verified · ${Math.round(skill.verification_score)}%`,
        estimated_hours: 2,
        description: `Verified baseline competency in ${skill.skill_name}.`,
        resources: findResources(skill.skill_name),
        is_remediation: false,
        mastery_score: skill.verification_score,
      },
    });
  });

  if (baselineIds.length === 0) {
    const fallbackId = 'node-verified-foundation';
    baselineIds.push(fallbackId);
    nodes.push({
      id: fallbackId,
      type: 'curriculumNode',
      position: { x: 40, y: 120 },
      data: {
        label: 'Engineering Foundations',
        skill_name: 'Engineering Foundations',
        status: 'verified',
        badge_text: 'Baseline Ready',
        estimated_hours: 2,
        description: `Starting baseline for ${analysis.target_role}.`,
        resources: findResources('Python'),
        is_remediation: false,
        mastery_score: 70,
      },
    });
  }

  const gapsToMap = analysis.skill_gaps.slice(0, 4);
  let prevIds = baselineIds;
  const xBase = 365;
  const xStep = 315;
  const centerY = yStart + Math.max(baselineIds.length - 1, 0) * yStep * 0.45;

  gapsToMap.forEach((gap, idx) => {
    const id = `node-gap-${slugify(gap.skill_name)}`;
    const isFirst = idx === 0;
    nodes.push({
      id,
      type: 'curriculumNode',
      position: { x: xBase + idx * xStep, y: centerY },
      data: {
        label: gap.skill_name,
        skill_name: gap.skill_name,
        status: isFirst ? 'in_progress' : 'locked',
        badge_text: isFirst ? 'Next focus' : `${gap.priority} priority`,
        estimated_hours: gap.priority === 'Critical' ? 12 : 8,
        description: gap.reason,
        resources: findResources(gap.skill_name),
        is_remediation: false,
      },
    });

    prevIds.forEach((src) => {
      edges.push({
        id: `edge-${src}-to-${id}`,
        source: src,
        target: id,
        animated: isFirst,
      });
    });
    prevIds = [id];
  });

  const capstoneId = `node-capstone-${slugify(analysis.target_role)}`;
  nodes.push({
    id: capstoneId,
    type: 'curriculumNode',
    position: { x: xBase + gapsToMap.length * xStep, y: centerY },
    data: {
      label: `${analysis.target_role} Capstone`,
      skill_name: `${analysis.target_role} Capstone`,
      status: 'locked',
      badge_text: 'Role readiness milestone',
      estimated_hours: 16,
      description: `Integrate your verified strengths and newly mastered skills into a ${analysis.target_role} project.`,
      resources: [],
      is_remediation: false,
    },
  });
  prevIds.forEach((src) => {
    edges.push({
      id: `edge-${src}-to-${capstoneId}`,
      source: src,
      target: capstoneId,
      animated: false,
    });
  });

  localRoadmap = {
    user_id: userId,
    target_role: analysis.target_role,
    nodes,
    edges,
    rerouted: false,
    reroute_reason: null,
  };

  profile.agent_logs = [
    ...profile.agent_logs,
    {
      agent_name: 'Supervisor',
      action_summary: `Delegating to Curriculum Architect — Building interactive DAG roadmap for ${analysis.target_role}`,
      timestamp: nowIso(),
    },
    {
      agent_name: 'Curriculum Architect',
      action_summary: `Generated ${nodes.length}-node DAG roadmap with curated vector-matched resources`,
      timestamp: nowIso(),
    },
  ];

  return {
    roadmap: localRoadmap,
    readiness_score: analysis.readiness_score,
    agent_logs: profile.agent_logs,
  };
}

export function localSimulateFail(
  userId: string,
  topic = 'JavaScript ES6+ & Async',
  scorePercent = 40
): AssessmentEvaluationResponse {
  if (!localProfile) localLoadDemoPersona();
  if (!localRoadmap) localBuildRoadmap(userId, localProfile!.target_role);

  const profile = localProfile!;
  const dag = JSON.parse(JSON.stringify(localRoadmap!)) as RoadmapDAG;

  const targetNode =
    dag.nodes.find((n) => n.data.skill_name.toLowerCase().includes(topic.toLowerCase())) ||
    dag.nodes.find((n) => n.data.skill_name.toLowerCase().includes('javascript')) ||
    dag.nodes.find((n) => n.data.status !== 'verified') ||
    dag.nodes[0];

  const isJs =
    targetNode.data.skill_name.toLowerCase().includes('javascript') ||
    topic.toLowerCase().includes('javascript') ||
    topic.toLowerCase().includes('js');
  const remLabel = isJs ? 'JavaScript Fundamentals' : `${targetNode.data.skill_name} Fundamentals`;
  const remId = `node-remediation-${slugify(remLabel)}`;
  const badgeText = `Added after ${Math.round(scorePercent)}% quiz score`;

  const existing = dag.nodes.find((n) => n.id === remId);
  if (existing) {
    existing.data.badge_text = badgeText;
    existing.data.status = 'remediation';
  } else {
    const insertX = targetNode.position.x;
    const insertY = targetNode.position.y;
    dag.nodes.forEach((n) => {
      if (n.position.x >= insertX - 10 && n.data.status !== 'verified') {
        n.position.x += 315;
      }
    });
    targetNode.data.status = 'locked';
    targetNode.data.badge_text = `Unlocks after ${remLabel}`;

    const remNode: RoadmapFlowNode = {
      id: remId,
      type: 'curriculumNode',
      position: { x: insertX, y: insertY },
      data: {
        label: remLabel,
        skill_name: remLabel,
        status: 'remediation',
        badge_text: badgeText,
        estimated_hours: 6,
        description:
          'Focused crash course covering variables, lexical scope, closures, and async basics before advancing.',
        resources: findResources(remLabel),
        is_remediation: true,
        mastery_score: scorePercent,
      },
    };

    const rewiredEdges: RoadmapFlowEdge[] = dag.edges.map((e) =>
      e.target === targetNode.id
        ? {
            id: `edge-${e.source}-to-${remId}`,
            source: e.source,
            target: remId,
            animated: true,
          }
        : e
    );
    rewiredEdges.push({
      id: `edge-${remId}-to-${targetNode.id}`,
      source: remId,
      target: targetNode.id,
      animated: true,
      label: 'Prerequisite',
    });

    dag.nodes.push(remNode);
    dag.edges = rewiredEdges;
  }

  dag.rerouted = true;
  dag.reroute_reason = `Injected '${remLabel}' before '${targetNode.data.skill_name}' after ${Math.round(scorePercent)}% quiz score`;
  localRoadmap = dag;

  profile.agent_logs = [
    ...profile.agent_logs,
    {
      agent_name: 'Mentor & Evaluator',
      action_summary: `Evaluated ${topic} quiz at ${Math.round(scorePercent)}% (< 60% threshold); flagged adaptive roadmap re-route`,
      timestamp: nowIso(),
    },
    {
      agent_name: 'Supervisor',
      action_summary: `Delegating to Curriculum Architect — Score ${Math.round(scorePercent)}% < 60%; injecting prerequisite remediation node`,
      timestamp: nowIso(),
    },
    {
      agent_name: 'Curriculum Architect',
      action_summary: `Injected '${remLabel}' prerequisite node before '${targetNode.data.skill_name}' (${badgeText})`,
      timestamp: nowIso(),
    },
  ];

  return {
    user_id: userId,
    topic,
    score_percent: scorePercent,
    passed: false,
    needs_reroute: true,
    feedback: [
      {
        question_id: 'sim-1',
        question: `${topic} — Event Loop & Promise Ordering`,
        selected_index: 2,
        correct_index: 0,
        is_correct: false,
        explanation: 'Microtasks (Promise callbacks) execute before macrotasks once the call stack empties.',
      },
      {
        question_id: 'sim-2',
        question: `${topic} — Immutability & Array Mapping`,
        selected_index: 1,
        correct_index: 1,
        is_correct: true,
        explanation: 'Array.prototype.map returns a new array without mutating the source array.',
      },
    ],
    mentor_advice: `You scored ${Math.round(scorePercent)}% on ${topic} (below the 60% threshold). I've collaborated with the Supervisor to insert "${remLabel}" right before ${targetNode.data.skill_name} so you can build rock-solid fundamentals first.`,
    updated_roadmap: dag,
    readiness_score: profile.readiness_score,
    agent_logs: profile.agent_logs,
  };
}

export function localGenerateTopicQuiz(topic: string, targetRole: string): TopicQuiz {
  const lower = topic.toLowerCase();
  if (lower.includes('react')) {
    return {
      topic,
      target_role: targetRole,
      questions: [
        {
          id: 'rq-1',
          topic,
          question: 'Why should React state updates treat objects and arrays immutably?',
          options: [
            'React detects state changes via shallow reference comparison',
            'JavaScript forbids mutating arrays inside hooks',
            'Immutable state auto-syncs to PostgreSQL',
            'JSX only renders frozen objects',
          ],
          correct_index: 0,
          explanation: 'Replacing object references lets React detect updates reliably and trigger re-renders.',
        },
        {
          id: 'rq-2',
          topic,
          question: 'What is the main purpose of the `key` prop in React lists?',
          options: [
            'Encrypting list DOM attributes',
            'Tracking element identity across inserts, reorders, and removals',
            'Styling even and odd table rows',
            'Binding click handlers automatically',
          ],
          correct_index: 1,
          explanation: 'Stable keys allow React to preserve state and reconcile list changes accurately.',
        },
        {
          id: 'rq-3',
          topic,
          question: 'When does `useEffect(fn, [role])` re-run?',
          options: [
            'Only once when the browser tab opens',
            'On mount and whenever `role` changes between renders',
            'On every mouse move inside the window',
            'Only when an error boundary catches an exception',
          ],
          correct_index: 1,
          explanation: 'React runs effects after mount and whenever any dependency value changes.',
        },
      ],
    };
  }

  return {
    topic,
    target_role: targetRole,
    questions: [
      {
        id: 'jsq-1',
        topic,
        question: 'What does marking a JavaScript function `async` guarantee?',
        options: [
          'It always returns a Promise',
          'It executes on a dedicated OS thread',
          'Loops inside it become non-blocking automatically',
          'Thrown errors are suppressed silently',
        ],
        correct_index: 0,
        explanation: 'An async function wraps its return value or rejection inside a Promise.',
      },
      {
        id: 'jsq-2',
        topic,
        question: 'Which queue runs first after the JavaScript call stack clears?',
        options: [
          'Macrotask queue (setTimeout)',
          'Microtask queue (Promise.then)',
          'Media decoding queue',
          'Idle callback queue',
        ],
        correct_index: 1,
        explanation: 'Microtasks drain completely before the event loop moves to the next macrotask.',
      },
      {
        id: 'jsq-3',
        topic,
        question: 'How do you run two independent Promises concurrently and wait for both?',
        options: [
          'await Promise.all([reqA, reqB])',
          'await reqA; await reqB;',
          'Promise.race([reqA, reqB])',
          'setTimeout([reqA, reqB], 0)',
        ],
        correct_index: 0,
        explanation: 'Promise.all starts both promises concurrently and resolves once both succeed.',
      },
      {
        id: 'jsq-4',
        topic,
        question: 'Which array method returns a transformed array of the same length without mutating the original?',
        options: ['forEach()', 'map()', 'splice()', 'push()'],
        correct_index: 1,
        explanation: 'map() returns a new array containing transformed items without mutating the source.',
      },
      {
        id: 'jsq-5',
        topic,
        question: 'What does `const { role = "Engineer" } = profile;` do when `profile.role` is undefined?',
        options: [
          'Assigns "Engineer" via destructuring default',
          'Throws a TypeError at runtime',
          'Mutates profile.role permanently',
          'Creates a global variable named Engineer',
        ],
        correct_index: 0,
        explanation: 'Object destructuring defaults apply whenever the extracted property is undefined.',
      },
    ],
  };
}

export function localSubmitTopicQuiz(
  userId: string,
  topic: string,
  quiz: TopicQuiz,
  userAnswers: number[]
): AssessmentEvaluationResponse {
  if (!localProfile) localLoadDemoPersona();
  let correct = 0;
  const feedback = quiz.questions.map((q, idx) => {
    const selected = userAnswers[idx] ?? -1;
    const isCorrect = selected === q.correct_index;
    if (isCorrect) correct += 1;
    return {
      question_id: q.id,
      question: q.question,
      selected_index: selected,
      correct_index: q.correct_index,
      is_correct: isCorrect,
      explanation: q.explanation,
    };
  });

  const scorePercent = Math.round((correct / Math.max(quiz.questions.length, 1)) * 100);
  if (scorePercent < 60) {
    const rerouted = localSimulateFail(userId, topic, scorePercent);
    return { ...rerouted, feedback };
  }

  const profile = localProfile!;
  const existingGapIdx = profile.skill_gaps.findIndex((g) => skillsMatch(g.skill_name, topic));
  if (existingGapIdx >= 0) {
    const promoted = profile.skill_gaps.splice(existingGapIdx, 1)[0];
    promoted.is_verified = true;
    promoted.proficiency_level = 'Verified';
    promoted.verification_score = scorePercent;
    promoted.status = 'verified';
    profile.verified_skills.push(promoted);
  } else if (!profile.verified_skills.some((v) => skillsMatch(v.skill_name, topic))) {
    profile.verified_skills.push({
      skill_name: topic,
      proficiency_level: 'Verified',
      is_verified: true,
      verification_score: scorePercent,
      category: 'Verified Competency',
      status: 'verified',
    });
  }
  const analysis = localAnalyzeGaps(userId, profile.target_role);
  const built = localBuildRoadmap(userId, profile.target_role);

  profile.agent_logs = [
    ...profile.agent_logs,
    {
      agent_name: 'Mentor & Evaluator',
      action_summary: `Evaluated ${topic} quiz at ${scorePercent}% (Passed); updated verified skill profile`,
      timestamp: nowIso(),
    },
  ];

  return {
    user_id: userId,
    topic,
    score_percent: scorePercent,
    passed: true,
    needs_reroute: false,
    feedback,
    mentor_advice: `Strong mastery (${scorePercent}%) on ${topic}. Your skill profile and readiness (${analysis.readiness_score}%) have been updated.`,
    updated_roadmap: built.roadmap,
    readiness_score: analysis.readiness_score,
    agent_logs: profile.agent_logs,
  };
}

export function localMentorChat(topic: string, message: string): MentorChatResponse {
  const profile = localProfile || localLoadDemoPersona();
  const anchor = profile.verified_skills[0]?.skill_name || 'Python';

  let reply: string;
  let hint: string;
  if (message.toLowerCase().includes('promise') || message.toLowerCase().includes('async') || topic.toLowerCase().includes('javascript')) {
    reply = `Think of a JavaScript Promise like an ${anchor} Future or a café order buzzer: calling an async API returns a pending token immediately so the UI stays responsive. Once the network replies, the callback enters the microtask queue. If you have two independent API calls, what changes if you await them sequentially versus using Promise.all?`;
    hint = 'Compare total latency when running independent Promises sequentially vs. concurrently.';
  } else {
    reply = `Because you already verified ${anchor}, map ${topic} to clear input-and-state flow: what data enters this module, and what predictable output should it produce? Tell me how you would break the problem into two small functions.`;
    hint = `Connect ${topic} state flow back to clean modular boundaries you use in ${anchor}.`;
  }

  profile.agent_logs = [
    ...profile.agent_logs,
    {
      agent_name: 'Mentor & Evaluator',
      action_summary: `Delivered Socratic coaching on ${topic} anchored to ${anchor}`,
      timestamp: nowIso(),
    },
  ];

  return {
    reply,
    socratic_hint: hint,
    suggested_followups: [
      `Give me a ${anchor}-to-${topic} analogy`,
      `What mistake causes most ${topic} quiz misses?`,
      `Start a quick check on ${topic}`,
    ],
    agent_logs: profile.agent_logs,
  };
}

export function localUploadResume(fileName: string, targetRole: string): ProfileUploadResponse {
  const cleanName = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Candidate Profile';
  const quiz: BaselineDiagnosticQuiz = {
    target_role: targetRole,
    estimated_seconds: 60,
    questions: [
      {
        id: 'q1',
        skill_tested: 'Python',
        question: 'Which Python data structure gives O(1) average lookup for membership checks?',
        options: ['list', 'set', 'tuple', 'deque'],
        correct_index: 1,
        explanation: 'A Python set is hash-backed for O(1) average membership checks.',
      },
      {
        id: 'q2',
        skill_tested: 'SQL',
        question: 'Which SQL clause filters grouped rows after GROUP BY aggregation?',
        options: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
        correct_index: 1,
        explanation: 'HAVING filters aggregated groups, while WHERE filters rows before grouping.',
      },
      {
        id: 'q3',
        skill_tested: 'HTML & CSS',
        question: 'Which CSS Flexbox property aligns items along the main axis?',
        options: ['align-items', 'justify-content', 'flex-wrap', 'place-self'],
        correct_index: 1,
        explanation: 'justify-content distributes flex items along the main axis.',
      },
    ],
  };

  pendingUpload = {
    user_id: localProfile?.user_id || `uploaded-${Date.now()}`,
    target_role: targetRole,
    extraction_method: 'pymupdf',
    extracted_profile: {
      full_name: localProfile?.full_name || (cleanName.length > 3 ? cleanName : 'Alex Rivera'),
      headline: `Candidate targeting ${targetRole}`,
      education: [{ institution: 'University Partner', degree: 'B.S. Computer Science', graduation_year: '2027' }],
      experience: [
        {
          company: 'Engineering Lab',
          role: 'Software Developer Intern',
          duration: 'Summer 2025',
          highlights: ['Automated Python data processing workflows and SQL reporting queries.'],
        },
      ],
      projects: [
        {
          name: 'Academic Analytics Portal',
          description: 'Built relational queries and responsive views using Python, SQL, and HTML/CSS.',
          technologies: ['Python', 'SQL', 'HTML & CSS'],
        },
      ],
      certifications: ['Relational Database Design'],
      claimed_skills: [
        { skill_name: 'Python', self_reported_confidence: 'Intermediate', category: 'Backend & Scripting' },
        { skill_name: 'SQL', self_reported_confidence: 'Intermediate', category: 'Databases' },
        { skill_name: 'HTML & CSS', self_reported_confidence: 'Intermediate', category: 'Frontend Foundations' },
      ],
      suggested_target_role: targetRole,
    },
    diagnostic_quiz: quiz,
    agent_logs: [
      {
        agent_name: 'Profiler Agent',
        action_summary: `Extracted 3 claimed skills and 1 project from ${fileName}`,
        timestamp: nowIso(),
      },
      {
        agent_name: 'Profiler Agent',
        action_summary: 'Generated 60-second baseline diagnostic across Python, SQL, and HTML & CSS',
        timestamp: nowIso(),
      },
    ],
  };

  return pendingUpload;
}

export function localVerifyBaselineQuiz(
  userId: string,
  quiz: BaselineDiagnosticQuiz,
  answers: number[],
  targetRole: string,
  identity?: { fullName?: string; batchCohort?: string; claimedSkills?: ClaimedSkillItem[] }
): VerifiedProfileResponse {
  const verified: VerifiedSkillResult[] = [];
  const gaps: VerifiedSkillResult[] = [];
  let correct = 0;

  quiz.questions.forEach((q, idx) => {
    const ok = answers[idx] === q.correct_index;
    if (ok) {
      correct += 1;
      verified.push({
        skill_name: q.skill_tested,
        proficiency_level: 'Verified',
        is_verified: true,
        verification_score: 90,
        category: 'Core Competency',
        status: 'verified',
      });
    } else {
      gaps.push({
        skill_name: q.skill_tested,
        proficiency_level: 'Needs Review',
        is_verified: false,
        verification_score: 0,
        category: 'Core Competency',
        status: 'gap',
      });
    }
  });

  if (identity?.claimedSkills) {
    for (const c of identity.claimedSkills) {
      if (
        !verified.some((v) => skillsMatch(v.skill_name, c.skill_name)) &&
        !gaps.some((g) => skillsMatch(g.skill_name, c.skill_name))
      ) {
        verified.push({
          skill_name: c.skill_name,
          proficiency_level: `Claimed (${c.self_reported_confidence})`,
          is_verified: true,
          verification_score: 75,
          category: c.category || 'Core',
          status: 'verified',
        });
      }
    }
  }

  localProfile = {
    user_id: userId,
    full_name: identity?.fullName || pendingUpload?.extracted_profile.full_name || 'Candidate',
    batch_cohort: identity?.batchCohort || 'Batch 2027',
    target_role: targetRole,
    readiness_score: Math.round((correct / Math.max(quiz.questions.length, 1)) * 64),
    quiz_score_percent: Math.round((correct / Math.max(quiz.questions.length, 1)) * 100),
    verified_skills: verified,
    skill_gaps: gaps,
    extracted_profile: pendingUpload?.extracted_profile || null,
    agent_logs: [
      ...(pendingUpload?.agent_logs || []),
      {
        agent_name: 'Profiler Agent',
        action_summary: `Graded 60-second diagnostic at ${Math.round((correct / Math.max(quiz.questions.length, 1)) * 100)}% — verified ${verified.length} baseline skills`,
        timestamp: nowIso(),
      },
    ],
    storage_mode: 'firestore',
  };
  localRoadmap = null;
  return localProfile;
}

export function localGetCohortAnalytics(currentProfile?: VerifiedProfileResponse | null): CohortAnalyticsData {
  const active = currentProfile || localProfile;
  const isCustomUser = Boolean(active && active.user_id !== DEMO_USER_ID);

  const skillScoreFromProfile = (p: VerifiedProfileResponse | null, name: string, fallback: number) => {
    if (!p) return fallback;
    const found = [...p.verified_skills, ...p.skill_gaps].find((s) =>
      skillsMatch(s.skill_name, name)
    );
    return found ? Math.round(found.verification_score) : fallback;
  };

  const sophiaSource = active?.user_id === DEMO_USER_ID ? active : null;
  const students: CohortStudent[] = [
    ...(isCustomUser && active
      ? [
          {
            id: active.user_id,
            name: `${active.full_name} (You)`,
            cohort: active.batch_cohort || 'Batch 2027 · Member',
            target_role: active.target_role,
            readiness: Math.round(active.readiness_score),
            isCurrentUser: true,
            skills: {
              Python: skillScoreFromProfile(active, 'Python', 0),
              SQL: skillScoreFromProfile(active, 'SQL', 0),
              'HTML & CSS': skillScoreFromProfile(active, 'HTML & CSS', 0),
              'JavaScript ES6+': skillScoreFromProfile(active, 'JavaScript', 0),
              'React 19': skillScoreFromProfile(active, 'React', 0),
              'Node.js': skillScoreFromProfile(active, 'Node.js', 0),
            },
          },
        ]
      : []),
    {
      id: DEMO_USER_ID,
      name: sophiaSource ? `${sophiaSource.full_name} (Demo)` : 'Sophia Vance',
      cohort: 'Batch 2027 · CS',
      target_role: sophiaSource?.target_role || 'Full Stack Developer',
      readiness: sophiaSource ? Math.round(sophiaSource.readiness_score) : 64,
      skills: {
        Python: skillScoreFromProfile(sophiaSource, 'Python', 92),
        SQL: skillScoreFromProfile(sophiaSource, 'SQL', 88),
        'HTML & CSS': skillScoreFromProfile(sophiaSource, 'HTML & CSS', 85),
        'JavaScript ES6+': skillScoreFromProfile(sophiaSource, 'JavaScript', 0),
        'React 19': skillScoreFromProfile(sophiaSource, 'React', 0),
        'Node.js': skillScoreFromProfile(sophiaSource, 'Node.js', 0),
      },
    },
    {
      id: 'student-2027-02',
      name: 'Marcus Chen',
      cohort: 'Batch 2027 · CS',
      target_role: 'Backend Engineer',
      readiness: 78,
      skills: { Python: 94, SQL: 91, 'HTML & CSS': 68, 'JavaScript ES6+': 72, 'React 19': 40, 'Node.js': 84 },
    },
    {
      id: 'student-2027-03',
      name: 'Aanya Patel',
      cohort: 'Batch 2027 · AI Track',
      target_role: 'AI Engineer',
      readiness: 81,
      skills: { Python: 96, SQL: 82, 'HTML & CSS': 70, 'JavaScript ES6+': 55, 'React 19': 35, 'Node.js': 48 },
    },
    {
      id: 'student-2027-04',
      name: "Liam O'Connor",
      cohort: 'Batch 2027 · CS',
      target_role: 'Full Stack Developer',
      readiness: 72,
      skills: { Python: 76, SQL: 74, 'HTML & CSS': 90, 'JavaScript ES6+': 84, 'React 19': 78, 'Node.js': 52 },
    },
    {
      id: 'student-2027-05',
      name: 'Elena Rostova',
      cohort: 'Batch 2027 · Data Track',
      target_role: 'Data Scientist',
      readiness: 69,
      skills: { Python: 90, SQL: 89, 'HTML & CSS': 62, 'JavaScript ES6+': 32, 'React 19': 20, 'Node.js': 25 },
    },
    {
      id: 'student-2027-06',
      name: 'Devon Brooks',
      cohort: 'Batch 2027 · Systems',
      target_role: 'Full Stack Developer',
      readiness: 54,
      skills: { Python: 81, SQL: 72, 'HTML & CSS': 79, 'JavaScript ES6+': 38, 'React 19': 22, 'Node.js': 30 },
    },
  ];

  const skillColumns = ['Python', 'SQL', 'HTML & CSS', 'JavaScript ES6+', 'React 19', 'Node.js'];
  const bottlenecks = skillColumns
    .map((skill) => {
      const avg = Math.round((students.reduce((sum, s) => sum + (s.skills[skill as keyof typeof s.skills] || 0), 0) / students.length) * 10) / 10;
      const below = students.filter((s) => (s.skills[skill as keyof typeof s.skills] || 0) < 60).length;
      return { skill, cohort_average: avg, students_needing_support: below };
    })
    .sort((a, b) => a.cohort_average - b.cohort_average);

  const avgReadiness = Math.round((students.reduce((sum, s) => sum + s.readiness, 0) / students.length) * 10) / 10;

  return {
    cohort_name: 'Computer Science — Batch 2027',
    total_students: students.length,
    average_readiness: avgReadiness,
    skill_columns: skillColumns,
    students,
    bottlenecks,
  };
}

export function getLocalGaps(): SkillGapItem[] {
  return localGaps;
}

export function getLocalRoleSummary(): string {
  return localRoleSummary;
}

export function getLocalRoadmap(): RoadmapDAG | null {
  return localRoadmap;
}

export function getLocalProfile(): VerifiedProfileResponse | null {
  return localProfile;
}
