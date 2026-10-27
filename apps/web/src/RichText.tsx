// Savol va variant matni: Markdown + LaTeX formulalar ($...$, $$...$$)
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function RichText({ text }: { text: string }) {
  return (
    <div className="leading-relaxed [&_p]:my-0">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
