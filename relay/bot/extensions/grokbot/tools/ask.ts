// Replaces grokbot__ask: same schema and behavior, but every message is
// stamped server-side with the relay sender header (see lib/sender-tag.ts).
// grokbot__ask is the only send path (check/list only read; interrupt is disabled).
import { defineTool } from "@cursor/bdk";
// The packaged tool is not exported by name, so it is loaded by file path.
// If a future @cursor/bdk moves it, this import fails and the relay refuses to
// start (fail closed) instead of sending unstamped messages.
import original from "../../../../node_modules/@cursor/bdk/dist/extensions/cursor-grokbot-agents/tools/ask.js";
import { stamp } from "../../../../lib/sender-tag";

type AskInput = { agent?: string; message: string; wait_seconds?: number };
type Executable = { execute: (input: AskInput, ctx: unknown) => Promise<unknown> };

const base = original as unknown as Record<string, unknown> & Executable;
if (typeof base.execute !== "function") {
  throw new Error("grokbot-relay: packaged grokbot__ask not found; refusing to start without the sender header.");
}

export default defineTool({
  description: base.description as string,
  effect: "write",
  needsApproval: base.needsApproval as () => boolean,
  inputSchema: base.inputSchema as never,
  async execute(input: AskInput, ctx: unknown) {
    return base.execute({ ...input, message: stamp(input.message) }, ctx);
  },
} as never);
