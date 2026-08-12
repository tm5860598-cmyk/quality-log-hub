import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders assistant answers: prose for explanations, styled responsive tables for data. */
export function MarkdownView({ children }: { children: string }) {
  return (
    <div className="rich-content prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 prose-pre:my-2 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children: c }) => (
            <div className="table-scroll rounded-xl">
              <table>{c}</table>
            </div>
          ),
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline break-all">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
