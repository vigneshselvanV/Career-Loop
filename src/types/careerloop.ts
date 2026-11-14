export type CareerView =
  | 'overview'
  | 'skills'
  | 'mentor'
  | 'cohort';

export type ExperienceLevel =
  | 'Student'
  | 'Entry Level'
  | 'Mid Level'
  | 'Career Switcher';

export interface EducationItem {
  institution: string;
  degree: string;
  graduation_year?: string | null;
}

export interface ExperienceItem {
  company: string;
  role: string;
  duration?: string | null;
  highlights: string[];
}

export interface ProjectItem {
  name: string;
  description: string;
  technologies: string[];
}

export interface ClaimedSkillItem {
  skill_name: string;
  self_reported_confidence: 'Beginner' | 'Intermediate' | 'Advanced';
  category: string;
}

export interface ExtractedProfile {
  full_name: string;
  headline: string;
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  certifications: string[];
  claimed_skills: ClaimedSkillItem[];
  suggested_target_role: string;
}

export interface VerifiedSkillResult {
  skill_name: string;
  proficiency_level: string;
  is_verified: boolean;
  verification_score: number;
  category: string;
  status: 'verified' | 'gap' | 'unverified';
}

export interface AgentLogEntry {
  agent_name: string;
  action_summary: string;
  timestamp: string;
}

export interface VerifiedProfileResponse {
  user_id: string;
  full_name: string;
  batch_cohort: string;
  target_role: string;
  readiness_score: number;
  quiz_score_percent: number;
  verified_skills: VerifiedSkillResult[];
  skill_gaps: VerifiedSkillResult[];
  extracted_profile?: ExtractedProfile | null;
  agent_logs: AgentLogEntry[];
  storage_mode: 'supabase' | 'in_memory' | 'firestore';
}

export interface DiagnosticQuestion {
  id: string;
  skill_tested: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface BaselineDiagnosticQuiz {
  target_role: string;
  estimated_seconds: number;
  questions: DiagnosticQuestion[];
}

export interface ProfileUploadResponse {
  user_id: string;
  target_role: string;
  extraction_method: 'pymupdf' | 'openrouter_vision';
  extracted_profile: ExtractedProfile;
  diagnostic_quiz: BaselineDiagnosticQuiz;
  agent_logs: AgentLogEntry[];
}

export interface SkillGapItem {
  skill_name: string;
  category: string;
  priority: 'Critical' | 'High' | 'Moderate';
  importance_weight: number;
  reason: string;
  current_status: 'Missing' | 'Unverified' | 'Below Threshold';
}

export interface MarketAnalysisResponse {
  user_id: string;
  target_role: string;
  readiness_score: number;
  matched_verified_skills: string[];
  skill_gaps: SkillGapItem[];
  role_summary: string;
  agent_logs: AgentLogEntry[];
}

export interface ResourceItem {
  id: string;
  title: string;
  url: string;
  resource_type: 'course' | 'video' | 'documentation' | 'exercise';
  target_skill: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  similarity: number;
}

export interface RoadmapNodeData extends Record<string, unknown> {
  label: string;
  skill_name: string;
  status: 'verified' | 'in_progress' | 'locked' | 'remediation';
  badge_text?: string | null;
  estimated_hours: number;
  description: string;
  resources: ResourceItem[];
  is_remediation: boolean;
  mastery_score?: number | null;
}

export interface RoadmapFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: RoadmapNodeData;
}

export interface RoadmapFlowEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  label?: string | null;
  style?: Record<string, unknown> | null;
}

export interface RoadmapDAG {
  user_id: string;
  target_role: string;
  nodes: RoadmapFlowNode[];
  edges: RoadmapFlowEdge[];
  rerouted: boolean;
  reroute_reason?: string | null;
}

export interface TopicQuizQuestion {
  id: string;
  topic: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface TopicQuiz {
  topic: string;
  target_role: string;
  questions: TopicQuizQuestion[];
}

export interface QuestionFeedback {
  question_id: string;
  question: string;
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
  explanation: string;
}

export interface AssessmentEvaluationResponse {
  user_id: string;
  topic: string;
  score_percent: number;
  passed: boolean;
  needs_reroute: boolean;
  feedback: QuestionFeedback[];
  mentor_advice: string;
  updated_roadmap?: RoadmapDAG | null;
  readiness_score: number;
  agent_logs: AgentLogEntry[];
}

export interface MentorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hint?: string;
  followups?: string[];
  timestamp: string;
}

export interface MentorChatResponse {
  reply: string;
  socratic_hint: string;
  suggested_followups: string[];
  agent_logs: AgentLogEntry[];
}

export interface CohortStudent {
  id: string;
  name: string;
  cohort: string;
  target_role: string;
  readiness: number;
  skills: Record<string, number>;
  isCurrentUser?: boolean;
}

export interface CohortBottleneck {
  skill: string;
  cohort_average: number;
  students_needing_support: number;
}

export interface CohortAnalyticsData {
  cohort_name: string;
  total_students: number;
  average_readiness: number;
  skill_columns: string[];
  students: CohortStudent[];
  bottlenecks: CohortBottleneck[];
}

export interface RoleBenchmarkSummary {
  role_title: string;
  description: string;
  required_skills: {
    skill_name: string;
    category: string;
    importance_weight: number;
    required_proficiency: string;
  }[];
}

export interface OnboardingAnalyzeRequest {
  user_id: string;
  full_name: string;
  target_role: string;
  batch_cohort: string;
  experience_level: ExperienceLevel;
  background_note: string;
  selected_skills: string[];
}

export interface OnboardingAnalyzeResponse {
  coach_message: string;
  follow_up_question: string;
  suggested_skills: ClaimedSkillItem[];
  diagnostic_quiz: BaselineDiagnosticQuiz;
  agent_logs: AgentLogEntry[];
}

export interface PersistedWorkspacePayload {
  targetRole: string;
  readinessScore: number;
  quizScorePercent?: number;
  roleSummary: string;
  rerouted: boolean;
  rerouteReason?: string | null;
  verifiedSkills: VerifiedSkillResult[];
  skillGaps: SkillGapItem[];
  roadmapNodes: RoadmapFlowNode[];
  roadmapEdges: RoadmapFlowEdge[];
  agentLogs: AgentLogEntry[];
  claimedSkills?: ClaimedSkillItem[];
}
