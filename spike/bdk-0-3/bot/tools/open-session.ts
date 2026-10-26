import { defineTool } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { GrokBotApiError, openSession } from "../lib/grokbot-http.js";

// Live get-or-create. A name that does not already exist creates an empty bot.
// The tool stays inert unless the operator exports GROKBOT_SPIKE_CONFIRM=1.
export default defineTool({
  description: "Get-or-create one named Grok Bot session on the host account. Stays inert unless the operator has armed it. Do not call this from a conversation.",
  effect: "write",
  inputSchema: z.object({
    name: z.string().min(1).max(255),
  }),
  async execute({ name }) {
    if (process.env.GROKBOT_SPIKE_CONFIRM !== "1") {
      return {
        ok: false,
        refused: true,
        reason: "GROKBOT_SPIKE_CONFIRM is not 1. POST /v0/grokbot/sessions creates a bot when the name is new.",
      };
    }
    try {
      const session = await openSession(name);
      return {
        ok: true,
        sessionId: session.sessionId,
        name: session.name,
        createdAtMs: session.createdAtMs,
        latestUpdatedSeq: session.latestUpdatedSeq,
      };
    } catch (error) {
      const message = error instanceof GrokBotApiError ? error.message : "open-session failed";
      return { ok: false, refused: false, status: error instanceof GrokBotApiError ? error.status : undefined, reason: message };
    }
  },
});
