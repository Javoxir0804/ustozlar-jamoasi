// Dars konspekti va keyinchalik test savollari: Markdown + LaTeX formulalar ($...$ va $$...$$).
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

// Bitta qatordagi $$...$$ ni alohida formula blokiga aylantiradi (remark-math buni qator ichidagi formula deb o'qiydi)
const blockMath = (src: string) => src.replace(/^[ \t]*\$\$([^\n]+?)\$\$[ \t]*$/gm, (_m, f: string) => `$$\n${f.trim()}\n$$`);

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose-lite ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}
      >
        {blockMath(children)}
      </ReactMarkdown>
    </div>
  );
}
