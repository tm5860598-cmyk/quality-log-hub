import type { ReactNode } from "react";
import { File as FileIcon, FileSpreadsheet, FileText, FileType2, Image as ImageIcon, Presentation } from "lucide-react";
import type { FileKind } from "@/lib/convert-text";

export const KIND_STYLE: Record<FileKind | "paste", { icon: ReactNode; box: string }> = {
  pdf: { icon: <FileType2 className="size-5" />, box: "bg-red-500/10 text-red-600 dark:text-red-400" },
  word: { icon: <FileText className="size-5" />, box: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  excel: { icon: <FileSpreadsheet className="size-5" />, box: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  powerpoint: { icon: <Presentation className="size-5" />, box: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  image: { icon: <ImageIcon className="size-5" />, box: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  text: { icon: <FileText className="size-5" />, box: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  legacy: { icon: <FileIcon className="size-5" />, box: "bg-slate-500/10 text-slate-500" },
  paste: { icon: <FileText className="size-5" />, box: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
};

export function KindBadge({ kind }: { kind: FileKind | "paste" }) {
  return <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${KIND_STYLE[kind].box}`}>{KIND_STYLE[kind].icon}</span>;
}

/** Segmented control (radio-group semantics). */
export function Segmented<T extends string>({ value, onChange, options, label, disabled }: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full flex-wrap gap-1 rounded-xl border bg-muted/50 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              on ? "bg-background text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl border p-3 text-start transition hover:bg-muted/40"
    >
      <span className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span className={`size-4 rounded-full bg-white shadow transition-transform ${checked ? "-translate-x-4" : ""}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

export function StepPill({ n, label, state }: { n: number; label: string; state: "done" | "active" | "todo" }) {
  const dot =
    state === "done" ? "bg-primary text-primary-foreground"
    : state === "active" ? "bg-primary/15 text-primary ring-2 ring-primary"
    : "bg-muted text-muted-foreground";
  return (
    <li className="flex min-w-0 flex-1 items-center gap-2">
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${dot}`}>{state === "done" ? "✓" : n}</span>
      <span className={`truncate text-xs font-semibold sm:text-sm ${state === "todo" ? "text-muted-foreground" : ""}`}>{label}</span>
    </li>
  );
}

export function Card({ title, subtitle, action, children, id }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-semibold">{label}</div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
