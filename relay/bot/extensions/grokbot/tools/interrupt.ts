// Removes grokbot__interrupt: external callers must not stop a bot's turn.
import { disableTool } from "@cursor/bdk/extensions";

export default disableTool();
