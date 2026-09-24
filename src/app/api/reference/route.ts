import { NextResponse } from "next/server";
import { AgentError, callTool, str } from "@/lib/agent/mcp";

/** Upload a reference plate to Livepeer storage for cast / edit. */
export const maxDuration = 60;

const MAX_BYTES = 10_000_000; /* 10 MB — uses signed PUT, not inline base64 */

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a JPEG or PNG." }, { status: 400 });
  }

  const mime = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG or WebP references are accepted." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Reference image must be under 10 MB." },
      { status: 400 },
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());

    /* Signed PUT — inline base64 on `upload` truncates around ~3 MB. */
    const ticket = await callTool("create_upload_url", {
      content_type: mime,
      kind: "image",
      filename: file.name || "reference.png",
      size: bytes.length,
    });

    const uploadUrl = str(ticket.structured, "upload_url");
    const publicUrl = str(ticket.structured, "public_url");
    if (!uploadUrl || !publicUrl) {
      throw new AgentError(
        ticket.text || "Livepeer did not return an upload URL.",
      );
    }

    const putHeaders: Record<string, string> = {
      "Content-Type": mime,
    };
    const rawHeaders = ticket.structured?.headers;
    if (rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)) {
      for (const [key, value] of Object.entries(
        rawHeaders as Record<string, unknown>,
      )) {
        if (typeof value === "string") putHeaders[key] = value;
      }
    }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: putHeaders,
      body: bytes,
      cache: "no-store",
    });
    if (!put.ok) {
      throw new AgentError(
        `Could not store the reference (${put.status}). Try a smaller file.`,
      );
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not upload the reference.",
      },
      { status: 502 },
    );
  }
}
