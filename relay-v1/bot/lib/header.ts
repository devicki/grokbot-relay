/**
 * Same bytes the v0 ask overlay prepends. Applied inside the HTTP send so
 * every `POST …/messages` body carries it, including a message that already
 * contains the marker.
 */
export const RELAY_SENDER_HEADER =
  "[relay:claude-code]\nSent via grokbot-relay by the owner's tool, not typed by the owner.\n\n";

export function stampRelayMessage(text: string): string {
  return RELAY_SENDER_HEADER + text;
}
