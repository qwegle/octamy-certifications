import { AlertTriangle, Check, Flag, Loader2, Maximize, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type AnswerMap = Record<string | number, number>;

export function QuestionNavigator({
  questionIds,
  currentIndex,
  answers,
  flaggedQuestionIds,
  onNavigate,
}: {
  questionIds: number[];
  currentIndex: number;
  answers: AnswerMap;
  flaggedQuestionIds: ReadonlySet<number>;
  onNavigate: (index: number) => void;
}) {
  return (
    <nav aria-label="Question navigator" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Question navigator</p>
          <p className="mt-1 text-sm text-slate-600">Jump to any question.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          {Object.keys(answers).length}/{questionIds.length}
        </span>
      </div>

      <div className="mt-4 grid max-h-[45vh] grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-8 lg:grid-cols-4">
        {questionIds.map((questionId, index) => {
          const current = index === currentIndex;
          const flagged = flaggedQuestionIds.has(questionId);
          const answered = answers[questionId] !== undefined;
          return (
            <button
              key={questionId}
              type="button"
              aria-label={`Go to question ${index + 1}${current ? ", current question" : ""}${answered ? ", answered" : ", unanswered"}${flagged ? ", flagged for review" : ""}`}
              aria-current={current ? "step" : undefined}
              onClick={() => onNavigate(index)}
              className={cn(
                "relative grid min-h-11 place-items-center rounded-xl border text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                flagged
                  ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  : answered
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-white",
                current && "border-violet-700 bg-violet-700 text-white ring-2 ring-violet-300 ring-offset-2 hover:bg-violet-700",
              )}
            >
              {index + 1}
              {flagged ? (
                <Flag className={cn("absolute right-1 top-1 h-2.5 w-2.5", current ? "fill-amber-300 text-amber-200" : "fill-amber-500 text-amber-600")} aria-hidden="true" />
              ) : answered ? (
                <Check className={cn("absolute right-1 top-1 h-2.5 w-2.5", current ? "text-white" : "text-emerald-700")} aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-[11px] font-semibold text-slate-600" aria-hidden="true">
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-violet-700 ring-1 ring-violet-300 ring-offset-1" />Current</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-emerald-200 bg-emerald-50" />Answered</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-50" />Flagged</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-slate-200 bg-slate-50" />Unanswered</span>
      </div>
    </nav>
  );
}

export function SubmitExamDialog({
  open,
  onOpenChange,
  totalQuestions,
  answeredQuestions,
  flaggedQuestions,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalQuestions: number;
  answeredQuestions: number;
  flaggedQuestions: number;
  submitting: boolean;
  onConfirm: () => void;
}) {
  const unansweredQuestions = Math.max(0, totalQuestions - answeredQuestions);
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <Send className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Submit this exam?</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            Submission is final. You will not be able to change your answers after the server accepts this attempt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-3 gap-2" aria-label="Attempt summary">
          <SummaryValue label="Answered" value={answeredQuestions} tone="emerald" />
          <SummaryValue label="Unanswered" value={unansweredQuestions} tone={unansweredQuestions > 0 ? "amber" : "slate"} />
          <SummaryValue label="Flagged" value={flaggedQuestions} tone={flaggedQuestions > 0 ? "amber" : "slate"} />
        </div>
        {(unansweredQuestions > 0 || flaggedQuestions > 0) && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            You can cancel and use the question navigator to review unfinished or flagged questions.
          </p>
        )}
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={submitting}>Continue exam</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={submitting} className="bg-slate-950 text-white hover:bg-slate-800">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
            {submitting ? "Submitting…" : "Submit exam"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FullscreenExitGuard({
  open,
  returningToFullscreen,
  submitting,
  onReturnToFullscreen,
  onSubmit,
}: {
  open: boolean;
  returningToFullscreen?: boolean;
  submitting: boolean;
  onReturnToFullscreen: () => void;
  onSubmit: () => void;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className="max-w-md rounded-2xl border-amber-200"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Fullscreen is required to continue</AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-slate-600">
            You left fullscreen mode. This integrity event has been recorded and answering is blocked while the exam timer continues. Return to fullscreen to continue, or submit your current answers now.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onSubmit} disabled={submitting || returningToFullscreen}>
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />Submit exam
          </Button>
          <Button type="button" onClick={onReturnToFullscreen} disabled={submitting || returningToFullscreen} className="bg-slate-950 text-white hover:bg-slate-800">
            {returningToFullscreen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Maximize className="mr-2 h-4 w-4" aria-hidden="true" />}
            {returningToFullscreen ? "Opening…" : "Return to fullscreen"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SummaryValue({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "slate" }) {
  const toneClass = tone === "emerald"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-slate-200 bg-slate-50 text-slate-800";
  return <div className={cn("rounded-xl border p-3 text-center", toneClass)}><strong className="block text-xl">{value}</strong><span className="text-[11px] font-bold">{label}</span></div>;
}
