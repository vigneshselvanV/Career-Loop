import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Send,
  XCircle,
} from 'lucide-react';
import type {
  AssessmentEvaluationResponse,
  MentorMessage,
  TopicQuiz,
} from '../types/careerloop';

interface AssessmentsMentorViewProps {
  availableTopics: string[];
  activeTopic: string;
  onSelectTopic: (topic: string) => void;
  activeQuiz: TopicQuiz | null;
  quizResult: AssessmentEvaluationResponse | null;
  onGenerateQuiz: (topic: string) => Promise<void>;
  onSubmitQuiz: (quiz: TopicQuiz, answers: number[]) => Promise<void>;
  onSimulateFail: () => Promise<void>;
  mentorMessages: MentorMessage[];
  onSendMentorMessage: (text: string) => Promise<void>;
  onViewUpdatedRoadmap: () => void;
  isBusy: boolean;
}

export const AssessmentsMentorView: React.FC<AssessmentsMentorViewProps> = ({
  availableTopics,
  activeTopic,
  onSelectTopic,
  activeQuiz,
  quizResult,
  onGenerateQuiz,
  onSubmitQuiz,
  onSimulateFail,
  mentorMessages,
  onSendMentorMessage,
  onViewUpdatedRoadmap,
  isBusy,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [chatInput, setChatInput] = useState('');

  const handleStartQuiz = async (topic: string) => {
    setSelectedAnswers({});
    onSelectTopic(topic);
    await onGenerateQuiz(topic);
  };

  const handleSubmit = async () => {
    if (!activeQuiz) return;
    const answers = activeQuiz.questions.map((_, idx) => selectedAnswers[idx] ?? -1);
    await onSubmitQuiz(activeQuiz, answers);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isBusy) return;
    setChatInput('');
    await onSendMentorMessage(trimmed);
  };

  const allAnswered =
    activeQuiz !== null &&
    activeQuiz.questions.every((_, idx) => typeof selectedAnswers[idx] === 'number');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left 7 Columns: Assessment Engine */}
      <div className="xl:col-span-7 space-y-4">
        <div className="glass-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1D1D1F]">
                Adaptive Skill Assessment
              </h2>
              <p className="text-[13px] text-[#6E6E73]">
                Scoring below 60% automatically triggers Supervisor remediation on your roadmap.
              </p>
            </div>
            <button
              type="button"
              onClick={onSimulateFail}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#FFF4E5] border border-[#FF9500]/45 px-3.5 py-2 text-[12.5px] font-medium text-[#B86200] hover:bg-[#FFEAD1] disabled:opacity-50 whitespace-nowrap"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Simulate 40% JS Quiz Fail</span>
            </button>
          </div>

          {/* Topic Selector Pills (Interactive Buttons) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {availableTopics.map((topic) => {
              const isSelected = topic === activeTopic;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleStartQuiz(topic)}
                  disabled={isBusy}
                  className={`rounded-[10px] px-3.5 py-2 text-[12.5px] font-medium transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#0071E3] text-white shadow-xs'
                      : 'bg-white/80 border border-black/[0.08] text-[#1D1D1F] hover:bg-white'
                  }`}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Quiz or Result Card */}
        {quizResult ? (
          <div className="glass-surface p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/[0.06]">
              <div>
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  {quizResult.passed ? (
                    <span className="inline-flex items-center gap-1.5 text-[#1D7A2F]">
                      <CheckCircle2 className="h-4 w-4 text-[#28CD41]" />
                      Passed mastery threshold
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#B86200]">
                      <AlertTriangle className="h-4 w-4 text-[#FF9500]" />
                      Below 60% threshold · Adaptive re-route triggered
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-[22px] font-semibold text-[#1D1D1F] tabular-nums">
                  {quizResult.topic}: {Math.round(quizResult.score_percent)}%
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStartQuiz(quizResult.topic)}
                  className="rounded-[10px] bg-white/85 border border-black/[0.08] px-3.5 py-2 text-[12.5px] font-medium text-[#1D1D1F] hover:bg-white whitespace-nowrap"
                >
                  Retry quiz
                </button>
                <button
                  type="button"
                  onClick={onViewUpdatedRoadmap}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0071E3] px-3.5 py-2 text-[12.5px] font-medium text-white hover:opacity-95 whitespace-nowrap"
                >
                  <span>Inspect updated DAG</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="rounded-[14px] bg-white/75 border border-black/[0.06] p-4 text-[13.5px] leading-relaxed text-[#1D1D1F]">
              {quizResult.mentor_advice}
            </div>

            <div className="space-y-3">
              {quizResult.feedback.map((item, idx) => (
                <div
                  key={item.question_id || idx}
                  className="rounded-[14px] bg-white/70 border border-black/[0.06] p-4 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-semibold text-[#1D1D1F]">
                      {idx + 1}. {item.question}
                    </p>
                    {item.is_correct ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#28CD41] mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-[#FF3B30] mt-0.5" />
                    )}
                  </div>
                  <p className="text-[12.5px] text-[#6E6E73]">{item.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        ) : activeQuiz ? (
          <div className="glass-surface p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3.5">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                  {activeQuiz.topic} Verification
                </h3>
                <p className="text-[12.5px] text-[#6E6E73] tabular-nums">
                  {activeQuiz.questions.length} questions · 60% passing threshold
                </p>
              </div>
              <GraduationCap className="h-5 w-5 text-[#0071E3]" />
            </div>

            <div className="space-y-5">
              {activeQuiz.questions.map((q, qIdx) => (
                <div key={q.id} className="space-y-2.5">
                  <p className="text-[14px] font-medium text-[#1D1D1F]">
                    {qIdx + 1}. {q.question}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => {
                      const chosen = selectedAnswers[qIdx] === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() =>
                            setSelectedAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))
                          }
                          className={`rounded-[12px] border px-3.5 py-2.5 text-left text-[13px] transition-all ${
                            chosen
                              ? 'border-[#0071E3] bg-[#0071E3]/10 font-medium text-[#0071E3]'
                              : 'border-black/[0.08] bg-white/80 text-[#1D1D1F] hover:bg-white'
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

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allAnswered || isBusy}
                className="rounded-[12px] bg-[#0071E3] px-5 py-2.5 text-[13.5px] font-medium text-white hover:opacity-95 disabled:opacity-45 whitespace-nowrap"
              >
                Submit & Grade Assessment
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-surface p-8 text-center space-y-3">
            <GraduationCap className="h-8 w-8 mx-auto text-[#0071E3]" />
            <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
              Select a topic above to generate a live assessment
            </h3>
            <p className="text-[13px] text-[#6E6E73] max-w-md mx-auto">
              CareerLoop grades your submission deterministically and automatically adapts your DAG roadmap if you need prerequisite reinforcement.
            </p>
            <button
              type="button"
              onClick={() => handleStartQuiz(activeTopic)}
              disabled={isBusy}
              className="rounded-[12px] bg-[#0071E3] px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-95"
            >
              Generate {activeTopic} Quiz
            </button>
          </div>
        )}
      </div>

      {/* Right 5 Columns: Socratic AI Mentor */}
      <div className="xl:col-span-5">
        <div className="glass-surface flex flex-col h-[580px] overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.06]">
            <h3 className="text-[15.5px] font-semibold text-[#1D1D1F]">Socratic AI Mentor</h3>
            <p className="text-[12.5px] text-[#6E6E73]">
              Grounded in your verified strengths · Topic: {activeTopic}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mentorMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-[16px] px-4 py-3 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-8 bg-[#0071E3] text-white'
                    : 'mr-6 bg-white/85 border border-black/[0.06] text-[#1D1D1F]'
                }`}
              >
                <p>{msg.content}</p>
                {msg.hint && (
                  <p className="mt-2 pt-2 border-t border-black/[0.06] text-[12px] text-[#6E6E73]">
                    Key concept: {msg.hint}
                  </p>
                )}
                {msg.followups && msg.followups.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {msg.followups.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => onSendMentorMessage(f)}
                        className="rounded-[8px] bg-[#F5F5F7] px-2.5 py-1 text-[11.5px] font-medium text-[#1D1D1F] hover:bg-[#E5E5EA]"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleChatSubmit} className="p-3.5 border-t border-black/[0.06] flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Ask about ${activeTopic}...`}
              className="flex-1 rounded-[12px] bg-white/90 border border-black/[0.08] px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
            />
            <button
              type="submit"
              disabled={isBusy || !chatInput.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#0071E3] text-white disabled:opacity-45"
              aria-label="Send mentor prompt"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
