/**
 * Minimal MCP client for Livepeer Agent's raw surface.
 *
 * The endpoint speaks JSON-RPC over a single HTTP POST, so we do not need a
 * full MCP SDK or a persistent session — one fetch per tool call is the whole
 * protocol. Leaving `LIVEPEER_AGENT_KEY` unset uses the keyless demo credit.
 */

const ENDPOINT =
  process.env.LIVEPEER_AGENT_URL ?? "https://agent.livepeer.org/api/mcp";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  const key = process.env.LIVEPEER_AGENT_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(ENDPOINT, {
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

  if (!response.ok) {
    throw new AgentError(`Livepeer Agent returned ${response.status}.`);
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
