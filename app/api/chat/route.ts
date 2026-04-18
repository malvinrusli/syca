import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAnthropicClient, ANTHROPIC_BETAS } from "@/lib/anthropic";
import { DEFAULT_MODEL, isValidModel } from "@/lib/models";
import { isImageMime } from "@/lib/files";
import type { DbMessage, MessageContentBlock } from "@/lib/db-types";

export const runtime = "nodejs";
export const maxDuration = 300;

const BASE_SYSTEM = `You are SYCA AI, a helpful personal branding and content strategy assistant for members of Start Your Content Academy. Be concise, practical, and stay on-brand for short-form content creators. Use markdown for structure.`;

type ChatBody = { conversationId: string; message: string };

type FileRef = { anthropic_file_id: string | null; mime_type: string | null };

function filesToBlocks(files: FileRef[]): MessageContentBlock[] {
  return files
    .filter((f): f is FileRef & { anthropic_file_id: string } => Boolean(f.anthropic_file_id))
    .map((f) => {
      if (isImageMime(f.mime_type)) {
        return { type: "image", source: { type: "file", file_id: f.anthropic_file_id } } as const;
      }
      return { type: "document", source: { type: "file", file_id: f.anthropic_file_id } } as const;
    });
}

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

  const [
    { data: priorMessages },
    { data: project },
    { data: projectFiles },
    { data: referenceFiles },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true }),
    conv.project_id
      ? supabase.from("projects").select("system_prompt, name").eq("id", conv.project_id).maybeSingle()
      : Promise.resolve({ data: null as { system_prompt: string | null; name: string } | null }),
    conv.project_id
      ? supabase
          .from("project_files")
          .select("anthropic_file_id, mime_type")
          .eq("project_id", conv.project_id)
      : Promise.resolve({ data: [] as FileRef[] }),
    supabase
      .from("reference_files")
      .select("anthropic_file_id, mime_type")
      .eq("enabled", true),
  ]);

  const history = (priorMessages ?? []) as DbMessage[];
  const isFirstExchange = history.length === 0;

  const userText: MessageContentBlock = { type: "text", text: body.message };
  const contextBlocks: MessageContentBlock[] = isFirstExchange
    ? [...filesToBlocks((referenceFiles ?? []) as FileRef[]), ...filesToBlocks((projectFiles ?? []) as FileRef[])]
    : [];
  const thisUserContent: MessageContentBlock[] = [...contextBlocks, userText];

  const { error: userInsertErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      role: "user",
      content: thisUserContent,
    });
  if (userInsertErr) {
    return NextResponse.json({ error: userInsertErr.message }, { status: 500 });
  }

  const apiMessages = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content as MessageContentBlock[],
    })),
    { role: "user" as const, content: thisUserContent },
  ];

  const systemBlocks = [{ type: "text" as const, text: BASE_SYSTEM }];
  if (project?.system_prompt) {
    systemBlocks.push({ type: "text" as const, text: `Project: ${project.name}\n\n${project.system_prompt}` });
  }

  const anthropic = getAnthropicClient();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let full = "";

      try {
        const claudeStream = anthropic.beta.messages.stream({
          model,
          max_tokens: 4096,
          system: systemBlocks,
          messages: apiMessages as unknown as Parameters<typeof anthropic.beta.messages.stream>[0]["messages"],
          betas: ANTHROPIC_BETAS,
        });

        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            send({ type: "delta", text: event.delta.text });
          }
        }

        const finalMsg = await claudeStream.finalMessage();
        const usage = finalMsg.usage;

        await supabase.from("messages").insert({
          conversation_id: conv.id,
          role: "assistant",
          content: [{ type: "text", text: full }],
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_creation_tokens: usage.cache_creation_input_tokens ?? null,
          cache_read_tokens: usage.cache_read_input_tokens ?? null,
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
