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

export function CodeBlock({
  code,
  language = "typescript",
  className,
}: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function highlight() {
      try {
        const highlightedHtml = await codeToHtml(code, {
          lang: language,
          theme: "vitesse-dark",
        });
        setHtml(highlightedHtml);
      } catch (error) {
        // Fallback if shiki fails to load/parse
        setHtml(
          `<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`,
        );
      }
    }

    highlight();
  }, [code, language]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "relative group my-6 overflow-hidden rounded-md border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        className,
      )}
    >
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onCopy}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-colors border border-zinc-600"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      <div
        className="w-full overflow-x-auto [&>pre]:m-0! [&>pre]:min-w-max! [&>pre]:bg-zinc-950! [&>pre]:p-4! [&>pre]:text-sm/6! [&>pre]:text-zinc-50! [&_code]:block! [&_code]:bg-transparent! [&_code]:p-0! [&_code]:text-inherit!"
        dangerouslySetInnerHTML={{
          __html:
            html ||
            `<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`,
        }}
      />
    </div>
  );
}
