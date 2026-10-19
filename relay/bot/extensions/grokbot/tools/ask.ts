// Replaces grokbot__ask to prepend a fixed sender header, so the receiving bot
// can tell relayed messages from the owner typing in the app.
// grokbot__ask is the only send path (check/list only read; interrupt is disabled).
// The packaged tool is not exported by name, so it is imported by file path. If an
// @cursor/bdk upgrade moves it, grokbot-relay install/update/bdk-upgrade set this
// file aside so the stock ask tool is used (no header) and doctor shows a warning.
import { defineTool } from "@cursor/bdk";
import stock from "../../../../node_modules/@cursor/bdk/dist/extensions/cursor-grokbot-agents/tools/ask.js";

const HEADER = "[relay:claude-code]\nSent via grokbot-relay by the owner's tool, not typed by the owner.\n\n";

type AskInput = { agent?: string; message: string; wait_seconds?: number };
const base = stock as unknown as Record<string, unknown> & {
  execute: (input: AskInput, ctx: unknown) => Promise<unknown>;
};

export default defineTool({
  description: base.description as string,
  effect: "write",
  needsApproval: base.needsApproval as () => boolean,
  inputSchema: base.inputSchema as never,
  async execute(input: AskInput, ctx: unknown) {
    return base.execute({ ...input, message: HEADER + input.message }, ctx);
  },
} as never);
