import { defineTool } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { requireAllowlist } from "../../../lib/allowlist.js";
import { contactHostFrom, listContacts, listPayload } from "../../../lib/contacts.js";
import { grokbotExtension } from "../extension.js";

export default defineTool({
  description:
    "List the Grok Bot agents you can talk to: the allowlist configured for this relay, with what each is for, and the ones you have already asked, most recent first. This is not a list of every bot on the Cursor account.",
  effect: "read",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const agents = requireAllowlist(grokbotExtension.config.agents);
    const contacts = await listContacts(contactHostFrom(ctx));
    return listPayload(agents, contacts);
  },
});
