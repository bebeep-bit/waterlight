import sharp from "sharp";
import { callTool, str } from "@/lib/agent/mcp";

/**
 * Crops a margin off every edge of a generated frame, then re-hosts it.
 *
 * This exists because the image models keep signing their own paintings. The
 * wordless rule is not negotiable for this product, and three rounds of prompt
 * wording did not hold it: `flux-schnell` silently drops `negative_prompt`, and
 * even with an explicit "unsigned painting, all four corners are empty paper"
 * clause a signature still appeared in a corner. Prompt wording is a
 * probability; a crop is a guarantee.
 *
 * Every mark we saw sat within a few percent of an edge, along with the
 * deckled paper border — which we also do not want, since a painted border
 * animates badly. Trimming both is one operation.
 *
 * The result has to be re-hosted rather than kept local, because the
 * image-to-video capability fetches `source_url` from the public internet.
 * `upload_image` does that for free.
 */

/** Fraction taken off each edge. 5% clears corner marks without recomposing. */
const INSET = 0.05;

export async function trimEdgesAndRehost(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not read the frame back (${response.status}).`);
  }

  const original = Buffer.from(await response.arrayBuffer());
  const image = sharp(original);
  const { width, height } = await image.metadata();

  if (!width || !height) throw new Error("The frame had no readable size.");

  const dx = Math.round(width * INSET);
  const dy = Math.round(height * INSET);

  const trimmed = await sharp(original)
    .extract({
      left: dx,
      top: dy,
      width: width - dx * 2,
      height: height - dy * 2,
    })
    /* Back to the original size so the stage and the i2v stage both get the
       16:9 frame they expect. */
    .resize(width, height, { fit: "fill" })
    .jpeg({ quality: 92 })
    .toBuffer();

  const uploaded = await callTool("upload_image", {
    data: trimmed.toString("base64"),
    mime_type: "image/jpeg",
  });

  const hostedUrl = str(uploaded.structured, "url");
  if (!hostedUrl) {
    throw new Error(uploaded.text || "The trimmed frame could not be hosted.");
  }

  return hostedUrl;
}
