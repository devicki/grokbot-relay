import { randomUUID } from "node:crypto";
import { cursorExternalApiUrl, resolveApiKeySync } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { AGENT_NAME_MAX_LENGTH } from "./allowlist.js";
import { stampRelayMessage } from "./header.js";

/**
 * HTTP client for the `/v0/grokbot` session routes that
 * `cursor-grokbot-agents` called on `https://api.cursor.com`.
 * Started from `spike/bdk-0-3/bot/lib/grokbot-http.ts`.
 *
 * Agent SDK 0.3 does not ship that extension. These routes are not a
 * documented 0.3 API. Unauthenticated calls returned 401 on 2026-10-26.
 *
 * `POST …/interrupt` is intentionally not wrapped. v1 does not stop a turn.
 * Every `send` stamps `[relay:claude-code]` onto the message text.
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

export type GrokBotEntry = {
  seq: string;
  updatedSeq: string;
  kind: string;
  role?: string;
  text?: string;
  createdAtMs: number;
};

export type GrokBotTurnStatus = {
  idle: boolean;
  inFlight: boolean;
  queued: number;
};

export type GrokBotEntriesPage = {
  entries: GrokBotEntry[];
  latestUpdatedSeq: string;
  turn: GrokBotTurnStatus;
};

export type AcceptedDelivery = "accepted_temporal" | "duplicate";

export type GrokBotBackend = {
  session(name: string): Promise<GrokBotSession>;
  /** `text` is the caller's message. The POST body is the stamped text. */
  send(sessionId: string, text: string): Promise<void>;
  entries(sessionId: string, afterUpdatedSeq: string): Promise<GrokBotEntriesPage>;
};

const sessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAtMs: z.number(),
  latestUpdatedSeq: z.string(),
});

const sendSchema = z.object({
  messageId: z.string(),
  delivery: z.string(),
});

const entriesSchema = z.object({
  entries: z.array(
    z.object({
      seq: z.string(),
      updatedSeq: z.string(),
      kind: z.string(),
      role: z.string().optional(),
      text: z.string().optional(),
      createdAtMs: z.number(),
    }),
  ),
  latestUpdatedSeq: z.string(),
  turn: z.object({
    idle: z.boolean(),
    inFlight: z.boolean(),
    queued: z.number(),
  }),
});

const REQUEST_TIMEOUT_MS = 60_000;

export function isAcceptedDelivery(delivery: string): delivery is AcceptedDelivery {
  return delivery === "accepted_temporal" || delivery === "duplicate";
}

export function parseSessionJson(text: string): GrokBotSession {
  const parsed = parseWith(sessionSchema, text, "POST /v0/grokbot/sessions");
  return {
    sessionId: parsed.id,
    name: parsed.name,
    createdAtMs: parsed.createdAtMs,
    latestUpdatedSeq: parsed.latestUpdatedSeq,
  };
}

export function parseSendJson(text: string): { messageId: string; delivery: string } {
  return parseWith(sendSchema, text, "POST /v0/grokbot/sessions/:id/messages");
}

export function parseEntriesJson(text: string): GrokBotEntriesPage {
  return parseWith(entriesSchema, text, "GET /v0/grokbot/sessions/:id/entries");
}

export type HttpBackendOptions = {
  apiKey: string | (() => string);
  fetchImpl?: FetchLike;
  baseUrl?: string;
};

export function createHttpBackend(options: HttpBackendOptions): GrokBotBackend {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = () => (options.baseUrl ?? cursorExternalApiUrl()).replace(/\/$/, "");
  const apiKey = () => {
    const key = typeof options.apiKey === "function" ? options.apiKey() : options.apiKey;
    if (!key) throw new GrokBotApiError("No Cursor API key. Run agent-sdk login, or set CURSOR_API_KEY.");
    return key;
  };

  return {
    async session(name: string): Promise<GrokBotSession> {
      const trimmed = assertBotName(name);
      const text = await request(fetchImpl, apiKey(), base(), "POST", "/v0/grokbot/sessions", { name: trimmed });
      return parseSessionJson(text);
    },
    async send(sessionId: string, text: string): Promise<void> {
      const bodyText = stampRelayMessage(text);
      const raw = await request(fetchImpl, apiKey(), base(), "POST", `/v0/grokbot/sessions/${encodeURIComponent(sessionId)}/messages`, {
        text: bodyText,
        messageId: randomUUID(),
      });
      const parsed = parseSendJson(raw);
      if (!isAcceptedDelivery(parsed.delivery)) {
        throw new GrokBotApiError(
          `The Grok Bot agent's harness did not accept the message (delivery: ${parsed.delivery}).`,
        );
      }
    },
    async entries(sessionId: string, afterUpdatedSeq: string): Promise<GrokBotEntriesPage> {
      const path = `/v0/grokbot/sessions/${encodeURIComponent(sessionId)}/entries?afterUpdatedSeq=${encodeURIComponent(afterUpdatedSeq)}`;
      const text = await request(fetchImpl, apiKey(), base(), "GET", path);
      return parseEntriesJson(text);
    },
  };
}

/** Key resolved on each call so a login after process start is visible. */
export function productionBackend(): GrokBotBackend {
  return createHttpBackend({
    apiKey: () => {
      const resolved = resolveApiKeySync();
      if (!resolved?.apiKey) {
        throw new GrokBotApiError("No Cursor API key. Run agent-sdk login, or set CURSOR_API_KEY.");
      }
      return resolved.apiKey;
    },
  });
}

function assertBotName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "*" || trimmed.length > AGENT_NAME_MAX_LENGTH) {
    throw new GrokBotApiError("Refusing an empty, wildcard, or oversized Grok Bot name.");
  }
  return trimmed;
}

async function request(
  fetchImpl: FetchLike,
  apiKey: string,
  base: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "x-cursor-client-type": "agent-serve",
    "x-request-id": randomUUID(),
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrokBotApiError(`Grok Bot API ${method} ${path} failed: ${message}`);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new GrokBotApiError(
      `Grok Bot API ${method} ${path} failed (${response.status}): ${errorText(text)}`,
      response.status,
    );
  }
  return text;
}

function parseWith<T>(schema: z.ZodType<T>, text: string, label: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GrokBotApiError(`${label} returned non-JSON.`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new GrokBotApiError(`${label} returned an unexpected shape.`);
  return result.data;
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
