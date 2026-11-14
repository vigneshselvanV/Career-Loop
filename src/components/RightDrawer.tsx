import React, { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  MessageSquare,
  Send,
} from 'lucide-react';
import type {
  AgentLogEntry,
  MentorMessage,
  RoadmapFlowNode,
} from '../types/careerloop';

interface RightDrawerProps {
  selectedNode: RoadmapFlowNode | null;
  agentLogs: AgentLogEntry[];
  mentorMessages: MentorMessage[];
  onSendMentorMessage: (text: string) => Promise<void>;
  onStartQuizForTopic: (topic: string) => void;
  isMentorLoading: boolean;
}

function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Now';
  }
}

export const RightDrawer: React.FC<RightDrawerProps> = ({
  selectedNode,
  agentLogs,
  mentorMessages,
  onSendMentorMessage,
  onStartQuizForTopic,
  isMentorLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'check' | 'mentor'>('check');
  const [draft, setDraft] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isMentorLoading) return;
    setDraft('');
    await onSendMentorMessage(trimmed);
  };

  const recentLogs = [...agentLogs].slice(-6).reverse();

  return (
    <aside className="flex flex-col gap-4 w-full xl:w-[340px] shrink-0">
      {/* Contextual Inspector / Mentor Panel */}
      <div className="glass-surface flex flex-col overflow-hidden">
        {/* Segmented Control Tabs */}
        <div className="p-3 border-b border-black/[0.06]">
          <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-black/[0.05] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('check')}
              className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-medium transition-all whitespace-nowrap ${
                activeTab === 'check'
                  ? 'bg-white text-[#1D1D1F] shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Quick Skill Check
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mentor')}
              className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-medium transition-all whitespace-nowrap ${
                activeTab === 'mentor'
                  ? 'bg-white text-[#1D1D1F] shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              AI Mentor
            </button>
          </div>
        </div>

        {activeTab === 'check' ? (
          <div className="p-4 space-y-4">
            {selectedNode ? (
              <>
                <div>
                  <div className="flex items-center justify-between gap-2 text-[12px] text-[#6E6E73]">
                    <span>
                      {selectedNode.data.status === 'verified'
                        ? 'Verified skill'
                        : selectedNode.data.status === 'remediation'
                          ? 'Prerequisite module'
                          : 'Target module'}
                    </span>
                    <span className="tabular-nums">{selectedNode.data.estimated_hours} hrs est.</span>
                  </div>
                  <h3 className="mt-1 text-[16px] font-semibold text-[#1D1D1F]">
                    {selectedNode.data.label}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E6E73]">
                    {selectedNode.data.description}
                  </p>
                </div>

                {/* Curated Resources */}
                <div className="space-y-2">
                  <p className="text-[12.5px] font-semibold text-[#1D1D1F]">
                    Curated Learning Resources
                  </p>
                  {selectedNode.data.resources.length > 0 ? (
                    <div className="space-y-2">
                      {selectedNode.data.resources.map((res) => (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-start justify-between gap-2 rounded-[12px] bg-white/80 border border-black/[0.06] px-3 py-2.5 transition-colors hover:border-[#0071E3]/40 hover:bg-white"
                        >
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-[#1D1D1F] group-hover:text-[#0071E3] line-clamp-2">
                              {res.title}
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-[#6E6E73]">
                              {res.resource_type.charAt(0).toUpperCase() + res.resource_type.slice(1)} ·{' '}
                              {res.difficulty.charAt(0).toUpperCase() + res.difficulty.slice(1)}
                            </p>
                          </div>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#6E6E73] group-hover:text-[#0071E3] mt-0.5" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[12px] bg-black/[0.03] px-3 py-2.5 text-[12.5px] text-[#6E6E73] flex items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0" />
                      <span>Complete preceding modules to unlock capstone specs.</span>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onStartQuizForTopic(selectedNode.data.skill_name)}
                    className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#0071E3] px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-95 whitespace-nowrap"
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>Take {selectedNode.data.skill_name} Check</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('mentor')}
                    className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-white/80 border border-black/[0.08] px-4 py-2 text-[12.5px] font-medium text-[#1D1D1F] hover:bg-white whitespace-nowrap"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-[#0071E3]" />
                    <span>Ask AI Mentor about this node</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-[13px] text-[#6E6E73]">
                Select any node in the roadmap graph to view its resources and skill check.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-[340px]">
            <div className="px-4 py-2.5 border-b border-black/[0.05] text-[12px] text-[#6E6E73]">
              Coaching focus: <span className="font-medium text-[#1D1D1F]">{selectedNode?.data.skill_name || 'JavaScript ES6+ & Async'}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {mentorMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-[14px] px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'ml-6 bg-[#0071E3] text-white'
                      : 'mr-4 bg-white/85 border border-black/[0.06] text-[#1D1D1F]'
                  }`}
                >
                  <p>{msg.content}</p>
                  {msg.hint && (
                    <p className="mt-1.5 pt-1.5 border-t border-black/[0.06] text-[11.5px] text-[#6E6E73]">
                      Hint: {msg.hint}
                    </p>
                  )}
                </div>
              ))}
              {isMentorLoading && (
                <div className="mr-4 rounded-[14px] bg-white/85 border border-black/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#6E6E73]">
                  Thinking through a guided hint...
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="p-3 border-t border-black/[0.06] flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask why Promises work this way..."
                className="flex-1 rounded-[10px] bg-white/90 border border-black/[0.08] px-3 py-2 text-[12.5px] text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              />
              <button
                type="submit"
                disabled={isMentorLoading || !draft.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0071E3] text-white disabled:opacity-45"
                aria-label="Send message to AI Mentor"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Agent Collaboration Notification Feed */}
      <div className="glass-surface p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-[#1D1D1F]">Agent Collaboration</h3>
          <span className="text-[11.5px] text-[#6E6E73] tabular-nums">
            {agentLogs.length} {agentLogs.length === 1 ? 'update' : 'updates'}
          </span>
        </div>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
          {recentLogs.map((log, idx) => (
            <div
              key={`${log.timestamp}-${idx}`}
              className="rounded-[13px] bg-white/80 border border-black/[0.06] px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#1D1D1F]">
                  <CheckCircle2 className="h-3 w-3 text-[#0071E3] shrink-0" />
                  {log.agent_name}
                </span>
                <span className="text-[#6E6E73] tabular-nums shrink-0">
                  {formatLogTime(log.timestamp)}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-[#6E6E73]">
                {log.action_summary}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
