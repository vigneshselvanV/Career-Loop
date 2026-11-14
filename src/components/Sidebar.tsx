import React from 'react';
import {
  BarChart3,
  Compass,
  GraduationCap,
  Layers,
  LogOut,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import type { CareerView } from '../types/careerloop';

interface SidebarProps {
  activeView: CareerView;
  onSelectView: (view: CareerView) => void;
  candidateName: string;
  batchCohort: string;
  targetRole: string;
  readinessScore: number;
  authUserEmail?: string | null;
  isDemoMode: boolean;
  onLoadDemo: () => void;
  onReturnToMyWorkspace: () => void;
  onRerunOnboarding: () => void;
  onOpenUpload: () => void;
  onSignOut: () => void;
  isBusy: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: CareerView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview & Roadmap', icon: Compass },
  { id: 'skills', label: 'Skill Matrix', icon: Layers },
  { id: 'mentor', label: 'Assessments & Mentor', icon: GraduationCap },
  { id: 'cohort', label: 'Cohort Analytics', icon: BarChart3 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  candidateName,
  batchCohort,
  targetRole,
  readinessScore,
  authUserEmail,
  isDemoMode,
  onLoadDemo,
  onReturnToMyWorkspace,
  onRerunOnboarding,
  onOpenUpload,
  onSignOut,
  isBusy,
  mobileOpen,
  onCloseMobile,
}) => {
  const content = (
    <aside className="flex h-full w-[250px] shrink-0 flex-col justify-between bg-white/75 backdrop-blur-2xl border-r border-white/90 px-4 py-6 select-none">
      <div className="space-y-6">
        {/* Brand Lockup */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0071E3] text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 3a9 9 0 1 0 9 9" />
                <path d="M12 7a5 5 0 1 0 5 5" />
                <path d="M16 3h5v5" />
                <path d="M14 10l7-7" />
              </svg>
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-[#1D1D1F] whitespace-nowrap">
              CareerLoop
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden rounded-lg p-1.5 text-[#6E6E73] hover:bg-black/5"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active Candidate Identity Summary */}
        <div className="rounded-[16px] bg-white/70 border border-black/[0.06] px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-[#1D1D1F] truncate">{candidateName}</p>
            {isDemoMode && (
              <span className="text-[11px] font-medium text-[#B86200] shrink-0">Demo</span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-[#6E6E73] truncate">
            {batchCohort} · {targetRole}
          </p>
          <div className="mt-2.5 flex items-center justify-between text-[12px]">
            <span className="text-[#6E6E73]">Readiness</span>
            <span className="font-semibold text-[#1D1D1F] tabular-nums">
              {Math.round(readinessScore)}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-[#0071E3] transition-all duration-300"
              style={{ width: `${Math.min(Math.max(readinessScore, 0), 100)}%` }}
            />
          </div>
        </div>

        {/* Primary Navigation */}
        <nav aria-label="Workspace navigation" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[13.5px] font-medium transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#0071E3] text-white shadow-[0_6px_16px_-6px_rgba(0,113,227,0.45)]'
                    : 'text-[#1D1D1F] hover:bg-black/[0.04]'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-[#6E6E73]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Actions & Account Sign-Out */}
      <div className="space-y-2 pt-4 border-t border-black/[0.06]">
        <button
          type="button"
          onClick={() => {
            onOpenUpload();
            onCloseMobile();
          }}
          disabled={isBusy}
          className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#1D1D1F] px-3.5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span>Upload Resume PDF</span>
        </button>

        {isDemoMode ? (
          <button
            type="button"
            onClick={() => {
              onReturnToMyWorkspace();
              onCloseMobile();
            }}
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#0071E3]/10 border border-[#0071E3]/25 px-3.5 py-2.5 text-[13px] font-medium text-[#0071E3] transition-colors hover:bg-[#0071E3]/15 disabled:opacity-50 whitespace-nowrap"
          >
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span>Return to My Profile</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onLoadDemo();
              onCloseMobile();
            }}
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-white/80 border border-black/[0.08] px-3.5 py-2.5 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-white disabled:opacity-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0 text-[#0071E3]" />
            <span>Load Demo Persona</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onRerunOnboarding();
            onCloseMobile();
          }}
          disabled={isBusy}
          className="flex w-full items-center justify-center gap-2 rounded-[11px] px-3 py-1.5 text-[12px] font-medium text-[#6E6E73] hover:bg-black/[0.04] hover:text-[#1D1D1F] whitespace-nowrap"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          <span>Re-run 3-Step Setup</span>
        </button>

        <div className="pt-2 flex items-center justify-between gap-2 px-1 border-t border-black/[0.05]">
          <span className="text-[11.5px] text-[#6E6E73] truncate">
            {authUserEmail || 'Signed in'}
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-[#6E6E73] hover:bg-black/[0.05] hover:text-[#1D1D1F] whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block h-full">{content}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
