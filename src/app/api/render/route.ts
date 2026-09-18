import { NextResponse } from "next/server";
import { startRender } from "@/lib/agent/engine";
import type { RenderRequest } from "@/lib/types";

export async function POST(request: Request) {
  let body: Partial<RenderRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "A film needs something to be about." },
      { status: 400 },
    );
  }

  const accepted = startRender({
    prompt,
    kind: body.kind === "refinement" ? "refinement" : "seed",
    threadId: body.threadId ?? null,
    originalPrompt: body.originalPrompt?.trim() || prompt,
    parentFilmId: body.parentFilmId ?? null,
  });

  return NextResponse.json(accepted, { status: 202 });
}
