"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export type UsageInfo = {
  input?: number | null;
  output?: number | null;
  cacheCreation?: number | null;
  cacheRead?: number | null;
};

export function ChatMessage({
  role,
  text,
  streaming,
  usage,
}: {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  usage?: UsageInfo;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-foreground align-middle" />}
          </div>
        )}
      </div>
      {!isUser && usage && !streaming && <UsageLine usage={usage} />}
    </div>
  );
}

function UsageLine({ usage }: { usage: UsageInfo }) {
  const parts: string[] = [];
  if (usage.input != null) parts.push(`${usage.input} in`);
  if (usage.output != null) parts.push(`${usage.output} out`);
  if (usage.cacheRead) parts.push(`${usage.cacheRead} cache-hit`);
  if (usage.cacheCreation) parts.push(`${usage.cacheCreation} cache-write`);
  if (parts.length === 0) return null;
  return <span className="px-1 text-[10px] text-muted-foreground">{parts.join(" · ")}</span>;
}
