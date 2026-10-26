import { EMPTY_ALLOWLIST_MESSAGE, type AllowlistedAgent } from "./allowlist.js";

/**
 * Which configured bot a call addresses. There is no "agents omitted means
 * any name" branch. An empty list throws. Matching is case-insensitive and
 * returns the allowlist spelling, because the session route looks names up
 * exactly. A single configured bot is the default when the call names none.
 */
export function resolveAgentName(requested: string | undefined, configured: readonly AllowlistedAgent[]): string {
  if (configured.length === 0) throw new Error(EMPTY_ALLOWLIST_MESSAGE);
  const name = requested?.trim();
  const names = configured.map((agent) => `"${agent.name}"`).join(", ");
  if (name === undefined || name === "") {
    const only = configured.length === 1 ? configured[0] : undefined;
    if (only === undefined) {
      throw new Error(`\`agent\` is required: this relay allowlists several Grok Bot agents (${names}).`);
    }
    return only.name;
  }
  if (name === "*") {
    throw new Error(`"*" is not an allowlist entry. An empty or wildcard list does not mean any name. Configured: ${names}.`);
  }
  const match =
    configured.find((agent) => agent.name === name) ??
    configured.find((agent) => agent.name.toLowerCase() === name.toLowerCase());
  if (match === undefined) {
    throw new Error(`"${name}" is not on this relay's allowlist (${names}).`);
  }
  return match.name;
}
