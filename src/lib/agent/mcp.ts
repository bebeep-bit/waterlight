/**
 * Minimal MCP client for Livepeer Agent's raw surface.
 *
 * The endpoint speaks JSON-RPC over a single HTTP POST, so we do not need a
 * full MCP SDK or a persistent session — one fetch per tool call is the whole
 * protocol.
 *
 * Hackathon / creative harness (default): `/api/mcp/creative` — each registered
 * hacker gets a $100 balance that re-ups every 24h, with a pre-run cost estimate.
 * Daydream `sk_` keys are not used on this surface.
 */

const ENDPOINT =
  process.env.LIVEPEER_AGENT_URL ??
  "https://agent.livepeer.org/api/mcp/creative";

/** How many times to retry a dropped connection to the agent. */
const NETWORK_RETRIES = 2;

export interface ToolResult {
  /** The agent's own human-readable line. We show this, never raw JSON. */
  text: string;
  /** Parsed `structuredContent`, where urls and costs live. */
  structured: Record<string, unknown> | null;
  /** Provider-level warnings, e.g. a param the capability will ignore. */
  warnings: string[];
}

export class AgentError extends Error {}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      return await callToolOnce(name, args, signal);
    } catch (error) {
      lastError = error;
      if (!isTransientNetwork(error) || attempt === NETWORK_RETRIES) break;
      await sleep(400 * (attempt + 1));
    }
  }
  throw wrapNetworkError(lastError);
}

async function callToolOnce(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  /* Hackathon creative MCP is keyless-by-connection: do not send Daydream
     `sk_` Authorization headers (they 401 on Agent). */

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      signal,
      cache: "no-store",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
  } catch (error) {
    throw wrapNetworkError(error);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.text();
      const parsed = JSON.parse(errBody) as {
        error?: { message?: string };
      };
      detail = parsed.error?.message ?? "";
    } catch {
      /* ignore parse failures */
    }
    if (response.status === 401) {
      throw new AgentError(
        detail.includes("no longer accepted") || detail.includes("keyless")
          ? "Livepeer Agent is running keyless right now. Restart the app (`npm run dev`) and try Paint again."
          : "Livepeer Agent returned 401. Restart the app and try Paint again.",
      );
    }
    throw new AgentError(
      detail
        ? `Livepeer Agent returned ${response.status}: ${detail}`
        : `Livepeer Agent returned ${response.status}.`,
    );
  }

  const body = await response.text();
  if (!body) throw new AgentError("Livepeer Agent returned an empty response.");

  let envelope: {
    result?: {
      content?: Array<{ type: string; text?: string }>;
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };
    error?: { message?: string };
  };
  try {
    envelope = JSON.parse(body);
  } catch {
    throw new AgentError("Livepeer Agent returned a malformed response.");
  }

  if (envelope.error) {
    throw new AgentError(envelope.error.message ?? "Livepeer Agent failed.");
  }

  const result = envelope.result;
  const text =
    result?.content
      ?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  const structured = result?.structuredContent ?? null;

  /* The raw surface reports a refusal as an ok:false payload rather than a
     transport error, and the text explains why in plain language. */
  if (result?.isError || (structured && structured.ok === false)) {
    throw new AgentError(text || "Livepeer Agent refused the call.");
  }

  const warnings = Array.isArray(structured?.warnings)
    ? (structured.warnings as Array<{ message?: string }>)
        .map((w) => w.message ?? "")
        .filter(Boolean)
    : [];

  return { text, structured, warnings };
}

function isTransientNetwork(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const cause =
    error.cause instanceof Error ? error.cause.message.toLowerCase() : "";
  const blob = `${message} ${cause}`;
  return (
    blob.includes("fetch failed") ||
    blob.includes("network") ||
    blob.includes("econnreset") ||
    blob.includes("econnrefused") ||
    blob.includes("etimedout") ||
    blob.includes("socket") ||
    blob.includes("could not reach")
  );
}

function wrapNetworkError(error: unknown): AgentError {
  if (error instanceof AgentError) return error;
  if (isTransientNetwork(error)) {
    return new AgentError(
      "Could not reach Livepeer Agent. Check the network or proxy, then try again.",
    );
  }
  return new AgentError(
    error instanceof Error ? error.message : "Livepeer Agent failed.",
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Narrow helpers, so callers are not littered with casts. */
export function str(
  source: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = source?.[key];
  return typeof value === "string" && value ? value : null;
}

export function num(
  source: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
