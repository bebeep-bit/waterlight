import { NextResponse } from "next/server";
import { paintFrame } from "@/lib/agent/engine";
import type { FrameRequest } from "@/lib/types";

/** flux-schnell answers in ~2s, but allow headroom for a slow provider. */
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: Partial<FrameRequest>;
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

  try {
    const result = await paintFrame({
      prompt,
      kind: body.kind === "refinement" ? "refinement" : "seed",
      originalPrompt: body.originalPrompt?.trim() || prompt,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The paper tore." },
      { status: 502 },
    );
  }
}
