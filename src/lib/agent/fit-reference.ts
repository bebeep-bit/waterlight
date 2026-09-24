import sharp from "sharp";
import { AgentError, callTool, str } from "@/lib/agent/mcp";
import { canvasSize, type AspectId } from "@/lib/aspect";

/**
 * kontext-edit (cast) inherits the reference plate's aspect and ignores
 * aspect_ratio. Crop the plate to the picker canvas before cast. A letterbox
 * of cream paper is painted back as empty side bars, so the reference's own
 * ratio shows up in the finished still.
 */

export async function fitReferenceToAspect(
  sourceUrl: string,
  aspectId: AspectId,
): Promise<string> {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new AgentError(
      `Could not read the style plate (${response.status}).`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return hostFittedBytes(bytes, aspectId);
}

/**
 * One picture: the object plate keeps its shapes, and the style plate lends
 * its colour and a soft wash. Livepeer accepts a single reference, so the
 * style must already be on the objects — a second picture in the frame gets
 * painted back as a split.
 */
export async function paintStyleOntoObject(
  objectUrl: string,
  styleUrl: string,
  aspectId: AspectId,
): Promise<string> {
  const [objectRes, styleRes] = await Promise.all([
    fetch(objectUrl, { cache: "no-store" }),
    fetch(styleUrl, { cache: "no-store" }),
  ]);
  if (!objectRes.ok || !styleRes.ok) {
    throw new AgentError("Could not read both reference plates.");
  }
  const [objectBytes, styleBytes] = await Promise.all([
    objectRes.arrayBuffer().then((buf) => Buffer.from(buf)),
    styleRes.arrayBuffer().then((buf) => Buffer.from(buf)),
  ]);
  const { width, height } = canvasSize(aspectId);
  const scene = await sharp(objectBytes)
    .resize(width, height, { fit: "cover", position: "centre" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const pigment = await sharp(styleBytes)
    .resize(width, height, { fit: "cover", position: "centre" })
    .blur(32)
    .removeAlpha()
    .raw()
    .toBuffer();
  const painted = transferPigment(scene, pigment, width, height);
  const jpeg = await sharp(painted, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
  return hostJpeg(jpeg, aspectId);
}

/** Keep the object's shapes. Take hue and saturation from the style plate. */
function transferPigment(
  scene: Buffer,
  pigment: Buffer,
  width: number,
  height: number,
): Buffer {
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const o = i * 3;
    const objectL = luminance(scene[o], scene[o + 1], scene[o + 2]);
    const [hue, sat] = hueSat(pigment[o], pigment[o + 1], pigment[o + 2]);
    const [r, g, b] = hslToRgb(hue, Math.min(0.85, sat * 1.15), objectL);
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
  }
  return out;
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function hueSat(r: number, g: number, b: number): [number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  const light = (max + min) / 2;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  return [hue, sat];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [
    Math.round(Math.min(1, Math.max(0, f(0))) * 255),
    Math.round(Math.min(1, Math.max(0, f(8))) * 255),
    Math.round(Math.min(1, Math.max(0, f(4))) * 255),
  ];
}

export async function fitBytesToAspect(
  bytes: Buffer,
  aspectId: AspectId,
): Promise<string> {
  return hostFittedBytes(bytes, aspectId);
}

async function hostFittedBytes(
  bytes: Buffer,
  aspectId: AspectId,
): Promise<string> {
  const { width, height } = canvasSize(aspectId);

  const fitted = await sharp(bytes)
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92 })
    .toBuffer();

  return hostJpeg(fitted, aspectId);
}

async function hostJpeg(fitted: Buffer, aspectId: AspectId): Promise<string> {
  const ticket = await callTool("create_upload_url", {
    content_type: "image/jpeg",
    kind: "image",
    filename: `ref-${aspectId}.jpg`,
    size: fitted.length,
  });

  const uploadUrl = str(ticket.structured, "upload_url");
  const publicUrl = str(ticket.structured, "public_url");
  if (!uploadUrl || !publicUrl) {
    throw new AgentError(
      ticket.text || "Could not prepare the framed style plate.",
    );
  }

  const headers: Record<string, string> = { "Content-Type": "image/jpeg" };
  const raw = ticket.structured?.headers;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") headers[key] = value;
    }
  }

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: fitted,
    cache: "no-store",
  });
  if (!put.ok) {
    throw new AgentError(
      `Could not host the framed style plate (${put.status}).`,
    );
  }

  return publicUrl;
}
