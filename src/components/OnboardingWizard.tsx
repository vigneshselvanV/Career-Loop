import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  FileUp,
  LogOut,
  MessageSquare,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { careerLoopApi } from '../services/api';
import type {
  AgentLogEntry,
  BaselineDiagnosticQuiz,
  ClaimedSkillItem,
  ExperienceLevel,
} from '../types/careerloop';

interface OnboardingWizardProps {
  authUser: User;
  initialDisplayName: string;
  initialTargetRole: string;
  availableRoles: string[];
  onCompleteOnboarding: (result: {
    fullName: string;
    batchCohort: string;
    experienceLevel: ExperienceLevel;
    learningGoal: string;
    targetRole: string;
    claimedSkills: ClaimedSkillItem[];
    quiz: BaselineDiagnosticQuiz;
    answers: number[];
    onboardingLogs: AgentLogEntry[];
  }) => Promise<void>;
  onUseDemoInstead: () => Promise<void>;
  onOpenPdfUpload: () => void;
  onSignOut: () => void;
}

const ROLE_SKILL_PRESETS: Record<string, string[]> = {
  'Full Stack Developer': [
    'Python',
    'SQL',
    'HTML & CSS',
    'JavaScript ES6+ & Async',
    'React 19',
    'Node.js & Express',
  ],
  'AI Engineer': [
    'Python',
    'SQL',
    'PyTorch & Deep Learning',
    'LLM Orchestration & LangGraph',
    'Vector Databases & RAG',
    'FastAPI & Model Deployment',
  ],
  'Backend Engineer': [
    'Python',
    'SQL',
    'Node.js & Express',
    'System Design & Caching',
    'Docker & Microservices',
    'REST & GraphQL APIs',
  ],
  'Data Scientist': [
    'Python',
    'SQL',
    'Statistical Modeling',
    'Machine Learning & Scikit-Learn',
    'Data Visualization',
    'Feature Engineering',
  ],
};

const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  'Student',
  'Entry Level',
  'Mid Level',
  'Career Switcher',
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  authUser,
  initialDisplayName,
  initialTargetRole,
  availableRoles,
  onCompleteOnboarding,
  onUseDemoInstead,
  onOpenPdfUpload,
  onSignOut,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState(initialDisplayName);
  const [batchCohort, setBatchCohort] = useState('Batch 2027 · CS');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('Student');
  const [targetRole, setTargetRole] = useState(initialTargetRole || 'Full Stack Developer');

  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Python', 'SQL', 'HTML & CSS']);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [backgroundNote, setBackgroundNote] = useState('');

  const [coachMessage, setCoachMessage] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [claimedSkills, setClaimedSkills] = useState<ClaimedSkillItem[]>([]);
  const [diagnosticQuiz, setDiagnosticQuiz] = useState<BaselineDiagnosticQuiz | null>(null);
  const [onboardingLogs, setOnboardingLogs] = useState<AgentLogEntry[]>([]);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 3 || !diagnosticQuiz) return;
    setSecondsLeft(diagnosticQuiz.estimated_seconds || 60);
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, diagnosticQuiz]);

  const rolePresets =
    ROLE_SKILL_PRESETS[targetRole] || ROLE_SKILL_PRESETS['Full Stack Developer'];

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.some((s) => s.toLowerCase() === skill.toLowerCase())
        ? prev.filter((s) => s.toLowerCase() !== skill.toLowerCase())
        : [...prev, skill]
    );
  };

  const handleAddCustomSkill = () => {
    const clean = customSkillInput.trim();
    if (!clean) return;
    if (!selectedSkills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSelectedSkills((prev) => [...prev, clean]);
    }
    setCustomSkillInput('');
  };

  const runAiCalibration = async (advanceToStep?: 2 | 3) => {
    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      const res = await careerLoopApi.analyzeOnboarding({
        user_id: authUser.uid,
        full_name: fullName.trim() || 'Learner',
        target_role: targetRole,
        batch_cohort: batchCohort.trim() || 'Batch 2027',
        experience_level: experienceLevel,
        background_note: backgroundNote.trim(),
        selected_skills: selectedSkills,
      });

      setCoachMessage(res.coach_message);
      setFollowUpQuestion(res.follow_up_question);
      setClaimedSkills(res.suggested_skills);
      setDiagnosticQuiz(res.diagnostic_quiz);
      setOnboardingLogs(res.agent_logs);

      const merged = Array.from(
        new Set([...selectedSkills, ...res.suggested_skills.map((s) => s.skill_name)])
      );
      setSelectedSkills(merged.slice(0, 10));
      if (advanceToStep === 3) {
        setAnswers({});
      }
      if (advanceToStep) {
        setStep(advanceToStep);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to run onboarding analysis.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleComplete = async () => {
    if (!diagnosticQuiz) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const answerList = diagnosticQuiz.questions.map((_, i) => answers[i] ?? 0);
      const finalClaimed: ClaimedSkillItem[] =
        claimedSkills.length > 0
          ? claimedSkills
          : selectedSkills.map((s) => ({
              skill_name: s,
              self_reported_confidence: 'Intermediate',
              category: 'Self-Reported',
            }));

      await onCompleteOnboarding({
        fullName: fullName.trim() || 'Learner',
        batchCohort: batchCohort.trim() || 'Batch 2027',
        experienceLevel,
        learningGoal: backgroundNote.trim().slice(0, 300),
        targetRole,
        claimedSkills: finalClaimed,
        quiz: diagnosticQuiz,
        answers: answerList,
        onboardingLogs,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to save your workspace.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const allAnswered =
    diagnosticQuiz !== null &&
    diagnosticQuiz.questions.every((_, idx) => typeof answers[idx] === 'number');

  return (
    <div className="careerloop-canvas-bg min-h-screen flex flex-col justify-between p-5 sm:p-8 text-[#1D1D1F]">
      {/* Top Minimal Header */}
      <header className="mx-auto w-full max-w-3xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#0071E3] text-white shadow-sm">
            <Compass className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
              CareerLoop
            </span>
            <p className="text-[12px] text-[#6E6E73]">
              Signed in as {authUser.email || authUser.displayName}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/80 border border-black/[0.08] px-3 py-1.5 text-[12.5px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out</span>
        </button>
      </header>

      {/* Main 3-Step Onboarding Card */}
      <main className="mx-auto my-6 w-full max-w-3xl glass-surface p-6 sm:p-8 space-y-6">
        {/* 3-Step Progress Indicator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[12.5px] font-medium text-[#6E6E73]">
            <span>Personalize your workspace</span>
            <span className="tabular-nums text-[#1D1D1F]">Step {step} of 3</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { num: 1, title: '1. Career Goal' },
              { num: 2, title: '2. AI Skill Calibration' },
              { num: 3, title: '3. 60s Verification' },
            ].map((item) => (
              <div
                key={item.num}
                className={`rounded-[10px] px-3 py-2 text-[12px] font-medium transition-colors ${
                  step === item.num
                    ? 'bg-[#0071E3] text-white'
                    : step > item.num
                      ? 'bg-[#28CD41]/15 text-[#146B22]'
                      : 'bg-black/[0.04] text-[#6E6E73]'
                }`}
              >
                {item.title}
              </div>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] bg-[#FF3B30]/10 border border-[#FF3B30]/30 px-3.5 py-2.5 text-[13px] text-[#B41E15]">
            {errorMsg}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-[#1D1D1F]">
                Welcome, {fullName.split(' ')[0] || 'there'}
              </h1>
              <p className="mt-1 text-[14px] text-[#6E6E73]">
                Tell us what role you are targeting so our AI agents can calibrate your baseline and build a personalized DAG roadmap.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12.5px] font-medium text-[#1D1D1F] mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-[12px] bg-white/90 border border-black/[0.09] px-3.5 py-2.5 text-[13.5px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-[#1D1D1F] mb-1.5">
                  Cohort or track
                </label>
                <input
                  type="text"
                  value={batchCohort}
                  onChange={(e) => setBatchCohort(e.target.value)}
                  maxLength={60}
                  className="w-full rounded-[12px] bg-white/90 border border-black/[0.09] px-3.5 py-2.5 text-[13.5px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  placeholder="e.g., Batch 2027 · CS"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-[#1D1D1F] mb-1.5">
                Current experience level
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setExperienceLevel(lvl)}
                    className={`rounded-[11px] border px-3 py-2 text-[12.5px] font-medium transition-all ${
                      experienceLevel === lvl
                        ? 'border-[#0071E3] bg-[#0071E3]/10 text-[#0071E3]'
                        : 'border-black/[0.08] bg-white/80 text-[#1D1D1F] hover:bg-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-[#1D1D1F] mb-1.5">
                Target career role
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-[12px] bg-white/90 border border-black/[0.09] px-3.5 py-2.5 text-[13.5px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenPdfUpload}
                  className="inline-flex items-center gap-1.5 rounded-[11px] bg-white/85 border border-black/[0.08] px-3.5 py-2 text-[12.5px] font-medium text-[#1D1D1F] hover:bg-white"
                >
                  <FileUp className="h-3.5 w-3.5 text-[#0071E3]" />
                  <span>Import Resume PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onUseDemoInstead()}
                  className="inline-flex items-center gap-1.5 rounded-[11px] bg-white/85 border border-black/[0.08] px-3.5 py-2 text-[12.5px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Explore Sophia Vance Demo</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => void runAiCalibration(2)}
                disabled={isAnalyzing || !fullName.trim()}
                className="inline-flex items-center gap-2 rounded-[12px] bg-[#0071E3] px-5 py-2.5 text-[13.5px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,113,227,0.55)] hover:opacity-95 disabled:opacity-50"
              >
                <span>{isAnalyzing ? 'Analyzing profile...' : 'Continue to AI Skill Check'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {/* Conversational AI Onboarding Coach Bubble */}
            <div className="rounded-[16px] bg-white/85 border border-[#0071E3]/25 p-4 space-y-2">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#0071E3]">
                <MessageSquare className="h-4 w-4" />
                <span>CareerLoop Onboarding Coach</span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-[#1D1D1F]">
                {coachMessage}
              </p>
              {followUpQuestion && (
                <p className="text-[13px] font-medium text-[#1D1D1F] pt-1 border-t border-black/[0.06]">
                  {followUpQuestion}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <label className="block text-[12.5px] font-medium text-[#1D1D1F]">
                Tell the AI Coach about your projects, coursework, or tools used
              </label>
              <textarea
                rows={3}
                value={backgroundNote}
                onChange={(e) => setBackgroundNote(e.target.value)}
                maxLength={1500}
                placeholder="e.g., Built a Python Flask API backed by PostgreSQL and a responsive HTML/CSS portfolio; learning React and TypeScript."
                className="w-full rounded-[12px] bg-white/90 border border-black/[0.09] px-3.5 py-2.5 text-[13.5px] text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void runAiCalibration()}
                  disabled={isAnalyzing}
                  className="text-[12.5px] font-medium text-[#0071E3] hover:underline disabled:opacity-50"
                >
                  {isAnalyzing ? 'Recalibrating...' : 'Update skill suggestions from my response'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-[12.5px] font-medium text-[#1D1D1F]">
                Confirm skills you already have experience with
              </label>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set([...rolePresets, ...selectedSkills])).map((skill) => {
                  const active = selectedSkills.some(
                    (s) => s.toLowerCase() === skill.toLowerCase()
                  );
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`rounded-[10px] border px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                        active
                          ? 'border-[#0071E3] bg-[#0071E3] text-white'
                          : 'border-black/[0.09] bg-white/80 text-[#1D1D1F] hover:bg-white'
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSkill();
                    }
                  }}
                  placeholder="Add another skill (e.g., Docker, TypeScript, TensorFlow)"
                  className="flex-1 rounded-[11px] bg-white/90 border border-black/[0.08] px-3 py-2 text-[13px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSkill}
                  className="inline-flex items-center gap-1 rounded-[11px] bg-white border border-black/[0.08] px-3 py-2 text-[12.5px] font-medium text-[#1D1D1F] hover:bg-black/[0.03]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-[11px] bg-white/85 border border-black/[0.08] px-4 py-2 text-[13px] font-medium text-[#1D1D1F] hover:bg-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => void runAiCalibration(3)}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 rounded-[12px] bg-[#0071E3] px-5 py-2.5 text-[13.5px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,113,227,0.55)] hover:opacity-95 disabled:opacity-50"
              >
                <span>{isAnalyzing ? 'Preparing quiz...' : 'Start 60s Skill Check'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && diagnosticQuiz && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[13px] bg-black/[0.04] px-4 py-2.5 text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-[#1D1D1F]">
                <CheckCircle2 className="h-4 w-4 text-[#28CD41]" />
                {fullName} · {targetRole} Baseline Check
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0071E3] tabular-nums">
                <Clock className="h-3.5 w-3.5" />
                {secondsLeft}s remaining
              </span>
            </div>

            <div className="space-y-4">
              {diagnosticQuiz.questions.map((q, qIdx) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-[13.5px] font-medium text-[#1D1D1F]">
                    {qIdx + 1}. [{q.skill_tested}] {q.question}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => {
                      const chosen = answers[qIdx] === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))
                          }
                          className={`rounded-[11px] border px-3.5 py-2.5 text-left text-[12.5px] transition-all ${
                            chosen
                              ? 'border-[#0071E3] bg-[#0071E3]/10 font-medium text-[#0071E3]'
                              : 'border-black/[0.08] bg-white/85 text-[#1D1D1F] hover:bg-white'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-[11px] bg-white/85 border border-black/[0.08] px-4 py-2 text-[13px] font-medium text-[#1D1D1F] hover:bg-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={isSubmitting || !allAnswered}
                className="inline-flex items-center gap-2 rounded-[12px] bg-[#0071E3] px-5 py-2.5 text-[13.5px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,113,227,0.55)] hover:opacity-95 disabled:opacity-45"
              >
                <span>
                  {isSubmitting
                    ? 'Building & saving roadmap...'
                    : 'Verify Baseline & Launch Workspace'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-3xl text-center text-[12px] text-[#6E6E73]">
        Your verified skills, roadmap DAG, and assessment progress are saved privately to your CareerLoop account.
      </footer>
    </div>
  );
};
