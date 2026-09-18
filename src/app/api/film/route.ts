import { NextResponse } from "next/server";
import { startFilm } from "@/lib/agent/engine";
import type { FilmRequest } from "@/lib/types";

export async function POST(request: Request) {
  let body: Partial<FilmRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (!body.imageUrl) {
    return NextResponse.json(
      { error: "A film has to be animated from a frame." },
      { status: 400 },
    );
  }

  try {
    const accepted = await startFilm({
      imageUrl: body.imageUrl,
      prompt: body.prompt?.trim() ?? "",
      tier: body.tier === "final" ? "final" : "preview",
      seconds: Number(body.seconds) || 8,
    });
    return NextResponse.json(accepted, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The paper tore." },
      { status: 502 },
    );
  }
}
