import { readFileSync } from "node:fs";

/**
 * Server-local allowlist. Never committed.
 *
 * Order: `GROKBOT_RELAY_AGENTS` (comma-separated names) >
 * `GROKBOT_RELAY_AGENTS_FILE` > `/etc/grokbot-relay/agents.json`.
 * File format: `agents.example.json` at the repo root.
 *
 * An empty result is not "any name". The Agent SDK 0.2.28 extension treated
 * a missing `agents` option as allow-any, and an empty array was rejected by
 * that package for the same reason. This line has no allow-any branch.
 * `loadAllowlist()` may return `[]` so `agent-sdk validate` can load on a
 * machine with no server file. `requireAllowlist()` and `resolveAgentName()`
 * throw on that empty list before any HTTP call. A name of `*` is dropped,
 * not expanded.
 */

export const DEFAULT_ALLOWLIST_FILE = "/etc/grokbot-relay/agents.json";
export const AGENT_NAME_MAX_LENGTH = 255;

export const EMPTY_ALLOWLIST_MESSAGE =
  "grokbot-relay v1: no bots are allowlisted. Set GROKBOT_RELAY_AGENTS or create the agents file (see agents.example.json). An empty allowlist does not mean any name; this call is refused.";

export type AllowlistedAgent = {
  name: string;
  description?: string;
};

export type AllowlistInput = {
  /** Unset or blank falls through to the file. A present value wins, even if every token is dropped. */
  env?: string;
  filePath?: string;
  /** Missing file returns `undefined`. */
  readFile?: (path: string) => string | undefined;
};

type RawAgent = { name: string; description?: string };

export function loadAllowlist(input?: AllowlistInput): AllowlistedAgent[] {
  const source: AllowlistInput = input ?? {
    env: process.env.GROKBOT_RELAY_AGENTS,
    filePath: process.env.GROKBOT_RELAY_AGENTS_FILE?.trim() || DEFAULT_ALLOWLIST_FILE,
    readFile: readAllowlistFile,
  };
  const env = source.env?.trim();
  const raw = env ? fromEnv(env) : fromFile(source.filePath ?? DEFAULT_ALLOWLIST_FILE, source.readFile ?? readAllowlistFile);
  return normalize(raw);
}

/** Throws when `agents` is empty. Never rewrites an empty list into "any name". */
export function requireAllowlist(agents: readonly AllowlistedAgent[]): AllowlistedAgent[] {
  if (agents.length === 0) throw new Error(EMPTY_ALLOWLIST_MESSAGE);
  return agents.map(copyAgent);
}

function copyAgent(agent: AllowlistedAgent): AllowlistedAgent {
  return agent.description ? { name: agent.name, description: agent.description } : { name: agent.name };
}

function fromEnv(raw: string): RawAgent[] {
  return raw.split(",").map((name) => ({ name }));
}

function fromFile(path: string, readFile: (path: string) => string | undefined): RawAgent[] {
  const text = readFile(path);
  if (text === undefined) return [];
  let data: { agents?: unknown };
  try {
    data = JSON.parse(text) as { agents?: unknown };
  } catch {
    throw new Error(`grokbot-relay v1: ${path} is not JSON.`);
  }
  if (!Array.isArray(data.agents)) {
    throw new Error(`grokbot-relay v1: ${path} must contain {"agents": [...]}`);
  }
  return data.agents.map((entry) => {
    if (typeof entry === "string") return { name: entry };
    if (isRecord(entry) && typeof entry.name === "string") {
      return typeof entry.description === "string"
        ? { name: entry.name, description: entry.description }
        : { name: entry.name };
    }
    throw new Error(`grokbot-relay v1: ${path} has an agent entry that is not a name or {"name": "..."}.`);
  });
}

function normalize(raw: readonly RawAgent[]): AllowlistedAgent[] {
  const seen = new Set<string>();
  const agents: AllowlistedAgent[] = [];
  for (const entry of raw) {
    const name = entry.name.trim();
    if (!name || name === "*") continue;
    if (name.length > AGENT_NAME_MAX_LENGTH) {
      throw new Error(`grokbot-relay v1: allowlist name exceeds ${AGENT_NAME_MAX_LENGTH} characters.`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      const previous = agents.find((agent) => agent.name.toLowerCase() === key);
      if (previous && previous.name !== name) {
        throw new Error(
          `grokbot-relay v1: duplicate allowlist name "${name}" (names match case-insensitively).`,
        );
      }
      continue;
    }
    seen.add(key);
    const description = entry.description?.trim();
    agents.push(description ? { name, description } : { name });
  }
  return agents;
}

function readAllowlistFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
