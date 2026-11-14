import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  AgentLogEntry,
  ClaimedSkillItem,
  ExperienceLevel,
  PersistedWorkspacePayload,
  RoadmapFlowEdge,
  RoadmapFlowNode,
  SkillGapItem,
  VerifiedSkillResult,
} from './types/careerloop';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface UserAccountState {
  uid: string;
  displayName: string;
  email?: string;
  targetRole: string;
  batchCohort: string;
  experienceLevel: ExperienceLevel;
  learningGoal: string;
  onboardingCompleted: boolean;
  isDemoMode: boolean;
  readinessScore: number;
}

const VALID_EXPERIENCE_LEVELS: ExperienceLevel[] = [
  'Student',
  'Entry Level',
  'Mid Level',
  'Career Switcher',
];

function sanitizeExperienceLevel(val: unknown): ExperienceLevel {
  if (typeof val === 'string' && VALID_EXPERIENCE_LEVELS.includes(val as ExperienceLevel)) {
    return val as ExperienceLevel;
  }
  return 'Student';
}

function clampScore(val: unknown, fallback = 0): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.min(100, Math.max(0, Math.round(num * 100) / 100));
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function getFirebaseIdToken(): Promise<string | null> {
  const current = auth.currentUser;
  if (!current) return null;
  try {
    return await current.getIdToken();
  } catch {
    return null;
  }
}

export async function ensureUserAccountDoc(
  user: User,
  defaultTargetRole = 'Full Stack Developer'
): Promise<UserAccountState> {
  const safeName =
    (user.displayName || user.email || 'Learner').trim().slice(0, 100) || 'Learner';
  const safeRole = defaultTargetRole.trim().slice(0, 80) || 'Full Stack Developer';

  const fallbackState: UserAccountState = {
    uid: user.uid,
    displayName: safeName,
    email: user.email || undefined,
    targetRole: safeRole,
    batchCohort: 'Batch 2027',
    experienceLevel: 'Student',
    learningGoal: '',
    onboardingCompleted: false,
    isDemoMode: false,
    readinessScore: 0,
  };

  if (!user.emailVerified) {
    return fallbackState;
  }

  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return fallbackState;
  }

  if (snap.exists()) {
    const data = snap.data();
    const resolved: UserAccountState = {
      uid: user.uid,
      displayName:
        typeof data.displayName === 'string' && data.displayName.trim().length > 0
          ? data.displayName.slice(0, 100)
          : safeName,
      email: typeof data.email === 'string' ? data.email.slice(0, 200) : user.email || undefined,
      targetRole:
        typeof data.targetRole === 'string' && data.targetRole.trim().length >= 2
          ? data.targetRole.slice(0, 80)
          : safeRole,
      batchCohort:
        typeof data.batchCohort === 'string' && data.batchCohort.trim().length > 0
          ? data.batchCohort.slice(0, 60)
          : 'Batch 2027',
      experienceLevel: sanitizeExperienceLevel(data.experienceLevel),
      learningGoal: typeof data.learningGoal === 'string' ? data.learningGoal.slice(0, 300) : '',
      onboardingCompleted: data.onboardingCompleted === true,
      isDemoMode: data.isDemoMode === true,
      readinessScore: clampScore(data.readinessScore, 0),
    };

    // Migrate legacy accounts created prior to onboardingCompleted schema update
    if (typeof data.onboardingCompleted !== 'boolean') {
      try {
        await updateDoc(ref, {
          onboardingCompleted: false,
          batchCohort: resolved.batchCohort,
          experienceLevel: resolved.experienceLevel,
          isDemoMode: false,
          readinessScore: resolved.readinessScore,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
          handleFirestoreError(error, OperationType.UPDATE, path);
        }
      }
    }

    return resolved;
  }

  const payload: Record<string, unknown> = {
    uid: user.uid,
    displayName: safeName,
    targetRole: safeRole,
    batchCohort: 'Batch 2027',
    experienceLevel: 'Student',
    learningGoal: '',
    onboardingCompleted: false,
    isDemoMode: false,
    readinessScore: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (user.email) {
    payload.email = user.email.slice(0, 200);
  }

  try {
    await setDoc(ref, payload);
    return fallbackState;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return fallbackState;
  }
}

export async function updateUserAccountDoc(
  user: User,
  patch: Partial<Omit<UserAccountState, 'uid' | 'email'>>
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);

  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof patch.displayName === 'string' && patch.displayName.trim().length >= 1) {
    updatePayload.displayName = patch.displayName.trim().slice(0, 100);
  }
  if (typeof patch.targetRole === 'string' && patch.targetRole.trim().length >= 2) {
    updatePayload.targetRole = patch.targetRole.trim().slice(0, 80);
  }
  if (typeof patch.batchCohort === 'string' && patch.batchCohort.trim().length >= 1) {
    updatePayload.batchCohort = patch.batchCohort.trim().slice(0, 60);
  }
  if (patch.experienceLevel) {
    updatePayload.experienceLevel = sanitizeExperienceLevel(patch.experienceLevel);
  }
  if (typeof patch.learningGoal === 'string') {
    updatePayload.learningGoal = patch.learningGoal.trim().slice(0, 300);
  }
  if (typeof patch.onboardingCompleted === 'boolean') {
    updatePayload.onboardingCompleted = patch.onboardingCompleted;
  }
  if (typeof patch.isDemoMode === 'boolean') {
    updatePayload.isDemoMode = patch.isDemoMode;
  }
  if (typeof patch.readinessScore === 'number') {
    updatePayload.readinessScore = clampScore(patch.readinessScore, 0);
  }

  try {
    await updateDoc(ref, updatePayload);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function updateUserTargetRoleDoc(
  user: User,
  newTargetRole: string,
  readinessScore?: number
): Promise<void> {
  const safeRole = newTargetRole.trim().slice(0, 80);
  if (safeRole.length < 2) return;
  await updateUserAccountDoc(user, {
    targetRole: safeRole,
    ...(typeof readinessScore === 'number' ? { readinessScore } : {}),
  });
}

function sanitizeSkills(skills: VerifiedSkillResult[]): VerifiedSkillResult[] {
  return skills.slice(0, 30).map((s) => ({
    skill_name: (s.skill_name || 'Skill').slice(0, 100),
    proficiency_level: (s.proficiency_level || 'Verified').slice(0, 60),
    is_verified: Boolean(s.is_verified),
    verification_score: clampScore(s.verification_score, 0),
    category: (s.category || 'Core').slice(0, 60),
    status: s.status || (s.is_verified ? 'verified' : 'gap'),
  }));
}

function sanitizeGaps(gaps: SkillGapItem[]): SkillGapItem[] {
  return gaps.slice(0, 30).map((g) => ({
    skill_name: (g.skill_name || 'Skill').slice(0, 100),
    category: (g.category || 'Core').slice(0, 60),
    priority: g.priority || 'High',
    importance_weight: typeof g.importance_weight === 'number' ? g.importance_weight : 1.5,
    reason: (g.reason || '').slice(0, 300),
    current_status: g.current_status || 'Missing',
  }));
}

function sanitizeNodes(nodes: RoadmapFlowNode[]): RoadmapFlowNode[] {
  return nodes.slice(0, 30).map((n) => ({
    id: (n.id || 'node').slice(0, 128),
    type: (n.type || 'curriculumNode').slice(0, 40),
    position: {
      x: typeof n.position?.x === 'number' ? n.position.x : 0,
      y: typeof n.position?.y === 'number' ? n.position.y : 0,
    },
    data: {
      label: (n.data?.label || 'Module').slice(0, 120),
      skill_name: (n.data?.skill_name || n.data?.label || 'Module').slice(0, 100),
      status: n.data?.status || 'locked',
      badge_text: n.data?.badge_text ? String(n.data.badge_text).slice(0, 100) : null,
      estimated_hours: typeof n.data?.estimated_hours === 'number' ? n.data.estimated_hours : 6,
      description: (n.data?.description || '').slice(0, 400),
      resources: (n.data?.resources || []).slice(0, 4),
      is_remediation: Boolean(n.data?.is_remediation),
      mastery_score: typeof n.data?.mastery_score === 'number' ? n.data.mastery_score : null,
    },
  }));
}

function sanitizeEdges(edges: RoadmapFlowEdge[]): RoadmapFlowEdge[] {
  return edges.slice(0, 50).map((e) => ({
    id: (e.id || `${e.source}-${e.target}`).slice(0, 200),
    source: (e.source || '').slice(0, 128),
    target: (e.target || '').slice(0, 128),
    animated: Boolean(e.animated),
    label: e.label ? String(e.label).slice(0, 60) : null,
  }));
}

function sanitizeLogs(logs: AgentLogEntry[]): AgentLogEntry[] {
  return logs.slice(-35).map((l) => ({
    agent_name: (l.agent_name || 'Supervisor').slice(0, 80),
    action_summary: (l.action_summary || '').slice(0, 300),
    timestamp: (l.timestamp || new Date().toISOString()).slice(0, 60),
  }));
}

function sanitizeClaimedSkills(claimed?: ClaimedSkillItem[]): ClaimedSkillItem[] {
  if (!claimed) return [];
  return claimed.slice(0, 30).map((c) => ({
    skill_name: (c.skill_name || 'Skill').slice(0, 100),
    self_reported_confidence: c.self_reported_confidence || 'Intermediate',
    category: (c.category || 'Core').slice(0, 60),
  }));
}

export async function loadUserWorkspaceDoc(
  user: User
): Promise<PersistedWorkspacePayload | null> {
  const path = `users/${user.uid}/workspaces/primary`;
  const ref = doc(db, 'users', user.uid, 'workspaces', 'primary');

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      targetRole: typeof d.targetRole === 'string' ? d.targetRole : 'Full Stack Developer',
      readinessScore: clampScore(d.readinessScore, 0),
      quizScorePercent: typeof d.quizScorePercent === 'number' ? clampScore(d.quizScorePercent, 100) : undefined,
      roleSummary: typeof d.roleSummary === 'string' ? d.roleSummary : '',
      rerouted: Boolean(d.rerouted),
      rerouteReason: typeof d.rerouteReason === 'string' && d.rerouteReason ? d.rerouteReason : null,
      verifiedSkills: Array.isArray(d.verifiedSkills) ? (d.verifiedSkills as VerifiedSkillResult[]) : [],
      skillGaps: Array.isArray(d.skillGaps) ? (d.skillGaps as SkillGapItem[]) : [],
      roadmapNodes: Array.isArray(d.roadmapNodes) ? (d.roadmapNodes as RoadmapFlowNode[]) : [],
      roadmapEdges: Array.isArray(d.roadmapEdges) ? (d.roadmapEdges as RoadmapFlowEdge[]) : [],
      agentLogs: Array.isArray(d.agentLogs) ? (d.agentLogs as AgentLogEntry[]) : [],
      claimedSkills: Array.isArray(d.claimedSkills) ? (d.claimedSkills as ClaimedSkillItem[]) : [],
    };
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return null;
  }
}

export async function saveUserWorkspaceDoc(
  user: User,
  workspace: PersistedWorkspacePayload
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `users/${user.uid}/workspaces/primary`;
  const ref = doc(db, 'users', user.uid, 'workspaces', 'primary');

  let exists = false;
  try {
    const existingSnap = await getDoc(ref);
    exists = existingSnap.exists();
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  const basePayload: Record<string, unknown> = {
    uid: user.uid,
    targetRole: (workspace.targetRole || 'Full Stack Developer').trim().slice(0, 80),
    readinessScore: clampScore(workspace.readinessScore, 0),
    roleSummary: (workspace.roleSummary || '').slice(0, 600),
    rerouted: Boolean(workspace.rerouted),
    verifiedSkills: sanitizeSkills(workspace.verifiedSkills),
    skillGaps: sanitizeGaps(workspace.skillGaps),
    roadmapNodes: sanitizeNodes(workspace.roadmapNodes),
    roadmapEdges: sanitizeEdges(workspace.roadmapEdges),
    agentLogs: sanitizeLogs(workspace.agentLogs),
    claimedSkills: sanitizeClaimedSkills(workspace.claimedSkills),
    updatedAt: serverTimestamp(),
  };

  if (typeof workspace.quizScorePercent === 'number') {
    basePayload.quizScorePercent = clampScore(workspace.quizScorePercent, 100);
  }
  if (typeof workspace.rerouteReason === 'string' && workspace.rerouteReason.trim().length > 0) {
    basePayload.rerouteReason = workspace.rerouteReason.trim().slice(0, 300);
  } else if (exists) {
    basePayload.rerouteReason = '';
  }

  if (exists) {
    const { uid: _omitUid, ...updateFields } = basePayload;
    void _omitUid;
    try {
      await updateDoc(ref, updateFields);
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  } else {
    try {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  }
}

export async function saveAssessmentRecordDoc(
  user: User,
  record: {
    topic: string;
    scorePercent: number;
    passed: boolean;
    triggeredReroute: boolean;
  }
): Promise<void> {
  if (!user.emailVerified) return;
  const assessId = `assess-${Date.now()}`;
  const path = `users/${user.uid}/assessments/${assessId}`;
  const ref = doc(db, 'users', user.uid, 'assessments', assessId);

  try {
    await setDoc(ref, {
      uid: user.uid,
      topic: (record.topic || 'Skill Assessment').trim().slice(0, 120) || 'Skill Assessment',
      scorePercent: clampScore(record.scorePercent, 0),
      passed: Boolean(record.passed),
      triggeredReroute: Boolean(record.triggeredReroute),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}
