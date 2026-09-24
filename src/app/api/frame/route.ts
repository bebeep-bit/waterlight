import { NextResponse } from "next/server";
import { paintFrame } from "@/lib/agent/engine";
import { isAspectId } from "@/lib/aspect";
import type { FrameRequest } from "@/lib/types";

/** flux-dev / kontext-edit with a reference can take longer. */
export const maxDuration = 90;

export async function POST(request: Request) {
  let body: Partial<FrameRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const prompt = body.prompt?.trim() ?? "";
  const subjectUrl = body.subjectUrl?.trim() || undefined;
  if (!prompt && !subjectUrl) {
    return NextResponse.json(
      { error: "A film needs something to be about." },
      { status: 400 },
    );
  }

  try {
    const result = await paintFrame({
      prompt,
      kind: body.kind === "refinement" ? "refinement" : "seed",
      originalPrompt: body.originalPrompt?.trim() || prompt || "Objects in the frame",
      aspect: isAspectId(body.aspect) ? body.aspect : undefined,
      referenceUrl: body.referenceUrl?.trim() || undefined,
      subjectUrl,
      referenceMode: subjectUrl ? "subject" : body.referenceUrl?.trim() ? "style" : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The paper tore." },
      { status: 502 },
    );
  }
}
