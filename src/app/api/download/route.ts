import { NextResponse } from "next/server";
import sharp from "sharp";

/**
 * Renders come back on the agent's CDN, where a plain `download` attribute is
 * ignored cross-origin. Streaming through here sets the filename. Image saves
 * are re-encoded to PNG so the browser never gets a mislabeled .mp4.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const source = params.get("url");
  const filename = sanitizeFilename(
    params.get("filename") ?? "waterlight.bin",
  );

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
      { error: "Could not reach the media." },
      { status: 502 },
    );
  }

  const lower = filename.toLowerCase();
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    const bytes = Buffer.from(await upstream.arrayBuffer());
    try {
      const png = await sharp(bytes).png().toBuffer();
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${ensurePngName(filename)}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Could not encode the image as PNG." },
        { status: 502 },
      );
    }
  }

  const contentType =
    upstream.headers.get("content-type") ??
    (lower.endsWith(".mp4") ? "video/mp4" : "application/octet-stream");

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  return cleaned || "waterlight.bin";
}

function ensurePngName(name: string): string {
  return name.toLowerCase().endsWith(".png")
    ? name
    : `${name.replace(/\.[^.]+$/, "") || "waterlight"}.png`;
}
