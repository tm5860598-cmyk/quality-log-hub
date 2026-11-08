import { isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Flattens React children into plain text (used to detect callout tone). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

type Tone = "info" | "warn" | "ok" | "danger";

/** Picks the card tone from the first words of a blockquote. */
function calloutTone(text: string): Tone {
  const t = text.trim();
  if (/^(⛔|❌|🚫|خطر|حرج|عدم مطابقة)/.test(t)) return "danger";
  if (/^(⚠|تحذير|تنبيه|انتبه|ملاحظة هامة)/.test(t)) return "warn";
  if (/^(✅|✔|☑|نجاح|مطابق)/.test(t)) return "ok";
  return "info";
}

type HastLike = { type: string; tagName?: string; children?: HastLike[] };

const components: Components = {
  table: ({ node, children: c }) => {
    const kids = ((node as unknown as HastLike | undefined)?.children ?? []) as HastLike[];
    const body = kids.find((k) => k.type === "element" && k.tagName === "tbody");
    const rows = (body?.children ?? []).filter((k) => k.type === "element" && k.tagName === "tr").length;
    // Small tables stay on one page when printed; long ones may flow across pages.
    return (
      <div className={`table-scroll rounded-xl ${rows > 0 && rows <= 8 ? "md-table-keep" : ""}`}>
        <table>{c}</table>
      </div>
    );
  },
  a: ({ href, children: c }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline break-all">
      {c}
    </a>
  ),
  blockquote: ({ children: c }) => (
    <div className={`md-callout md-${calloutTone(textOf(c))}`} role="note">
      {c}
    </div>
  ),
};

/** Splits an answer into an intro + one block per `## heading` (ignores fenced code). */
export function splitSections(md: string) {
  const intro: string[] = [];
  const sections: { title: string; body: string[] }[] = [];
  let fenced = false;
  for (const line of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      sections.push({ title: heading[1], body: [] });
      continue;
    }
    (sections.length ? sections[sections.length - 1].body : intro).push(line);
  }
  return {
    intro: intro.join("\n"),
    sections: sections.map((s) => ({ title: s.title, body: s.body.join("\n") })),
  };
}

/**
 * Renders assistant answers: prose, tables, callout cards and — with `cards` —
 * every `## section` as a titled card (template-style layout, on screen and in print).
 */
export function MarkdownView({ children, cards = false }: { children: string; cards?: boolean }) {
  const render = (src: string) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {src}
    </ReactMarkdown>
  );
  const parsed = cards ? splitSections(children) : null;

  return (
    <div className="rich-content md-body max-w-none leading-relaxed">
      {parsed && parsed.sections.length > 0 ? (
        <>
          {parsed.intro.trim() && render(parsed.intro)}
          {parsed.sections.map((s, i) => (
            <div key={`${i}-${s.title}`} className="md-card">
              <div className="md-card-head" role="heading" aria-level={2}>
                {s.title.replace(/[*_`]/g, "")}
              </div>
              <div className="md-card-body">{render(s.body)}</div>
            </div>
          ))}
        </>
      ) : (
        render(children)
      )}
    </div>
  );
}
