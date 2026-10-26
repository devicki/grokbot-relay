import { defineTool } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { requireAllowlist } from "../../../lib/allowlist.js";
import { contactHostFrom } from "../../../lib/contacts.js";
import { askAgent, DEFAULT_WAIT_SECONDS, MAX_WAIT_SECONDS } from "../../../lib/conversation.js";
import { productionBackend } from "../../../lib/grokbot-http.js";
import { grokbotExtension } from "../extension.js";

const agentName = z
  .string()
  .max(255)
  .optional()
  .describe(
    "The Grok Bot agent's name, as shown in the Grok Bot app. Must be on the allowlist. Optional when exactly one bot is allowlisted.",
  );

const waitSeconds = z
  .number()
  .int()
  .min(0)
  .max(MAX_WAIT_SECONDS)
  .default(DEFAULT_WAIT_SECONDS)
  .describe(
    `How long to wait for the reply before returning status "running" (default ${DEFAULT_WAIT_SECONDS}, max ${MAX_WAIT_SECONDS}). 0 returns after one look.`,
  );

export default defineTool({
  description:
    'Send a message to one allowlisted Grok Bot agent and wait for its reply. The message lands in the account\'s own conversation with that agent. The relay prefixes [relay:claude-code]; do not add that line yourself. Long turns return status "running": call check to keep waiting. A name that does not already exist creates an empty bot.',
  effect: "write",
  needsApproval: false,
  inputSchema: z.object({
    agent: agentName,
    message: z
      .string()
      .min(1)
      .describe("What to tell or ask the agent. Self-contained: who is asking, the facts it needs, and what you want back."),
    wait_seconds: waitSeconds,
  }),
  async execute(input, ctx) {
    const agents = requireAllowlist(grokbotExtension.config.agents);
    return askAgent(
      { agent: input.agent, message: input.message, waitSeconds: input.wait_seconds },
      { backend: productionBackend(), agents, host: contactHostFrom(ctx) },
    );
  },
});
