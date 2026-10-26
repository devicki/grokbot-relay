import { defineAgent } from "@grok/agent-sdk";

// Harness allowlist stays empty. The only tools are the ones in bot/tools/.
export default defineAgent({
  tools: [],
});
