import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { DEFAULT_MODEL, isValidModel } from "@/lib/models";
import type { DbMessage, MessageContentBlock } from "@/lib/db-types";

export const runtime = "nodejs";
export const maxDuration = 300;

const BASE_SYSTEM = `You are SYCA AI, a helpful personal branding and content strategy assistant for members of Start Your Content Academy. Be concise, practical, and stay on-brand for short-form content creators. Use markdown for structure.`;

type ChatBody = { conversationId: string; message: string };

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.conversationId || !body.message?.trim()) {
    return NextResponse.json({ error: "conversationId and message required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", body.conversationId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "conversation not found" }, { status: 404 });

  const model = isValidModel(conv.model) ? conv.model : DEFAULT_MODEL;

  const [{ data: priorMessages }, { data: project }] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true }),
    conv.project_id
      ? supabase.from("projects").select("system_prompt, name").eq("id", conv.project_id).maybeSingle()
      : Promise.resolve({ data: null as { system_prompt: string | null; name: string } | null }),
  ]);

  const history = (priorMessages ?? []) as DbMessage[];

  const userBlock: MessageContentBlock = { type: "text", text: body.message };
  const { data: insertedUser, error: userInsertErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      role: "user",
      content: [userBlock],
    })
    .select()
    .single();
  if (userInsertErr || !insertedUser) {
    return NextResponse.json({ error: userInsertErr?.message ?? "insert failed" }, { status: 500 });
  }

  const apiMessages = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content as MessageContentBlock[],
    })),
    { role: "user" as const, content: [userBlock] as MessageContentBlock[] },
  ];

  const systemBlocks = [{ type: "text" as const, text: BASE_SYSTEM }];
  if (project?.system_prompt) {
    systemBlocks.push({ type: "text" as const, text: `Project: ${project.name}\n\n${project.system_prompt}` });
  }

  const anthropic = getAnthropicClient();
  const isFirstExchange = history.length === 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let full = "";
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const claudeStream = anthropic.messages.stream({
          model,
          max_tokens: 4096,
          system: systemBlocks,
          messages: apiMessages as Parameters<typeof anthropic.messages.stream>[0]["messages"],
        });

        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            send({ type: "delta", text: event.delta.text });
          }
        }

        const finalMsg = await claudeStream.finalMessage();
        inputTokens = finalMsg.usage.input_tokens ?? 0;
        outputTokens = finalMsg.usage.output_tokens ?? 0;

        await supabase.from("messages").insert({
          conversation_id: conv.id,
          role: "assistant",
          content: [{ type: "text", text: full }],
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        });

        let title: string | null = null;
        if (isFirstExchange) {
          title = body.message.trim().slice(0, 60);
          if (body.message.length > 60) title += "…";
          await supabase.from("conversations").update({ title }).eq("id", conv.id);
        }

        send({ type: "done", title });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream failed";
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
