import { randomUUID } from "node:crypto";
import { cursorExternalApiUrl, resolveApiKeySync } from "@grok/agent-sdk";

/**
 * Thin client for the four `/v0/grokbot` routes that
 * `@cursor/bdk@0.2.28` `cursor-grokbot-agents` called on
 * `https://api.cursor.com`. Agent SDK 0.3.0 no longer ships that extension.
 * These routes are not a documented 0.3 API. They were still mounted when
 * this spike was written: unauthenticated calls returned 401, not 404.
 */

export class GrokBotApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GrokBotApiError";
    this.status = status;
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type GrokBotSession = {
  sessionId: string;
  name: string;
  createdAtMs: number;
  latestUpdatedSeq: string;
};

export type RouteProbe = {
  method: string;
  url: string;
  status: number;
  /** 401 means the route is mounted and rejected the missing key. 404 means it is gone. */
  mounted: boolean;
};

const DEFAULT_EXTERNAL = "https://api.cursor.com";
const DEFAULT_BACKEND = "https://api2.cursor.sh";

type ProbeSpec = { method: string; url: string; body?: unknown };

/** Public, unauthenticated probes. They send no API key and no bot name. */
export function probeSpecs(external = DEFAULT_EXTERNAL, backend = DEFAULT_BACKEND): ProbeSpec[] {
  const missing = "not-a-real-session";
  return [
    { method: "POST", url: `${external}/v0/grokbot/sessions`, body: {} },
    { method: "GET", url: `${external}/v0/grokbot/sessions/${missing}/entries?afterUpdatedSeq=0` },
    { method: "POST", url: `${external}/v0/grokbot/sessions/${missing}/messages`, body: {} },
    { method: "POST", url: `${external}/v0/grokbot/sessions/${missing}/interrupt`, body: {} },
    { method: "GET", url: `${external}/v0/grokbot` },
    { method: "GET", url: `${external}/v0/grokbot/agents` },
    { method: "GET", url: `${backend}/v0/grokbot/sessions` },
  ];
}

export async function probeRoutes(fetchImpl: FetchLike = fetch): Promise<RouteProbe[]> {
  const out: RouteProbe[] = [];
  for (const spec of probeSpecs()) {
    const response = await fetchImpl(spec.url, {
      method: spec.method,
      headers: {
        "content-type": "application/json",
        "x-cursor-client-type": "agent-serve",
      },
      body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
    });
    await response.text();
    out.push({
      method: spec.method,
      url: spec.url,
      status: response.status,
      mounted: response.status === 401,
    });
  }
  return out;
}

export async function openSession(
  name: string,
  options?: { fetchImpl?: FetchLike; apiKey?: string; baseUrl?: string },
): Promise<GrokBotSession> {
  const resolved = options?.apiKey
    ? { apiKey: options.apiKey }
    : resolveApiKeySync();
  if (!resolved?.apiKey) {
    throw new GrokBotApiError("No Cursor API key. Run agent-sdk login, or set CURSOR_API_KEY.");
  }
  return openSessionWithKey(name, resolved.apiKey, options);
}

/** Same POST as {@link openSession}, with the key supplied by the caller. */
export async function openSessionWithKey(
  name: string,
  apiKey: string,
  options?: { fetchImpl?: FetchLike; baseUrl?: string },
): Promise<GrokBotSession> {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "*" || trimmed.length > 255) {
    throw new GrokBotApiError("Refusing an empty, wildcard, or oversized Grok Bot name.");
  }
  if (!apiKey) {
    throw new GrokBotApiError("No Cursor API key. Run agent-sdk login, or set CURSOR_API_KEY.");
  }
  const base = (options?.baseUrl ?? cursorExternalApiUrl()).replace(/\/$/, "");
  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl(`${base}/v0/grokbot/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "x-cursor-client-type": "agent-serve",
      "x-request-id": randomUUID(),
    },
    body: JSON.stringify({ name: trimmed }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new GrokBotApiError(`POST /v0/grokbot/sessions failed (${response.status}): ${errorText(text)}`, response.status);
  }
  return parseSession(text);
}

function parseSession(text: string): GrokBotSession {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GrokBotApiError("POST /v0/grokbot/sessions returned non-JSON.");
  }
  if (!isRecord(parsed) || typeof parsed.id !== "string" || typeof parsed.name !== "string" || typeof parsed.createdAtMs !== "number" || typeof parsed.latestUpdatedSeq !== "string") {
    throw new GrokBotApiError("POST /v0/grokbot/sessions returned an unexpected session shape.");
  }
  return {
    sessionId: parsed.id,
    name: parsed.name,
    createdAtMs: parsed.createdAtMs,
    latestUpdatedSeq: parsed.latestUpdatedSeq,
  };
}

function errorText(text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown };
    const message = parsed.message ?? parsed.error;
    if (typeof message === "string" && message !== "") return message.slice(0, 300);
  } catch {
    // Fall through to the raw body.
  }
  return text.slice(0, 300);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
