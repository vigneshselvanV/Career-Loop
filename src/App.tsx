import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Menu } from 'lucide-react';
import { AssessmentsMentorView } from './components/AssessmentsMentorView';
import { CohortAnalyticsView } from './components/CohortAnalyticsView';
import { LoginPage } from './components/LoginPage';
import { OnboardingWizard } from './components/OnboardingWizard';
import { PdfUploadModal } from './components/PdfUploadModal';
import { RightDrawer } from './components/RightDrawer';
import { RoadmapCanvas } from './components/RoadmapCanvas';
import { Sidebar } from './components/Sidebar';
import { SkillMatrixView } from './components/SkillMatrixView';
import {
  auth,
  ensureUserAccountDoc,
  loadUserWorkspaceDoc,
  saveAssessmentRecordDoc,
  saveUserWorkspaceDoc,
  signOutFirebase,
  updateUserAccountDoc,
  updateUserTargetRoleDoc,
  type UserAccountState,
} from './firebase';
import { careerLoopApi } from './services/api';
import {
  FALLBACK_ROLE_BENCHMARKS,
  getLocalGaps,
  getLocalRoadmap,
  getLocalRoleSummary,
  localHydrateFromFirestore,
} from './services/localFallback';
import type {
  AgentLogEntry,
  AssessmentEvaluationResponse,
  BaselineDiagnosticQuiz,
  CareerView,
  ClaimedSkillItem,
  CohortAnalyticsData,
  ExperienceLevel,
  MentorMessage,
  PersistedWorkspacePayload,
  ProfileUploadResponse,
  RoadmapDAG,
  RoadmapFlowNode,
  SkillGapItem,
  TopicQuiz,
  VerifiedProfileResponse,
  VerifiedSkillResult,
} from './types/careerloop';

const VIEW_TITLES: Record<CareerView, string> = {
  overview: 'Overview & Learning Roadmap',
  skills: 'Competency & Skill Matrix',
  mentor: 'Assessments & AI Mentor',
  cohort: 'University Cohort Analytics',
};

function buildMentorWelcome(
  fullName: string,
  verifiedSkills: VerifiedSkillResult[],
  targetRole: string,
  focusTopic: string
): MentorMessage {
  const firstName = fullName.trim().split(' ')[0] || 'there';
  const topVerified = verifiedSkills
    .slice(0, 3)
    .map((v) => v.skill_name)
    .join(', ');
  const anchorText = topVerified
    ? `since you already verified ${topVerified}`
    : `as you work toward ${targetRole}`;

  return {
    id: `welcome-mentor-${Date.now()}`,
    role: 'assistant',
    content: `Hi ${firstName} — ${anchorText}, I can help you bridge into ${focusTopic} by mapping new concepts back to patterns you already understand. What would you like to unpack first?`,
    hint: 'Ask a conceptual question, or click any module in your roadmap.',
    followups: [
      `How should I approach ${focusTopic} first?`,
      `What common mistakes occur in ${focusTopic}?`,
    ],
    timestamp: new Date().toISOString(),
  };
}

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [userAccount, setUserAccount] = useState<UserAccountState | null>(null);
  const [isInitializingWorkspace, setIsInitializingWorkspace] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  const [activeView, setActiveView] = useState<CareerView>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const [profile, setProfile] = useState<VerifiedProfileResponse | null>(null);
  const [roleOptions, setRoleOptions] = useState<string[]>(
    FALLBACK_ROLE_BENCHMARKS.map((r) => r.role_title)
  );
  const [readinessScore, setReadinessScore] = useState<number>(0);
  const [roleSummary, setRoleSummary] = useState<string>('');
  const [skillGaps, setSkillGaps] = useState<SkillGapItem[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapDAG | null>(null);
  const [selectedNode, setSelectedNode] = useState<RoadmapFlowNode | null>(null);
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);

  const [activeTopic, setActiveTopic] = useState<string>('JavaScript ES6+ & Async');
  const [activeQuiz, setActiveQuiz] = useState<TopicQuiz | null>(null);
  const [quizResult, setQuizResult] = useState<AssessmentEvaluationResponse | null>(null);
  const [mentorMessages, setMentorMessages] = useState<MentorMessage[]>([]);

  const [cohortData, setCohortData] = useState<CohortAnalyticsData | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isMentorLoading, setIsMentorLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setUserAccount(null);
        setProfile(null);
        setRoadmap(null);
        setShowOnboarding(false);
        setIsDemoMode(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const persistWorkspace = useCallback(
    async (
      user: User,
      payload: PersistedWorkspacePayload,
      options?: {
        force?: boolean;
        accountPatch?: Partial<Omit<UserAccountState, 'uid' | 'email'>>;
        assessmentRecord?: {
          topic: string;
          scorePercent: number;
          passed: boolean;
          triggeredReroute: boolean;
        };
      }
    ) => {
      if (!user.emailVerified) return;
      if (isDemoMode && !options?.force) return;

      const jobs: Promise<void>[] = [saveUserWorkspaceDoc(user, payload)];
      if (options?.accountPatch) {
        jobs.push(updateUserAccountDoc(user, options.accountPatch));
      } else {
        jobs.push(updateUserTargetRoleDoc(user, payload.targetRole, payload.readinessScore));
      }
      if (options?.assessmentRecord) {
        jobs.push(saveAssessmentRecordDoc(user, options.assessmentRecord));
      }
      await Promise.all(jobs);
    },
    [isDemoMode]
  );

  const syncWorkspaceForProfile = useCallback(
    async (
      loadedProfile: VerifiedProfileResponse,
      options?: { persistToUser?: User | null; claimedSkills?: ClaimedSkillItem[] }
    ) => {
      setProfile(loadedProfile);
      setReadinessScore(loadedProfile.readiness_score);
      setAgentLogs(loadedProfile.agent_logs);

      const [analysis, builtRoadmap] = await Promise.all([
        careerLoopApi.analyzeGaps(loadedProfile.user_id, loadedProfile.target_role),
        careerLoopApi.buildRoadmap(loadedProfile.user_id, loadedProfile.target_role),
      ]);

      const updatedProfile: VerifiedProfileResponse = {
        ...loadedProfile,
        target_role: analysis.target_role,
        readiness_score: analysis.readiness_score,
        agent_logs: builtRoadmap.agent_logs,
      };
      const resolvedGaps = analysis.skill_gaps.length ? analysis.skill_gaps : getLocalGaps();
      const resolvedSummary = analysis.role_summary || getLocalRoleSummary();

      setProfile(updatedProfile);
      setReadinessScore(analysis.readiness_score);
      setRoleSummary(resolvedSummary);
      setSkillGaps(resolvedGaps);
      setRoadmap(builtRoadmap.roadmap);
      setAgentLogs(builtRoadmap.agent_logs);

      const firstFocusNode =
        builtRoadmap.roadmap.nodes.find((n) => n.data.status === 'in_progress') ||
        builtRoadmap.roadmap.nodes.find((n) => n.data.status === 'remediation') ||
        builtRoadmap.roadmap.nodes[0] ||
        null;
      setSelectedNode(firstFocusNode);
      const focusTopic = firstFocusNode?.data.skill_name || resolvedGaps[0]?.skill_name || 'Core Foundations';
      setActiveTopic(focusTopic);
      setMentorMessages([
        buildMentorWelcome(
          updatedProfile.full_name,
          updatedProfile.verified_skills,
          updatedProfile.target_role,
          focusTopic
        ),
      ]);

      const cohort = await careerLoopApi.getCohortAnalytics(updatedProfile);
      setCohortData(cohort);

      if (options?.persistToUser && options.persistToUser.emailVerified) {
        await persistWorkspace(
          options.persistToUser,
          {
            targetRole: updatedProfile.target_role,
            readinessScore: analysis.readiness_score,
            quizScorePercent: updatedProfile.quiz_score_percent,
            roleSummary: resolvedSummary,
            rerouted: builtRoadmap.roadmap.rerouted,
            rerouteReason: builtRoadmap.roadmap.reroute_reason ?? null,
            verifiedSkills: updatedProfile.verified_skills,
            skillGaps: resolvedGaps,
            roadmapNodes: builtRoadmap.roadmap.nodes,
            roadmapEdges: builtRoadmap.roadmap.edges,
            agentLogs: builtRoadmap.agent_logs,
            claimedSkills: options.claimedSkills,
          },
          { force: true }
        );
      }

      return { updatedProfile, analysis, builtRoadmap, resolvedGaps, resolvedSummary };
    },
    [persistWorkspace]
  );

  const hydrateWorkspaceFromFirestore = useCallback(
    async (user: User, account: UserAccountState) => {
      const saved = await loadUserWorkspaceDoc(user);
      if (saved && saved.roadmapNodes.length > 0) {
        const hydrated = localHydrateFromFirestore({
          userId: user.uid,
          fullName: account.displayName,
          batchCohort: account.batchCohort,
          workspace: saved,
        });
        const dag: RoadmapDAG = {
          user_id: user.uid,
          target_role: saved.targetRole,
          nodes: saved.roadmapNodes,
          edges: saved.roadmapEdges,
          rerouted: saved.rerouted,
          reroute_reason: saved.rerouteReason ?? null,
        };
        const focusNode =
          dag.nodes.find((n) => n.data.status === 'remediation') ||
          dag.nodes.find((n) => n.data.status === 'in_progress') ||
          dag.nodes[0] ||
          null;
        const focusTopic =
          focusNode?.data.skill_name || saved.skillGaps[0]?.skill_name || 'JavaScript ES6+ & Async';

        setProfile(hydrated);
        setReadinessScore(saved.readinessScore);
        setRoleSummary(saved.roleSummary);
        setSkillGaps(saved.skillGaps);
        setRoadmap(dag);
        setAgentLogs(saved.agentLogs);
        setSelectedNode(focusNode);
        setActiveTopic(focusTopic);
        setMentorMessages([
          buildMentorWelcome(account.displayName, saved.verifiedSkills, saved.targetRole, focusTopic),
        ]);
        const cohort = await careerLoopApi.getCohortAnalytics(hydrated);
        setCohortData(cohort);
        return;
      }

      // Edge case: account completed onboarding but workspace doc is missing; rebuild cleanly
      const builtFallbackProfile: VerifiedProfileResponse = {
        user_id: user.uid,
        full_name: account.displayName,
        batch_cohort: account.batchCohort,
        target_role: account.targetRole,
        readiness_score: account.readinessScore,
        quiz_score_percent: 100,
        verified_skills: [],
        skill_gaps: [],
        extracted_profile: null,
        agent_logs: [
          {
            agent_name: 'Supervisor',
            action_summary: `Initialized personal workspace for ${account.displayName} (${account.targetRole})`,
            timestamp: new Date().toISOString(),
          },
        ],
        storage_mode: 'firestore',
      };
      await syncWorkspaceForProfile(builtFallbackProfile, { persistToUser: user });
    },
    [syncWorkspaceForProfile]
  );

  const handleLoadDemoPersona = useCallback(async () => {
    setIsBusy(true);
    setQuizResult(null);
    setActiveQuiz(null);
    try {
      setIsDemoMode(true);
      setShowOnboarding(false);
      const demo = await careerLoopApi.loadDemoPersona();
      await syncWorkspaceForProfile(demo);
      setActiveView('overview');
    } finally {
      setIsBusy(false);
    }
  }, [syncWorkspaceForProfile]);

  useEffect(() => {
    if (!authReady || !authUser) return;
    let mounted = true;
    setIsInitializingWorkspace(true);
    (async () => {
      try {
        const [roles, account] = await Promise.all([
          careerLoopApi.listRoles().catch(() => FALLBACK_ROLE_BENCHMARKS),
          ensureUserAccountDoc(authUser, 'Full Stack Developer'),
        ]);
        if (!mounted) return;
        if (roles.length > 0) {
          setRoleOptions(roles.map((r) => r.role_title));
        }
        setUserAccount(account);
        setIsDemoMode(false);

        if (!account.onboardingCompleted) {
          setShowOnboarding(true);
        } else {
          setShowOnboarding(false);
          await hydrateWorkspaceFromFirestore(authUser, account);
        }
      } catch {
        if (mounted) {
          setShowOnboarding(true);
        }
      } finally {
        if (mounted) {
          setIsInitializingWorkspace(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authReady, authUser, hydrateWorkspaceFromFirestore]);

  const handleCompleteOnboarding = async (result: {
    fullName: string;
    batchCohort: string;
    experienceLevel: ExperienceLevel;
    learningGoal: string;
    targetRole: string;
    claimedSkills: ClaimedSkillItem[];
    quiz: BaselineDiagnosticQuiz;
    answers: number[];
    onboardingLogs: AgentLogEntry[];
  }) => {
    if (!authUser) return;
    setIsBusy(true);
    setQuizResult(null);
    setActiveQuiz(null);
    try {
      const verified = await careerLoopApi.verifyBaselineDiagnostic(
        authUser.uid,
        result.targetRole,
        result.quiz,
        result.answers,
        {
          fullName: result.fullName,
          batchCohort: result.batchCohort,
          claimedSkills: result.claimedSkills,
        }
      );

      verified.agent_logs = [...result.onboardingLogs, ...verified.agent_logs];
      setIsDemoMode(false);

      const synced = await syncWorkspaceForProfile(verified, {
        claimedSkills: result.claimedSkills,
      });

      void careerLoopApi.streamAgentSteps(
        {
          userId: authUser.uid,
          requestedAction: 'build_roadmap',
          targetRole: result.targetRole,
        },
        (streamedLogs) => {
          setAgentLogs((prev) => [...prev, ...streamedLogs]);
        }
      );

      const updatedAccount: UserAccountState = {
        uid: authUser.uid,
        displayName: result.fullName,
        email: authUser.email || undefined,
        targetRole: synced.analysis.target_role,
        batchCohort: result.batchCohort,
        experienceLevel: result.experienceLevel,
        learningGoal: result.learningGoal,
        onboardingCompleted: true,
        isDemoMode: false,
        readinessScore: synced.analysis.readiness_score,
      };
      setUserAccount(updatedAccount);

      await persistWorkspace(
        authUser,
        {
          targetRole: synced.analysis.target_role,
          readinessScore: synced.analysis.readiness_score,
          quizScorePercent: verified.quiz_score_percent,
          roleSummary: synced.resolvedSummary,
          rerouted: synced.builtRoadmap.roadmap.rerouted,
          rerouteReason: synced.builtRoadmap.roadmap.reroute_reason ?? null,
          verifiedSkills: verified.verified_skills,
          skillGaps: synced.resolvedGaps,
          roadmapNodes: synced.builtRoadmap.roadmap.nodes,
          roadmapEdges: synced.builtRoadmap.roadmap.edges,
          agentLogs: synced.builtRoadmap.agent_logs,
          claimedSkills: result.claimedSkills,
        },
        {
          force: true,
          accountPatch: {
            displayName: result.fullName,
            batchCohort: result.batchCohort,
            experienceLevel: result.experienceLevel,
            learningGoal: result.learningGoal,
            targetRole: synced.analysis.target_role,
            onboardingCompleted: true,
            isDemoMode: false,
            readinessScore: synced.analysis.readiness_score,
          },
          assessmentRecord: {
            topic: `${synced.analysis.target_role} Baseline Diagnostic`,
            scorePercent: verified.quiz_score_percent,
            passed: verified.quiz_score_percent >= 60,
            triggeredReroute: false,
          },
        }
      );

      setShowOnboarding(false);
      setActiveView('overview');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReturnToMyWorkspace = async () => {
    if (!authUser) return;
    setIsBusy(true);
    setQuizResult(null);
    setActiveQuiz(null);
    try {
      setIsDemoMode(false);
      const account = userAccount || (await ensureUserAccountDoc(authUser, 'Full Stack Developer'));
      setUserAccount(account);
      if (!account.onboardingCompleted) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
        await hydrateWorkspaceFromFirestore(authUser, account);
        setActiveView('overview');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleSwitchRole = async (newRole: string) => {
    if (!profile || newRole === profile.target_role) return;
    setIsBusy(true);
    setQuizResult(null);
    setActiveQuiz(null);
    try {
      const switched = await careerLoopApi.switchRole(profile.user_id, newRole);
      const built = await careerLoopApi.buildRoadmap(profile.user_id, newRole);

      const updatedProfile: VerifiedProfileResponse = {
        ...profile,
        target_role: switched.target_role,
        readiness_score: switched.readiness_score,
        agent_logs: built.agent_logs,
      };
      const cohort = await careerLoopApi.getCohortAnalytics(updatedProfile);

      setProfile(updatedProfile);
      setReadinessScore(switched.readiness_score);
      setRoleSummary(switched.role_summary);
      setSkillGaps(switched.skill_gaps);
      setRoadmap(built.roadmap);
      setAgentLogs(built.agent_logs);
      setCohortData(cohort);

      const firstFocus =
        built.roadmap.nodes.find((n) => n.data.status === 'in_progress') ||
        built.roadmap.nodes[0] ||
        null;
      setSelectedNode(firstFocus);
      if (firstFocus) setActiveTopic(firstFocus.data.skill_name);

      void careerLoopApi.streamAgentSteps(
        {
          userId: profile.user_id,
          requestedAction: 'switch_role',
          targetRole: switched.target_role,
        },
        (streamedLogs) => {
          setAgentLogs((prev) => [...prev, ...streamedLogs]);
        }
      );

      if (authUser && !isDemoMode) {
        setUserAccount((prev) =>
          prev
            ? {
                ...prev,
                targetRole: switched.target_role,
                readinessScore: switched.readiness_score,
              }
            : prev
        );
        await persistWorkspace(authUser, {
          targetRole: switched.target_role,
          readinessScore: switched.readiness_score,
          quizScorePercent: updatedProfile.quiz_score_percent,
          roleSummary: switched.role_summary,
          rerouted: built.roadmap.rerouted,
          rerouteReason: built.roadmap.reroute_reason ?? null,
          verifiedSkills: updatedProfile.verified_skills,
          skillGaps: switched.skill_gaps,
          roadmapNodes: built.roadmap.nodes,
          roadmapEdges: built.roadmap.edges,
          agentLogs: built.agent_logs,
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleSimulateFail = async () => {
    if (!profile) return;
    setIsBusy(true);
    try {
      const res = await careerLoopApi.simulateQuizFail(
        profile.user_id,
        'JavaScript ES6+ & Async',
        40
      );
      setQuizResult(res);
      setActiveQuiz(null);
      if (res.updated_roadmap) {
        setRoadmap(res.updated_roadmap);
        const remNode = res.updated_roadmap.nodes.find((n) => n.data.is_remediation) || null;
        if (remNode) {
          setSelectedNode(remNode);
          setActiveTopic(remNode.data.skill_name);
        }
      }
      setAgentLogs(res.agent_logs);
      setActiveView('overview');

      void careerLoopApi.streamAgentSteps(
        {
          userId: profile.user_id,
          requestedAction: 'evaluate_quiz',
          targetRole: profile.target_role,
          topic: 'JavaScript ES6+ & Async',
          scorePercent: 40,
        },
        (streamedLogs) => {
          setAgentLogs((prev) => [...prev, ...streamedLogs]);
        }
      );

      if (authUser && !isDemoMode && res.updated_roadmap) {
        await persistWorkspace(
          authUser,
          {
            targetRole: profile.target_role,
            readinessScore: res.readiness_score,
            quizScorePercent: res.score_percent,
            roleSummary,
            rerouted: res.updated_roadmap.rerouted,
            rerouteReason: res.updated_roadmap.reroute_reason ?? null,
            verifiedSkills: profile.verified_skills,
            skillGaps,
            roadmapNodes: res.updated_roadmap.nodes,
            roadmapEdges: res.updated_roadmap.edges,
            agentLogs: res.agent_logs,
          },
          {
            assessmentRecord: {
              topic: 'JavaScript ES6+ & Async',
              scorePercent: res.score_percent,
              passed: res.passed,
              triggeredReroute: res.needs_reroute,
            },
          }
        );
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateQuiz = async (topic: string) => {
    if (!profile) return;
    setIsBusy(true);
    setQuizResult(null);
    try {
      const quiz = await careerLoopApi.generateQuiz(
        profile.user_id,
        topic,
        5,
        profile.target_role
      );
      setActiveQuiz(quiz);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitQuiz = async (quiz: TopicQuiz, answers: number[]) => {
    if (!profile) return;
    setIsBusy(true);
    try {
      const res = await careerLoopApi.submitQuiz(profile.user_id, quiz.topic, quiz, answers);
      setQuizResult(res);
      setReadinessScore(res.readiness_score);
      setAgentLogs(res.agent_logs);
      if (res.updated_roadmap) {
        setRoadmap(res.updated_roadmap);
      }
      const analysis = await careerLoopApi.analyzeGaps(profile.user_id, profile.target_role);
      setSkillGaps(analysis.skill_gaps);
      if (analysis.role_summary) setRoleSummary(analysis.role_summary);

      const updatedProfile: VerifiedProfileResponse = {
        ...profile,
        readiness_score: res.readiness_score,
        verified_skills: res.passed
          ? profile.verified_skills.some(
              (v) => v.skill_name.toLowerCase() === quiz.topic.toLowerCase()
            )
            ? profile.verified_skills.map((v) =>
                v.skill_name.toLowerCase() === quiz.topic.toLowerCase()
                  ? { ...v, verification_score: res.score_percent, is_verified: true, status: 'verified' }
                  : v
              )
            : [
                ...profile.verified_skills,
                {
                  skill_name: quiz.topic,
                  proficiency_level: 'Verified',
                  is_verified: true,
                  verification_score: res.score_percent,
                  category: 'Verified Competency',
                  status: 'verified',
                },
              ]
          : profile.verified_skills,
      };
      setProfile(updatedProfile);

      const cohort = await careerLoopApi.getCohortAnalytics(updatedProfile);
      setCohortData(cohort);

      void careerLoopApi.streamAgentSteps(
        {
          userId: profile.user_id,
          requestedAction: 'evaluate_quiz',
          targetRole: profile.target_role,
          topic: quiz.topic,
          scorePercent: res.score_percent,
        },
        (streamedLogs) => {
          setAgentLogs((prev) => [...prev, ...streamedLogs]);
        }
      );

      if (authUser && !isDemoMode) {
        const currentDag = res.updated_roadmap || roadmap || getLocalRoadmap();
        await persistWorkspace(
          authUser,
          {
            targetRole: updatedProfile.target_role,
            readinessScore: res.readiness_score,
            quizScorePercent: res.score_percent,
            roleSummary: analysis.role_summary || roleSummary,
            rerouted: Boolean(currentDag?.rerouted),
            rerouteReason: currentDag?.reroute_reason ?? null,
            verifiedSkills: updatedProfile.verified_skills,
            skillGaps: analysis.skill_gaps,
            roadmapNodes: currentDag?.nodes || [],
            roadmapEdges: currentDag?.edges || [],
            agentLogs: res.agent_logs,
          },
          {
            assessmentRecord: {
              topic: quiz.topic,
              scorePercent: res.score_percent,
              passed: res.passed,
              triggeredReroute: res.needs_reroute,
            },
          }
        );
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendMentorMessage = async (text: string) => {
    if (!profile) return;
    const userMsg: MentorMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMentorMessages((prev) => [...prev, userMsg]);
    setIsMentorLoading(true);
    try {
      const historyPayload = mentorMessages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await careerLoopApi.sendMentorChat(
        profile.user_id,
        activeTopic,
        text,
        historyPayload,
        {
          verifiedSkills: profile.verified_skills.map((s) => s.skill_name),
          targetRole: profile.target_role,
        }
      );
      const botMsg: MentorMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        hint: res.socratic_hint,
        followups: res.suggested_followups,
        timestamp: new Date().toISOString(),
      };
      setMentorMessages((prev) => [...prev, botMsg]);
      setAgentLogs(res.agent_logs);
    } finally {
      setIsMentorLoading(false);
    }
  };

  const handleCompleteUploadedDiagnostic = async (
    uploadRes: ProfileUploadResponse,
    answers: number[]
  ) => {
    setIsBusy(true);
    setQuizResult(null);
    setActiveQuiz(null);
    try {
      const targetUserId = authUser?.uid || uploadRes.user_id;
      const fullName =
        userAccount?.displayName ||
        authUser?.displayName ||
        uploadRes.extracted_profile.full_name;
      const batchCohort = userAccount?.batchCohort || 'Batch 2027';

      const verified = await careerLoopApi.verifyBaselineDiagnostic(
        targetUserId,
        uploadRes.target_role,
        uploadRes.diagnostic_quiz,
        answers,
        {
          fullName,
          batchCohort,
          claimedSkills: uploadRes.extracted_profile.claimed_skills,
        }
      );
      setIsDemoMode(false);
      const synced = await syncWorkspaceForProfile(verified, {
        claimedSkills: uploadRes.extracted_profile.claimed_skills,
      });

      if (authUser && authUser.emailVerified) {
        setUserAccount((prev) =>
          prev
            ? {
                ...prev,
                displayName: fullName,
                targetRole: synced.analysis.target_role,
                onboardingCompleted: true,
                isDemoMode: false,
                readinessScore: synced.analysis.readiness_score,
              }
            : prev
        );
        await persistWorkspace(
          authUser,
          {
            targetRole: synced.analysis.target_role,
            readinessScore: synced.analysis.readiness_score,
            quizScorePercent: verified.quiz_score_percent,
            roleSummary: synced.resolvedSummary,
            rerouted: synced.builtRoadmap.roadmap.rerouted,
            rerouteReason: synced.builtRoadmap.roadmap.reroute_reason ?? null,
            verifiedSkills: verified.verified_skills,
            skillGaps: synced.resolvedGaps,
            roadmapNodes: synced.builtRoadmap.roadmap.nodes,
            roadmapEdges: synced.builtRoadmap.roadmap.edges,
            agentLogs: synced.builtRoadmap.agent_logs,
            claimedSkills: uploadRes.extracted_profile.claimed_skills,
          },
          {
            force: true,
            accountPatch: {
              displayName: fullName,
              targetRole: synced.analysis.target_role,
              onboardingCompleted: true,
              isDemoMode: false,
              readinessScore: synced.analysis.readiness_score,
            },
            assessmentRecord: {
              topic: `${synced.analysis.target_role} Resume Diagnostic`,
              scorePercent: verified.quiz_score_percent,
              passed: verified.quiz_score_percent >= 60,
              triggeredReroute: false,
            },
          }
        );
      }

      setShowOnboarding(false);
      setActiveView('overview');
    } finally {
      setIsBusy(false);
    }
  };

  if (!authReady || (authUser && isInitializingWorkspace)) {
    return (
      <div className="careerloop-canvas-bg min-h-screen flex items-center justify-center text-[14px] text-[#6E6E73]">
        {!authReady ? 'Checking authentication...' : 'Loading your CareerLoop workspace...'}
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage />;
  }

  const pdfModal = (
    <PdfUploadModal
      open={uploadModalOpen}
      defaultRole={
        profile?.target_role || userAccount?.targetRole || 'Full Stack Developer'
      }
      availableRoles={roleOptions}
      onClose={() => setUploadModalOpen(false)}
      onUploadPdf={(file, role) => careerLoopApi.uploadResumePdf(file, role)}
      onCompleteDiagnostic={handleCompleteUploadedDiagnostic}
    />
  );

  if (showOnboarding) {
    return (
      <>
        <OnboardingWizard
          authUser={authUser}
          initialDisplayName={
            userAccount?.displayName || authUser.displayName || 'Learner'
          }
          initialTargetRole={userAccount?.targetRole || 'Full Stack Developer'}
          availableRoles={roleOptions}
          onCompleteOnboarding={handleCompleteOnboarding}
          onUseDemoInstead={handleLoadDemoPersona}
          onOpenPdfUpload={() => setUploadModalOpen(true)}
          onSignOut={() => {
            void signOutFirebase();
          }}
        />
        {pdfModal}
      </>
    );
  }

  const availableTopics = Array.from(
    new Set([
      ...skillGaps.map((g) => g.skill_name),
      ...(profile?.verified_skills.map((s) => s.skill_name) || []),
    ])
  );

  return (
    <div className="careerloop-canvas-bg min-h-screen lg:h-screen lg:overflow-hidden flex text-[#1D1D1F]">
      {/* Left 250px Frosted Sidebar */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        candidateName={
          profile?.full_name || userAccount?.displayName || authUser.displayName || 'Learner'
        }
        batchCohort={profile?.batch_cohort || userAccount?.batchCohort || 'Batch 2027'}
        targetRole={
          profile?.target_role || userAccount?.targetRole || 'Full Stack Developer'
        }
        readinessScore={readinessScore}
        authUserEmail={authUser.email}
        isDemoMode={isDemoMode}
        onLoadDemo={handleLoadDemoPersona}
        onReturnToMyWorkspace={handleReturnToMyWorkspace}
        onRerunOnboarding={() => setShowOnboarding(true)}
        onOpenUpload={() => setUploadModalOpen(true)}
        onSignOut={() => {
          void signOutFirebase();
        }}
        isBusy={isBusy}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Center + Right Workspace */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-4 px-5 lg:px-7 py-4 border-b border-black/[0.06] bg-white/40 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-[10px] bg-white/80 border border-black/[0.08] p-2 text-[#1D1D1F]"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[19px] font-semibold tracking-tight text-[#1D1D1F] truncate">
                {VIEW_TITLES[activeView]}
              </h1>
              <p className="text-[12.5px] text-[#6E6E73] truncate">
                {profile?.full_name || userAccount?.displayName || 'Learner'} ·{' '}
                {profile?.batch_cohort || userAccount?.batchCohort || 'Batch 2027'} ·{' '}
                <span className="tabular-nums">{Math.round(readinessScore)}% role readiness</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label
              htmlFor="target-role-select"
              className="text-[12.5px] font-medium text-[#6E6E73] hidden sm:inline"
            >
              Target role
            </label>
            <select
              id="target-role-select"
              value={profile?.target_role || userAccount?.targetRole || 'Full Stack Developer'}
              onChange={(e) => handleSwitchRole(e.target.value)}
              disabled={isBusy}
              className="rounded-[12px] bg-white/85 border border-black/[0.08] px-3.5 py-2 text-[13px] font-medium text-[#1D1D1F] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 disabled:opacity-60"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="flex flex-col xl:flex-row gap-5 min-h-full">
            <div className="flex-1 min-w-0">
              {activeView === 'overview' && (
                <RoadmapCanvas
                  roadmap={roadmap}
                  readinessScore={readinessScore}
                  targetRole={profile?.target_role || 'Full Stack Developer'}
                  roleSummary={roleSummary}
                  verifiedCount={profile?.verified_skills.length || 0}
                  gapCount={skillGaps.length}
                  selectedNodeId={selectedNode?.id || null}
                  onSelectNode={(node) => {
                    setSelectedNode(node);
                    setActiveTopic(node.data.skill_name);
                  }}
                  onSimulateFail={handleSimulateFail}
                  onOpenSkillMatrix={() => setActiveView('skills')}
                  isBusy={isBusy}
                />
              )}

              {activeView === 'skills' && (
                <SkillMatrixView
                  targetRole={profile?.target_role || 'Full Stack Developer'}
                  readinessScore={readinessScore}
                  roleSummary={roleSummary}
                  verifiedSkills={profile?.verified_skills || []}
                  skillGaps={skillGaps}
                  onVerifySkill={(skillName) => {
                    setActiveTopic(skillName);
                    setActiveView('mentor');
                    void handleGenerateQuiz(skillName);
                  }}
                  onBackToRoadmap={() => setActiveView('overview')}
                />
              )}

              {activeView === 'mentor' && (
                <AssessmentsMentorView
                  availableTopics={
                    availableTopics.length > 0
                      ? availableTopics
                      : ['JavaScript ES6+ & Async', 'React 19', 'Node.js & Express']
                  }
                  activeTopic={activeTopic}
                  onSelectTopic={setActiveTopic}
                  activeQuiz={activeQuiz}
                  quizResult={quizResult}
                  onGenerateQuiz={handleGenerateQuiz}
                  onSubmitQuiz={handleSubmitQuiz}
                  onSimulateFail={handleSimulateFail}
                  mentorMessages={mentorMessages}
                  onSendMentorMessage={handleSendMentorMessage}
                  onViewUpdatedRoadmap={() => setActiveView('overview')}
                  isBusy={isBusy || isMentorLoading}
                />
              )}

              {activeView === 'cohort' && (
                <CohortAnalyticsView analytics={cohortData} />
              )}
            </div>

            {(activeView === 'overview' || activeView === 'skills') && (
              <RightDrawer
                selectedNode={selectedNode}
                agentLogs={agentLogs}
                mentorMessages={mentorMessages}
                onSendMentorMessage={handleSendMentorMessage}
                onStartQuizForTopic={(topic) => {
                  setActiveTopic(topic);
                  setActiveView('mentor');
                  void handleGenerateQuiz(topic);
                }}
                isMentorLoading={isMentorLoading}
              />
            )}
          </div>
        </main>
      </div>

      {pdfModal}
    </div>
  );
}
