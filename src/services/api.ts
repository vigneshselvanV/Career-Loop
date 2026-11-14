import { getFirebaseIdToken } from '../firebase';
import type {
  AgentLogEntry,
  AssessmentEvaluationResponse,
  BaselineDiagnosticQuiz,
  ClaimedSkillItem,
  CohortAnalyticsData,
  MarketAnalysisResponse,
  MentorChatResponse,
  OnboardingAnalyzeRequest,
  OnboardingAnalyzeResponse,
  ProfileUploadResponse,
  RoadmapDAG,
  RoleBenchmarkSummary,
  TopicQuiz,
  VerifiedProfileResponse,
} from '../types/careerloop';
import {
  FALLBACK_ROLE_BENCHMARKS,
  getLocalProfile,
  localAnalyzeGaps,
  localAnalyzeOnboarding,
  localBuildRoadmap,
  localGenerateTopicQuiz,
  localGetCohortAnalytics,
  localLoadDemoPersona,
  localMentorChat,
  localSimulateFail,
  localSubmitTopicQuiz,
  localUploadResume,
  localVerifyBaselineQuiz,
} from './localFallback';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 14000);
  try {
    const token = await getFirebaseIdToken();
    const mergedHeaders = new Headers(options?.headers || {});
    if (token && !mergedHeaders.has('Authorization')) {
      mergedHeaders.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: mergedHeaders,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`API ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export const careerLoopApi = {
  async analyzeOnboarding(
    payload: OnboardingAnalyzeRequest
  ): Promise<OnboardingAnalyzeResponse> {
    try {
      return await requestJson<OnboardingAnalyzeResponse>('/api/onboarding/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      return localAnalyzeOnboarding(payload);
    }
  },

  async streamAgentSteps(
    params: {
      userId: string;
      requestedAction: string;
      targetRole: string;
      topic?: string;
      scorePercent?: number;
    },
    onLogs: (logs: AgentLogEntry[]) => void
  ): Promise<void> {
    try {
      const token = await getFirebaseIdToken();
      const res = await fetch(`${API_BASE}/api/agent/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: params.userId,
          requested_action: params.requestedAction,
          target_role: params.targetRole,
          target_role_changed: params.requestedAction === 'switch_role',
          topic: params.topic,
          score_percent: params.scorePercent,
        }),
      });

      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const chunk of events) {
          const dataLine = chunk
            .split('\n')
            .find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine.slice(6)) as {
              logs?: AgentLogEntry[];
            };
            if (Array.isArray(parsed.logs) && parsed.logs.length > 0) {
              onLogs(parsed.logs);
            }
          } catch {
            // Ignore malformed SSE chunk
          }
        }
      }
    } catch {
      // Non-fatal: deterministic fallback logs still populate
    }
  },

  async loadDemoPersona(): Promise<VerifiedProfileResponse> {
    try {
      return await requestJson<VerifiedProfileResponse>('/api/profile/demo-persona', {
        method: 'POST',
      });
    } catch {
      return localLoadDemoPersona();
    }
  },

  async uploadResumePdf(file: File, targetRole: string): Promise<ProfileUploadResponse> {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('target_role', targetRole);
      return await requestJson<ProfileUploadResponse>('/api/profile/upload', {
        method: 'POST',
        body: form,
      });
    } catch {
      return localUploadResume(file.name, targetRole);
    }
  },

  async verifyBaselineDiagnostic(
    userId: string,
    targetRole: string,
    quiz: BaselineDiagnosticQuiz,
    userAnswers: number[],
    identity?: { fullName?: string; batchCohort?: string; claimedSkills?: ClaimedSkillItem[] }
  ): Promise<VerifiedProfileResponse> {
    try {
      return await requestJson<VerifiedProfileResponse>('/api/profile/verify-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          target_role: targetRole,
          quiz,
          user_answers: userAnswers,
        }),
      });
    } catch {
      return localVerifyBaselineQuiz(userId, quiz, userAnswers, targetRole, identity);
    }
  },

  async listRoles(): Promise<RoleBenchmarkSummary[]> {
    try {
      return await requestJson<RoleBenchmarkSummary[]>('/api/market/roles');
    } catch {
      return FALLBACK_ROLE_BENCHMARKS;
    }
  },

  async analyzeGaps(userId: string, targetRole?: string): Promise<MarketAnalysisResponse> {
    try {
      return await requestJson<MarketAnalysisResponse>('/api/market/analyze-gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, target_role: targetRole }),
      });
    } catch {
      return localAnalyzeGaps(userId, targetRole);
    }
  },

  async switchRole(userId: string, newTargetRole: string): Promise<MarketAnalysisResponse> {
    try {
      return await requestJson<MarketAnalysisResponse>('/api/market/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, new_target_role: newTargetRole }),
      });
    } catch {
      return localAnalyzeGaps(userId, newTargetRole);
    }
  },

  async buildRoadmap(
    userId: string,
    targetRole?: string
  ): Promise<{ roadmap: RoadmapDAG; readiness_score: number; agent_logs: VerifiedProfileResponse['agent_logs'] }> {
    try {
      return await requestJson('/api/roadmap/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, target_role: targetRole }),
      });
    } catch {
      return localBuildRoadmap(userId, targetRole);
    }
  },

  async generateQuiz(
    userId: string,
    topic: string,
    numQuestions = 5,
    targetRole = 'Full Stack Developer'
  ): Promise<TopicQuiz> {
    try {
      return await requestJson<TopicQuiz>('/api/mentor/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          topic,
          num_questions: numQuestions,
          target_role: targetRole,
        }),
      });
    } catch {
      return localGenerateTopicQuiz(topic, targetRole);
    }
  },

  async submitQuiz(
    userId: string,
    topic: string,
    quiz: TopicQuiz,
    userAnswers: number[]
  ): Promise<AssessmentEvaluationResponse> {
    try {
      return await requestJson<AssessmentEvaluationResponse>('/api/mentor/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          topic,
          quiz,
          user_answers: userAnswers,
        }),
      });
    } catch {
      return localSubmitTopicQuiz(userId, topic, quiz, userAnswers);
    }
  },

  async simulateQuizFail(
    userId: string,
    topic = 'JavaScript ES6+ & Async',
    scorePercent = 40
  ): Promise<AssessmentEvaluationResponse> {
    try {
      return await requestJson<AssessmentEvaluationResponse>('/api/mentor/quiz/simulate-fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, topic, score_percent: scorePercent }),
      });
    } catch {
      return localSimulateFail(userId, topic, scorePercent);
    }
  },

  async sendMentorChat(
    userId: string,
    topic: string,
    message: string,
    history: { role: string; content: string }[],
    context?: { verifiedSkills?: string[]; targetRole?: string }
  ): Promise<MentorChatResponse> {
    try {
      return await requestJson<MentorChatResponse>('/api/mentor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          topic,
          message,
          history,
          verified_skills: context?.verifiedSkills,
          target_role: context?.targetRole,
        }),
      });
    } catch {
      return localMentorChat(topic, message);
    }
  },

  async getCohortAnalytics(currentProfile?: VerifiedProfileResponse | null): Promise<CohortAnalyticsData> {
    try {
      const remote = await requestJson<CohortAnalyticsData>('/api/analytics/cohort');
      const active = currentProfile || getLocalProfile();
      if (active && active.user_id !== '11111111-1111-4111-8111-111111111111') {
        // Ensure signed-in user appears in cohort benchmark even when backend returns static batch
        return localGetCohortAnalytics(active);
      }
      return remote;
    } catch {
      return localGetCohortAnalytics(currentProfile);
    }
  },
};
