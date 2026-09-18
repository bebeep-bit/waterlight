import { NextResponse } from "next/server";

/**
 * Renders come back on the agent's own CDN, where a plain `download` attribute
 * is ignored cross-origin. Streaming through here lets us set the filename and
 * force a save rather than opening a new tab.
 */
export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");
  if (!source) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(source);
  } catch {
    return NextResponse.json({ error: "Malformed url." }, { status: 400 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "Unsupported protocol." }, { status: 400 });
  }

  const upstream = await fetch(target, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Could not reach the film." },
      { status: 502 },
    );
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      "Content-Disposition": 'attachment; filename="the-last-color.mp4"',
      "Cache-Control": "no-store",
    },
  });
}
