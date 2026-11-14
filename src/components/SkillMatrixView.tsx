import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import type { SkillGapItem, VerifiedSkillResult } from '../types/careerloop';

interface SkillMatrixViewProps {
  targetRole: string;
  readinessScore: number;
  roleSummary: string;
  verifiedSkills: VerifiedSkillResult[];
  skillGaps: SkillGapItem[];
  onVerifySkill: (skillName: string) => void;
  onBackToRoadmap: () => void;
}

export const SkillMatrixView: React.FC<SkillMatrixViewProps> = ({
  targetRole,
  readinessScore,
  roleSummary,
  verifiedSkills,
  skillGaps,
  onVerifySkill,
  onBackToRoadmap,
}) => {
  const [filter, setFilter] = useState<'all' | 'verified' | 'gaps'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const q = searchQuery.trim().toLowerCase();

  const filteredVerified = verifiedSkills.filter(
    (s) =>
      (filter === 'all' || filter === 'verified') &&
      (!q || s.skill_name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
  );

  const filteredGaps = skillGaps.filter(
    (g) =>
      (filter === 'all' || filter === 'gaps') &&
      (!q || g.skill_name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-5">
      {/* Header Summary Card */}
      <div className="glass-surface p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-[12.5px] text-[#6E6E73]">
            <span>Target role benchmark</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-[#1D1D1F]">{targetRole}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{Math.round(readinessScore)}% role readiness</span>
          </div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[#1D1D1F]">
            Verified Competency & Gap Matrix
          </h2>
          <p className="text-[13.5px] leading-relaxed text-[#6E6E73]">
            {roleSummary ||
              `Weighted competency comparison between your verified diagnostic baseline and ${targetRole} hiring requirements.`}
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToRoadmap}
          className="inline-flex items-center gap-2 rounded-[12px] bg-[#0071E3] px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-95 whitespace-nowrap shrink-0 self-start md:self-center"
        >
          <span>View DAG Roadmap</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-[12px] bg-white/70 border border-white/90 p-1 shadow-xs">
          {(
            [
              { id: 'all', label: `All skills (${verifiedSkills.length + skillGaps.length})` },
              { id: 'verified', label: `Verified (${verifiedSkills.length})` },
              { id: 'gaps', label: `Priority gaps (${skillGaps.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-medium transition-all whitespace-nowrap tabular-nums ${
                filter === tab.id
                  ? 'bg-[#1D1D1F] text-white'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6E6E73]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter skills or domains..."
            className="w-full rounded-[12px] bg-white/75 border border-white/90 pl-9 pr-3 py-2 text-[13px] text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
          />
        </div>
      </div>

      {/* Matrix Table */}
      <div className="glass-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] text-[12px] font-medium text-[#6E6E73]">
                <th className="py-3.5 px-5">Skill competency</th>
                <th className="py-3.5 px-4">Domain</th>
                <th className="py-3.5 px-4">Verification status</th>
                <th className="py-3.5 px-4 text-right">Score / Priority</th>
                <th className="py-3.5 px-5 text-right">Next step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] text-[13.5px]">
              {filteredVerified.map((skill) => (
                <tr key={`v-${skill.skill_name}`} className="hover:bg-white/50 transition-colors">
                  <td className="py-3.5 px-5 font-semibold text-[#1D1D1F]">
                    {skill.skill_name}
                  </td>
                  <td className="py-3.5 px-4 text-[#6E6E73]">{skill.category}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#1D7A2F]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#28CD41]" />
                      Verified baseline
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-[#1D1D1F] tabular-nums">
                    {Math.round(skill.verification_score)}%
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => onVerifySkill(skill.skill_name)}
                      className="text-[12.5px] font-medium text-[#0071E3] hover:underline whitespace-nowrap"
                    >
                      Retake check
                    </button>
                  </td>
                </tr>
              ))}

              {filteredGaps.map((gap) => (
                <tr key={`g-${gap.skill_name}`} className="hover:bg-white/50 transition-colors">
                  <td className="py-3.5 px-5">
                    <p className="font-semibold text-[#1D1D1F]">{gap.skill_name}</p>
                    <p className="mt-0.5 text-[12px] text-[#6E6E73] max-w-md">{gap.reason}</p>
                  </td>
                  <td className="py-3.5 px-4 text-[#6E6E73] align-top pt-4">{gap.category}</td>
                  <td className="py-3.5 px-4 align-top pt-4">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#B86200]">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#FF9500]" />
                      {gap.current_status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right align-top pt-4 font-medium text-[#1D1D1F] tabular-nums">
                    {gap.priority} · {gap.importance_weight.toFixed(1)}x
                  </td>
                  <td className="py-3.5 px-5 text-right align-top pt-4">
                    <button
                      type="button"
                      onClick={() => onVerifySkill(gap.skill_name)}
                      className="inline-flex items-center gap-1 rounded-[9px] bg-[#0071E3] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-95 whitespace-nowrap"
                    >
                      <span>Start check</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredVerified.length === 0 && filteredGaps.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[13.5px] text-[#6E6E73]">
                    No skills match your current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
