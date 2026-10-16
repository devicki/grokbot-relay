import { readFileSync } from "node:fs";
import cursorGrokBotAgents from "@cursor/bdk/extensions/cursor-grokbot-agents";

// The allowlist is server-local and never committed.
// Order: GROKBOT_RELAY_AGENTS (comma-separated names) > GROKBOT_RELAY_AGENTS_FILE > /etc/grokbot-relay/agents.json
// File format: see agents.example.json.
// Safe default: if nothing valid is configured, refuse to start. An empty list in
// cursor-grokbot-agents would allow ANY name, so we never pass one.

type Agent = { name: string; description?: string };

const DEFAULT_FILE = "/etc/grokbot-relay/agents.json";

function fromEnv(raw: string): Agent[] {
  return raw.split(",").map((n) => ({ name: n.trim() }));
}

function fromFile(path: string): Agent[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const data = JSON.parse(text) as { agents?: unknown };
  if (!Array.isArray(data.agents)) {
    throw new Error(`grokbot-relay: ${path} must contain {"agents": [...]}`);
  }
  return data.agents.map((a) =>
    typeof a === "string" ? { name: a } : { name: String((a as Agent).name ?? ""), description: (a as Agent).description },
  );
}

function loadAgents(): Agent[] {
  const env = process.env.GROKBOT_RELAY_AGENTS?.trim();
  const file = process.env.GROKBOT_RELAY_AGENTS_FILE?.trim() || DEFAULT_FILE;
  const raw = env ? fromEnv(env) : fromFile(file);
  const seen = new Set<string>();
  const agents = raw
    .map((a) => ({ ...a, name: a.name.trim() }))
    .filter((a) => a.name && a.name !== "*" && !seen.has(a.name) && seen.add(a.name));
  if (agents.length === 0) {
    throw new Error(
      `grokbot-relay: no agents configured. Set GROKBOT_RELAY_AGENTS or create ${file} (see agents.example.json). Refusing to start.`,
    );
  }
  return agents.map((a) => (a.description ? { name: a.name, description: a.description } : { name: a.name }));
}

export default cursorGrokBotAgents({ agents: loadAgents() });
