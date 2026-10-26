import { defineTool } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { probeRoutes } from "../lib/grokbot-http.js";

export default defineTool({
  description: "Unauthenticated probe of the old Grok Bot session routes. Sends no API key and no bot name.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    const routes = await probeRoutes();
    const sessionRoutes = routes.filter((route) => route.url.startsWith("https://api.cursor.com/v0/grokbot/sessions"));
    return {
      ok: sessionRoutes.length === 4 && sessionRoutes.every((route) => route.mounted),
      routes,
    };
  },
});
