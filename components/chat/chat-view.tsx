"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage, type UsageInfo } from "@/components/chat/chat-message";
import { ModelPicker } from "@/components/chat/model-picker";
import { renameConversation, setConversationModel } from "@/app/(app)/actions";
import type { Conversation, DbMessage, MessageContentBlock, Project } from "@/lib/db-types";
import type { ModelId } from "@/lib/models";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  usage?: UsageInfo;
};

function toUi(msg: DbMessage): UiMessage {
  const text = msg.content
    .filter((b): b is Extract<MessageContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  const usage: UsageInfo | undefined =
    msg.role === "assistant"
      ? {
          input: msg.input_tokens,
          output: msg.output_tokens,
          cacheCreation: msg.cache_creation_tokens,
          cacheRead: msg.cache_read_tokens,
        }
      : undefined;
  return { id: msg.id, role: msg.role === "assistant" ? "assistant" : "user", text, usage };
}

export function ChatView({
  conversation,
  initialMessages,
  project,
}: {
  conversation: Conversation;
  initialMessages: DbMessage[];
  project: Project | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages.map(toUi));
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelId>(conversation.model as ModelId);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function onModelChange(next: ModelId) {
    setModel(next);
    startTransition(async () => {
      try {
        await setConversationModel(conversation.id, next);
      } catch (e) {
        console.error(e);
      }
    });
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setError(null);
    setInput("");
    const userMsg: UiMessage = { id: `tmp-${Date.now()}`, role: "user", text: content };
    const assistantMsg: UiMessage = { id: `tmp-a-${Date.now()}`, role: "assistant", text: "", streaming: true };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id, message: content }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        throw new Error(errText || `Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === "delta") {
              full += evt.text;
              setMessages((m) =>
                m.map((x) => (x.id === assistantMsg.id ? { ...x, text: full } : x)),
              );
            } else if (evt.type === "done") {
              if (evt.title && !conversation.title) {
                startTransition(async () => {
                  try {
                    await renameConversation(conversation.id, evt.title);
                  } catch {}
                });
              }
              router.refresh();
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((m) => m.filter((x) => x.id !== assistantMsg.id));
    } finally {
      setMessages((m) => m.map((x) => ({ ...x, streaming: false })));
      setStreaming(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center py-20 text-center">
              <div>
                <h2 className="mb-2 text-2xl font-semibold">Start a conversation</h2>
                <p className="text-sm text-muted-foreground">
                  {project ? `This chat is scoped to ${project.name}.` : "Ask anything."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  text={m.text}
                  streaming={m.streaming}
                  usage={m.usage}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="mb-2 flex items-center justify-between">
            <ModelPicker value={model} onChange={onModelChange} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="relative">
            <Textarea
              placeholder="Message SYCA AI…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={3}
              className="resize-none pr-12"
              disabled={streaming}
            />
            <Button
              size="icon"
              className="absolute bottom-2 right-2 h-8 w-8"
              onClick={send}
              disabled={streaming || !input.trim()}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
