import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fitBytesToAspect, fitReferenceToAspect } from "@/lib/agent/fit-reference";
import type { AspectId } from "@/lib/aspect";

/**
 * Default style plate so Paint without a user reference still lands in the
 * soft pastel ink-and-wash look. Cached per aspect after the first fit+upload
 * this process — cast inherits plate ratio, so each picker format needs its
 * own framed plate.
 *
 * Override with HOUSE_STYLE_URL (https). Set HOUSE_STYLE=0 to disable and use
 * plain flux-dev.
 */

type Cache = {
  byAspect: Partial<Record<AspectId, string>>;
  loading: Partial<Record<AspectId, Promise<string | null>>>;
};

const cache: Cache = ((
  globalThis as { __waterlightHouseStyleV3?: Cache }
).__waterlightHouseStyleV3 ??= { byAspect: {}, loading: {} });

export async function houseStyleUrl(
  aspectId: AspectId,
): Promise<string | null> {
  if (process.env.HOUSE_STYLE === "0") return null;

  const hit = cache.byAspect[aspectId];
  if (hit) return hit;

  const pending = cache.loading[aspectId];
  if (pending) return pending;

  const job = resolveForAspect(aspectId)
    .then((url) => {
      if (url) cache.byAspect[aspectId] = url;
      return url;
    })
    .finally(() => {
      delete cache.loading[aspectId];
    });

  cache.loading[aspectId] = job;
  return job;
}

async function resolveForAspect(aspectId: AspectId): Promise<string | null> {
  const fromEnv = process.env.HOUSE_STYLE_URL?.trim();
  if (fromEnv) {
    return fitReferenceToAspect(fromEnv, aspectId);
  }

  const path = join(process.cwd(), "public", "house-style.jpg");
  if (!existsSync(path)) return null;

  return fitBytesToAspect(readFileSync(path), aspectId);
}
