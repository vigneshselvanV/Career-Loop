import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, FileUp, X } from 'lucide-react';
import type { ProfileUploadResponse } from '../types/careerloop';

interface PdfUploadModalProps {
  open: boolean;
  defaultRole: string;
  availableRoles: string[];
  onClose: () => void;
  onUploadPdf: (file: File, targetRole: string) => Promise<ProfileUploadResponse>;
  onCompleteDiagnostic: (
    uploadRes: ProfileUploadResponse,
    answers: number[]
  ) => Promise<void>;
}

export const PdfUploadModal: React.FC<PdfUploadModalProps> = ({
  open,
  defaultRole,
  availableRoles,
  onClose,
  onUploadPdf,
  onCompleteDiagnostic,
}) => {
  const [targetRole, setTargetRole] = useState(defaultRole);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ProfileUploadResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setTargetRole(defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    if (!open || !uploadResult) return;
    setSecondsLeft(uploadResult.diagnostic_quiz.estimated_seconds || 60);
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, uploadResult]);

  if (!open) return null;

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please choose a LinkedIn or Resume PDF file.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await onUploadPdf(selectedFile, targetRole);
      setUploadResult(res);
      setAnswers({});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to parse PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!uploadResult) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = uploadResult.diagnostic_quiz.questions.map((_, i) => answers[i] ?? 0);
      await onCompleteDiagnostic(uploadResult, list);
      setUploadResult(null);
      setSelectedFile(null);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const allAnswered =
    uploadResult !== null &&
    uploadResult.diagnostic_quiz.questions.every((_, idx) => typeof answers[idx] === 'number');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <div className="glass-surface w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white/92 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold text-[#1D1D1F]">
              {uploadResult
                ? '60-Second Baseline Skill Verification'
                : 'Upload LinkedIn or Resume PDF'}
            </h2>
            <p className="mt-0.5 text-[13px] text-[#6E6E73]">
              {uploadResult
                ? `Extracted ${uploadResult.extracted_profile.claimed_skills.length} skills for ${uploadResult.extracted_profile.full_name}. Verify your baseline below.`
                : 'Profiler Agent extracts your career history and generates a 3-question verification check.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6E6E73] hover:bg-black/[0.06]"
            aria-label="Close upload modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] bg-[#FF3B30]/10 border border-[#FF3B30]/30 px-3.5 py-2.5 text-[13px] text-[#B41E15]">
            {errorMsg}
          </div>
        )}

        {!uploadResult ? (
          <form onSubmit={handleExtract} className="space-y-4">
            <div>
              <label className="block text-[12.5px] font-medium text-[#1D1D1F] mb-1.5">
                Target career role
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-[12px] bg-white border border-black/[0.1] px-3.5 py-2.5 text-[13.5px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-black/20 bg-white/60 px-6 py-8 text-center cursor-pointer hover:border-[#0071E3] transition-colors">
              <FileUp className="h-7 w-7 text-[#0071E3]" />
              <p className="mt-2 text-[14px] font-medium text-[#1D1D1F]">
                {selectedFile ? selectedFile.name : 'Choose a PDF file from your computer'}
              </p>
              <p className="mt-0.5 text-[12px] text-[#6E6E73]">
                Supports text-based and scanned image PDFs
              </p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[11px] bg-white border border-black/[0.08] px-4 py-2 text-[13px] font-medium text-[#1D1D1F]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className="rounded-[11px] bg-[#0071E3] px-5 py-2 text-[13px] font-medium text-white hover:opacity-95 disabled:opacity-45"
              >
                {loading ? 'Extracting profile...' : 'Extract & Start 60s Check'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-[12px] bg-black/[0.04] px-3.5 py-2.5 text-[12.5px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-[#1D1D1F]">
                <CheckCircle2 className="h-4 w-4 text-[#28CD41]" />
                {uploadResult.extracted_profile.full_name} · {uploadResult.target_role}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#0071E3] tabular-nums">
                <Clock className="h-3.5 w-3.5" />
                {secondsLeft}s remaining
              </span>
            </div>

            <div className="space-y-4">
              {uploadResult.diagnostic_quiz.questions.map((q, qIdx) => (
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
                          onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                          className={`rounded-[11px] border px-3 py-2 text-left text-[12.5px] transition-all ${
                            chosen
                              ? 'border-[#0071E3] bg-[#0071E3]/10 font-medium text-[#0071E3]'
                              : 'border-black/[0.08] bg-white text-[#1D1D1F] hover:bg-black/[0.02]'
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

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUploadResult(null)}
                className="rounded-[11px] bg-white border border-black/[0.08] px-4 py-2 text-[13px] font-medium text-[#1D1D1F]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || !allAnswered}
                className="rounded-[11px] bg-[#0071E3] px-5 py-2 text-[13px] font-medium text-white hover:opacity-95 disabled:opacity-45"
              >
                {loading ? 'Verifying...' : 'Verify Skills & Build Roadmap'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
