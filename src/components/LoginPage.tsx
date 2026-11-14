import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Compass, Layers, ShieldCheck } from 'lucide-react';
import { signInWithGooglePopup } from '../firebase';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithGooglePopup();
      onLoginSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to complete sign-in.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('Sign-in popup was closed before completing. Please try again.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="careerloop-canvas-bg min-h-screen flex items-center justify-center p-6 text-[#1D1D1F]">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Brand & Value Column */}
        <div className="lg:col-span-7 glass-surface p-8 sm:p-10 flex flex-col justify-between gap-8">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#0071E3] text-white shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M12 3a9 9 0 1 0 9 9" />
                  <path d="M12 7a5 5 0 1 0 5 5" />
                  <path d="M16 3h5v5" />
                  <path d="M14 10l7-7" />
                </svg>
              </div>
              <span className="text-[20px] font-semibold tracking-tight text-[#1D1D1F]">
                CareerLoop
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-[32px] sm:text-[36px] font-semibold tracking-tight leading-[1.15] text-[#1D1D1F] max-w-lg">
                Verify your real skills and adapt your learning path.
              </h1>
              <p className="text-[15px] leading-relaxed text-[#6E6E73] max-w-md">
                Upload a LinkedIn or resume PDF, run a 60-second baseline check, and follow an adaptive roadmap that restructures itself when you need fundamentals.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-black/[0.06]">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1D1D1F]">
                <CheckCircle2 className="h-4 w-4 text-[#28CD41]" />
                <span>60s Verification</span>
              </div>
              <p className="text-[12.5px] text-[#6E6E73]">
                Confirm claimed skills with rapid diagnostics.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1D1D1F]">
                <Compass className="h-4 w-4 text-[#0071E3]" />
                <span>Adaptive Roadmap</span>
              </div>
              <p className="text-[12.5px] text-[#6E6E73]">
                Dynamic prerequisites inserted when gaps surface.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1D1D1F]">
                <Layers className="h-4 w-4 text-[#FF9500]" />
                <span>Role Benchmarking</span>
              </div>
              <p className="text-[12.5px] text-[#6E6E73]">
                Pivot targets instantly while keeping verified credit.
              </p>
            </div>
          </div>
        </div>

        {/* Right Sign-In Card */}
        <div className="lg:col-span-5 glass-surface p-8 sm:p-10 flex flex-col justify-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#0071E3]">
              <ShieldCheck className="h-4 w-4" />
              <span>Firebase Authentication</span>
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">
              Sign in to CareerLoop
            </h2>
            <p className="text-[13.5px] leading-relaxed text-[#6E6E73]">
              Use your Google account to access your personalized roadmap, assessments, and AI mentor workspace.
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-[12px] bg-[#FF3B30]/10 border border-[#FF3B30]/30 px-3.5 py-2.5 text-[13px] text-[#B41E15]">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-[14px] bg-[#0071E3] px-5 py-3.5 text-[14px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,113,227,0.55)] transition-all hover:opacity-95 disabled:opacity-55"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.98h5.27c-.45 2.38-2.46 3.92-5.27 3.92a6 6 0 1 1 0-12c1.56 0 2.95.58 4.02 1.54l2.24-2.24A9.2 9.2 0 0 0 12.18 2.8a9.2 9.2 0 1 0 0 18.4c5.3 0 8.82-3.72 8.82-8.96 0-.6-.06-1.14-.15-1.14z"
              />
            </svg>
            <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>

          <p className="text-[12px] leading-relaxed text-[#6E6E73]">
            First-time sign-in launches a quick 3-step AI skill check, with optional access to the Sophia Vance demo persona.
          </p>
        </div>
      </div>
    </div>
  );
};
