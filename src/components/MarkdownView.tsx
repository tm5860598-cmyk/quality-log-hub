import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
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

type Tone = "info" | "warn" | "ok" | "danger" | "sticky" | "tip" | "goal";

/** Picks the card tone from the first words of a blockquote. */
function calloutTone(text: string): Tone {
  const t = text.trim();
  if (/^(⛔|❌|🚫|خطر|حرج|عدم مطابقة)/.test(t)) return "danger";
  if (/^(⚠|تحذير|تنبيه|انتبه|ملاحظة هامة)/.test(t)) return "warn";
  if (/^(✅|✔|☑|نجاح|مطابق)/.test(t)) return "ok";
  if (/^(📌|📝|🗒|ملاحظة)/.test(t)) return "sticky";
  if (/^(💡|🔎|مثال|تطبيق)/.test(t)) return "tip";
  if (/^(🎯|⭐|الخلاصة)/.test(t)) return "goal";
  return "info";
}

type HastLike = { type: string; tagName?: string; children?: HastLike[] };

type KvRow = { label: string; value: ReactNode[] };

/** "- **Label:** value" lists (every item) → rows of a 2-column table; null when the list is not that regular. */
function kvRows(children: ReactNode): KvRow[] | null {
  const lis = Children.toArray(children).filter(isValidElement) as ReactElement<{ children?: ReactNode }>[];
  if (lis.length < 2) return null;
  const rows: KvRow[] = [];
  for (const li of lis) {
    if (li.type !== "li") return null;
    const kids = Children.toArray(li.props.children).filter((k) => !(typeof k === "string" && !k.trim()));
    const first = kids[0];
    if (!isValidElement(first) || first.type !== "strong") return null;
    const raw = textOf((first.props as { children?: ReactNode }).children).trim();
    const rest = kids.slice(1);
    if (!/[:：]$/.test(raw) && !(typeof rest[0] === "string" && /^\s*[:：]/.test(rest[0]))) return null;
    if (typeof rest[0] === "string") rest[0] = rest[0].replace(/^\s*[:：]?\s*/, "");
    const label = raw.replace(/\s*[:：]\s*$/, "");
    if (!label || rest.length === 0 || (rest.length === 1 && rest[0] === "")) return null;
    rows.push({ label, value: rest });
  }
  return rows;
}

function KvTable({ rows, numbered }: { rows: KvRow[]; numbered: boolean }) {
  return (
    <div className={`md-kv-wrap ${rows.length <= 10 ? "md-table-keep" : ""}`}>
      <table className="md-kv">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {numbered && <td className="md-kv-n">{i + 1}</td>}
              <th scope="row">{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* ---------------- Visual-learning blocks (```flow / ```infographic / ```chart) ---------------- */
const VISUAL_LANG = /language-(flow|infographic|chart)\b/;
const STEP_COLORS = ["sky", "violet", "emerald", "amber", "rose", "teal"] as const;

function FlowChart({ src }: { src: string }) {
  const rows = src.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split(/\s*(?:->|→|⟶|=>)\s*/).map((x) => x.trim()).filter(Boolean))
    .filter((r) => r.length > 0);
  return (
    <div className="md-flow" role="img" aria-label="مخطط انسيابي">
      {rows.map((steps, r) => (
        <div className="md-flow-row" key={r}>
          {steps.map((st, i) => (
            <span key={i} className="md-flow-item">
              <span className={`md-flow-step md-c-${STEP_COLORS[(i + r) % STEP_COLORS.length]}`}>{st}</span>
              {i < steps.length - 1 && <span className="md-flow-arrow" aria-hidden>←</span>}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function InfoTiles({ src }: { src: string }) {
  const tiles = src.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [big, ...rest] = l.split("|");
    return { big: big.trim(), label: rest.join("|").trim() };
  });
  return (
    <div className="md-info-grid">
      {tiles.map((t, i) => (
        <div key={i} className={`md-info-tile md-c-${STEP_COLORS[i % STEP_COLORS.length]}`}>
          <div className="md-info-big">{t.big}</div>
          {t.label && <div className="md-info-label">{t.label}</div>}
        </div>
      ))}
    </div>
  );
}

function BarChart({ src }: { src: string }) {
  const rows = src.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const idx = l.lastIndexOf(":");
    const label = (idx > 0 ? l.slice(0, idx) : l).trim();
    const raw = idx > 0 ? l.slice(idx + 1).trim() : "";
    const n = parseFloat(raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? "");
    return { label, raw, n: Number.isFinite(n) ? n : 0 };
  });
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.n)));
  return (
    <div className="md-bars" role="img" aria-label="رسم بياني">
      {rows.map((r, i) => (
        <div key={i} className="md-bar-row">
          <span className="md-bar-label">{r.label}</span>
          <span className="md-bar-track"><span className={`md-bar-fill md-c-${STEP_COLORS[i % STEP_COLORS.length]}`} style={{ width: `${Math.max(3, (Math.abs(r.n) / max) * 100)}%` }} /></span>
          <span className="md-bar-value">{r.raw}</span>
        </div>
      ))}
    </div>
  );
}

/** True when the answer uses the visual-notes vocabulary (sticky notes, flowcharts, infographics, charts). */
export const isVisualNotes = (md: string) => /```(flow|infographic|chart)\b/.test(md) || /^>\s*(📌|📝|💡|🎯)/m.test(md);

const components: Components = {
  pre: ({ children: c }) => {
    const el = Children.toArray(c)[0];
    if (isValidElement(el) && VISUAL_LANG.test(String((el.props as { className?: string }).className ?? ""))) return <>{c}</>;
    return <pre>{c}</pre>;
  },
  code: ({ className, children: c }) => {
    const m = VISUAL_LANG.exec(className ?? "");
    if (!m) return <code className={className}>{c}</code>;
    const src = textOf(c).replace(/\n$/, "");
    return m[1] === "flow" ? <FlowChart src={src} /> : m[1] === "infographic" ? <InfoTiles src={src} /> : <BarChart src={src} />;
  },
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

/** `structured` (print): labelled lists become tables. */
function withStructure(): Components {
  return {
    ...components,
    ul: ({ children: c }) => { const r = kvRows(c); return r ? <KvTable rows={r} numbered={false} /> : <ul>{c}</ul>; },
    ol: ({ children: c }) => { const r = kvRows(c); return r ? <KvTable rows={r} numbered /> : <ol>{c}</ol>; },
  };
}
const structuredComponents = withStructure();

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
export function MarkdownView({ children, cards = false, structured = false }: { children: string; cards?: boolean; structured?: boolean }) {
  const render = (src: string) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={structured ? structuredComponents : components}>
      {src}
    </ReactMarkdown>
  );
  const parsed = cards ? splitSections(children) : null;

  return (
    <div className={`rich-content md-body max-w-none leading-relaxed ${isVisualNotes(children) ? "md-visual" : ""}`}>
      {parsed && parsed.sections.length > 0 ? (
        <>
          {parsed.intro.trim() && render(parsed.intro)}
          {parsed.sections.map((s, i) => (
            <div key={`${i}-${s.title}`} className={`md-card ${/^\s*🎯/.test(s.title) ? "md-card-goal" : ""}`}>
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
