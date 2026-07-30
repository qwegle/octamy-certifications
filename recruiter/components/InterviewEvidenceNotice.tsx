import { LockKeyhole } from 'lucide-react';

type InterviewEvidenceNoticeProps = {
  className?: string;
  compact?: boolean;
};

export default function InterviewEvidenceNotice({ className = '', compact = false }: InterviewEvidenceNoticeProps) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-slate-950 ${className}`}
      role="status"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm">
        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">Verified interview evidence is not released yet</p>
        <p className={`mt-1 text-sm text-slate-800 ${compact ? 'leading-5' : 'leading-6'}`}>
          Interview Studio is private learner practice. Recruiters cannot view, filter, unlock, or be charged for its responses, recordings, transcripts, code, or feedback. Any future verified sharing will require explicit learner consent and review controls.
        </p>
      </div>
    </div>
  );
}
