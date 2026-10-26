import { defineExtension } from "@grok/agent-sdk/extensions";
import * as z from "zod/v4";
import { AGENT_NAME_MAX_LENGTH, loadAllowlist } from "../../lib/allowlist.js";

/**
 * Mount for `grokbot__list`, `grokbot__ask`, and `grokbot__check`.
 * Interrupt is not a contribution. v0 removed it with `disableTool()` because
 * the stock extension shipped it; this tree never registers it.
 *
 * `agents` is the allowlist captured when the process loads. An empty array
 * is valid configuration so `validate` can load without `/etc/grokbot-relay`.
 * It is not allow-any. Every tool calls `requireAllowlist` and throws.
 */
export const grokbotExtension = defineExtension({
  root: import.meta.dirname,
  description:
    "Talk to allowlisted Grok Bot agents over /v0/grokbot. Does not import cursor-grokbot-agents. Interrupt is not provided.",
  config: z.object({
    agents: z.array(
      z.object({
        name: z.string().min(1).max(AGENT_NAME_MAX_LENGTH),
        description: z.string().optional(),
      }),
    ),
  }),
  hosting: () => ({ egressDomains: ["api.cursor.com"] }),
});

export default grokbotExtension({ agents: loadAllowlist() });
