import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callTool, str } from "@/lib/agent/mcp";
import { canvasSize, type AspectId } from "@/lib/aspect";

/**
 * ltx-i2v often returns 16:9. Crop the clip to the still's ratio so it
 * fills the same frame. Do not inset it over the painting.
 */
export async function fitFilmToAspect(
  sourceUrl: string,
  aspectId: AspectId,
  _posterUrl?: string,
): Promise<string> {
  const ffmpegPath = resolveFfmpeg();
  if (!ffmpegPath) {
    console.error("waterlight: ffmpeg binary missing, film left at provider ratio");
    return sourceUrl;
  }

  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) return sourceUrl;

  const dir = await mkdtemp(join(tmpdir(), "waterlight-film-"));
  const input = join(dir, "in.mp4");
  const output = join(dir, "out.mp4");

  try {
    await writeFile(input, Buffer.from(await response.arrayBuffer()));
    const target = evenCanvas(aspectId);
    console.info(
      "waterlight: cropping film to",
      aspectId,
      `${target.width}x${target.height}`,
    );

    await run(ffmpegPath, [
      "-y",
      "-i",
      input,
      "-vf",
      `scale=${target.width}:${target.height}:force_original_aspect_ratio=increase,crop=${target.width}:${target.height},setsar=1`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      output,
    ]);

    const bytes = await readFile(output);
    const hosted = await hostVideo(bytes);
    if (!hosted) {
      console.error("waterlight: cropped film could not be hosted");
      return sourceUrl;
    }
    return hosted;
  } catch (error) {
    console.error(
      "waterlight: film crop failed",
      error instanceof Error ? error.message : error,
    );
    return sourceUrl;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function resolveFfmpeg(): string | null {
  const bundled = join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
  if (existsSync(bundled)) return bundled;
  return null;
}

function evenCanvas(aspectId: AspectId): { width: number; height: number } {
  const { width, height } = canvasSize(aspectId);
  return {
    width: width - (width % 2),
    height: height - (height % 2),
  };
}

async function hostVideo(bytes: Buffer): Promise<string | null> {
  const ticket = await callTool("create_upload_url", {
    content_type: "video/mp4",
    kind: "video",
    filename: "waterlight.mp4",
    size: bytes.length,
  });

  const uploadUrl = str(ticket.structured, "upload_url");
  const publicUrl = str(ticket.structured, "public_url");
  if (!uploadUrl || !publicUrl) return null;

  const headers: Record<string, string> = { "Content-Type": "video/mp4" };
  const raw = ticket.structured?.headers;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") headers[key] = value;
    }
  }

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: bytes,
    cache: "no-store",
  });
  if (!put.ok) return null;
  return publicUrl;
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-500) || `${command} failed`));
    });
  });
}

