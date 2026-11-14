import React, { useState } from 'react';
import { BarChart3, Users, AlertTriangle } from 'lucide-react';
import type { CohortAnalyticsData, CohortStudent } from '../types/careerloop';

interface CohortAnalyticsViewProps {
  analytics: CohortAnalyticsData | null;
}

function cellTone(score: number): { bg: string; text: string; label: string } {
  if (score >= 80) {
    return { bg: 'bg-[#28CD41]/15', text: 'text-[#146B22]', label: 'Mastered' };
  }
  if (score >= 60) {
    return { bg: 'bg-[#0071E3]/12', text: 'text-[#0055B3]', label: 'Ready' };
  }
  if (score >= 30) {
    return { bg: 'bg-[#FF9500]/16', text: 'text-[#9E5200]', label: 'In progress' };
  }
  return { bg: 'bg-[#FF3B30]/12', text: 'text-[#B41E15]', label: 'Gap' };
}

export const CohortAnalyticsView: React.FC<CohortAnalyticsViewProps> = ({ analytics }) => {
  const [selectedTrack, setSelectedTrack] = useState<string>('All');
  const [selectedStudent, setSelectedStudent] = useState<CohortStudent | null>(null);

  if (!analytics) {
    return (
      <div className="glass-surface p-8 text-center text-[13.5px] text-[#6E6E73]">
        Loading University Cohort Analytics...
      </div>
    );
  }

  const tracks = ['All', ...Array.from(new Set(analytics.students.map((s) => s.cohort)))];
  const visibleStudents =
    selectedTrack === 'All'
      ? analytics.students
      : analytics.students.filter((s) => s.cohort === selectedTrack);

  const topBottleneck = analytics.bottlenecks[0];

  return (
    <div className="space-y-5">
      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-surface p-5">
          <div className="flex items-center justify-between text-[12.5px] font-medium text-[#6E6E73]">
            <span>Active cohort</span>
            <Users className="h-4 w-4 text-[#0071E3]" />
          </div>
          <p className="mt-1 text-[22px] font-semibold text-[#1D1D1F] tabular-nums">
            {analytics.total_students} students
          </p>
          <p className="mt-0.5 text-[12px] text-[#6E6E73]">{analytics.cohort_name}</p>
        </div>

        <div className="glass-surface p-5">
          <div className="flex items-center justify-between text-[12.5px] font-medium text-[#6E6E73]">
            <span>Batch average readiness</span>
            <BarChart3 className="h-4 w-4 text-[#28CD41]" />
          </div>
          <p className="mt-1 text-[22px] font-semibold text-[#1D1D1F] tabular-nums">
            {analytics.average_readiness}%
          </p>
          <p className="mt-0.5 text-[12px] text-[#6E6E73]">Across verified industry benchmarks</p>
        </div>

        <div className="glass-surface p-5">
          <div className="flex items-center justify-between text-[12.5px] font-medium text-[#6E6E73]">
            <span>Primary curriculum bottleneck</span>
            <AlertTriangle className="h-4 w-4 text-[#FF9500]" />
          </div>
          <p className="mt-1 text-[22px] font-semibold text-[#1D1D1F]">
            {topBottleneck?.skill || 'React 19'}
          </p>
          <p className="mt-0.5 text-[12px] text-[#6E6E73] tabular-nums">
            {topBottleneck?.students_needing_support || 0} students below 60% threshold
          </p>
        </div>
      </div>

      {/* Track Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">
            Student × Skill Readiness Heatmap
          </h2>
          <p className="text-[12.5px] text-[#6E6E73]">
            Click any student row to inspect individualized skill gaps and curriculum interventions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-[12px] bg-white/75 border border-white/90 p-1">
          {tracks.map((track) => (
            <button
              key={track}
              type="button"
              onClick={() => setSelectedTrack(track)}
              className={`rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-all whitespace-nowrap ${
                selectedTrack === track
                  ? 'bg-[#1D1D1F] text-white'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              {track}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Matrix Table */}
      <div className="glass-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] text-[12px] font-medium text-[#6E6E73]">
                <th className="py-3.5 px-5">Student</th>
                <th className="py-3.5 px-3">Target role</th>
                <th className="py-3.5 px-3 text-right">Readiness</th>
                {analytics.skill_columns.map((col) => (
                  <th key={col} className="py-3.5 px-3 text-center whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] text-[13px]">
              {visibleStudents.map((student) => {
                const isSelected = selectedStudent?.id === student.id;
                return (
                  <tr
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#0071E3]/[0.08]'
                        : student.isCurrentUser
                          ? 'bg-[#0071E3]/[0.04] hover:bg-[#0071E3]/[0.07]'
                          : 'hover:bg-white/60'
                    }`}
                  >
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-[#1D1D1F] whitespace-nowrap">
                        {student.name}
                      </p>
                      <p className="text-[11.5px] text-[#6E6E73] whitespace-nowrap">
                        {student.cohort}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 text-[#6E6E73] whitespace-nowrap">
                      {student.target_role}
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-[#1D1D1F] tabular-nums">
                      {Math.round(student.readiness)}%
                    </td>
                    {analytics.skill_columns.map((col) => {
                      const val = student.skills[col] ?? 0;
                      const tone = cellTone(val);
                      return (
                        <td key={col} className="py-2.5 px-2 text-center">
                          <div
                            className={`mx-auto w-20 rounded-[10px] px-2 py-1.5 tabular-nums ${tone.bg} ${tone.text}`}
                          >
                            <span className="block text-[12.5px] font-semibold">{val}%</span>
                            <span className="block text-[10.5px] opacity-85">{tone.label}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Student Detail or Bottleneck Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-surface p-5 space-y-3">
          <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
            Cohort Skill Averages
          </h3>
          <div className="space-y-2.5">
            {analytics.bottlenecks.map((item) => (
              <div key={item.skill} className="space-y-1">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-[#1D1D1F]">{item.skill}</span>
                  <span className="text-[#6E6E73] tabular-nums">
                    {item.cohort_average}% avg · {item.students_needing_support} need support
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.cohort_average}%`,
                      backgroundColor:
                        item.cohort_average >= 70
                          ? '#28CD41'
                          : item.cohort_average >= 50
                            ? '#0071E3'
                            : '#FF9500',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-surface p-5 space-y-3">
          <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
            {selectedStudent ? `${selectedStudent.name} · Advisor Summary` : 'Advisor Intervention Inspector'}
          </h3>
          {selectedStudent ? (
            <div className="space-y-2.5 text-[13px] text-[#6E6E73]">
              <p>
                Targeting <strong className="text-[#1D1D1F]">{selectedStudent.target_role}</strong> at{' '}
                <strong className="text-[#1D1D1F] tabular-nums">{selectedStudent.readiness}%</strong> readiness.
              </p>
              <p>
                Priority gaps below 60%:{' '}
                <strong className="text-[#1D1D1F]">
                  {Object.entries(selectedStudent.skills)
                    .filter(([, score]) => score < 60)
                    .map(([name]) => name)
                    .join(', ') || 'None — ready for capstone'}
                </strong>
              </p>
              <p>
                Recommended university action: Assign adaptive crash-course prerequisites and Socratic mentor check-ins for topics under 60%.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-[#6E6E73]">
              Select any student row in the heatmap above to inspect individualized gap interventions and readiness details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
