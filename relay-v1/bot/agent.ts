import { defineAgent } from "@grok/agent-sdk";

// Empty harness allowlist: the only tools are the grokbot extension's.
export default defineAgent({
  tools: [],
});
