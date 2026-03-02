"use client";

import { Check, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";

type CodeBlockProps = {
  code: string;
  language?: string;
  className?: string;
};

const LANG_LABELS: Record<string, string> = {
  html: "HTML",
  tsx: "TSX",
  jsx: "JSX",
  typescript: "TypeScript",
  ts: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  bash: "Bash",
  shell: "Shell",
};

export function CodeBlock({
  code,
  language = "typescript",
  className,
}: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function highlight() {
      try {
        const highlightedHtml = await codeToHtml(code, {
          lang: language,
          theme: "vitesse-dark",
        });
        if (!cancelled) setHtml(highlightedHtml);
      } catch {
        if (!cancelled)
          setHtml(
            `<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`,
          );
      }
    }
    highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langLabel = LANG_LABELS[language] ?? language.toUpperCase();

  return (
    <div
      className={cn(
        "relative group my-6 overflow-hidden border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-md",
        className,
      )}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2 border-b-2 border-foreground">
        <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-widest">
          {langLabel}
        </span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors py-0.5 px-2 rounded hover:bg-zinc-700"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div
        className="w-full overflow-x-auto bg-zinc-950 [&>pre]:m-0! [&>pre]:bg-zinc-950! [&>pre]:p-5! [&>pre]:text-[0.875rem]! [&>pre]:leading-6! [&>pre]:font-mono! [&_code]:block! [&_code]:bg-transparent! [&_code]:p-0! [&_code]:border-none! [&_code]:text-inherit! [&_code]:rounded-none!"
        dangerouslySetInnerHTML={{
          __html:
            html ||
            `<pre class="bg-zinc-950 p-5"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`,
        }}
      />
    </div>
  );
}
