import { defineTool } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { GrokBotApiError, openSessionWithKey, type FetchLike } from "../lib/grokbot-http.js";

const FAKE_KEY = "spike-self-check-not-a-credential";

export default defineTool({
  description: "Mock one /v0/grokbot session round-trip. Does not call the network.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    const failures: string[] = [];
    let sawAuth = false;
    let sawKeyInUrl = false;
    const fetchImpl: FetchLike = async (url, init) => {
      const href = String(url);
      sawKeyInUrl = sawKeyInUrl || href.includes(FAKE_KEY);
      const headers = new Headers(init?.headers);
      const authorization = headers.get("authorization") ?? "";
      sawAuth = authorization === `Bearer ${FAKE_KEY}`;
      if (init?.method === "POST" && href.endsWith("/v0/grokbot/sessions")) {
        return new Response(
          JSON.stringify({
            id: "ses_spike",
            name: "Example",
            createdAtMs: 1,
            latestUpdatedSeq: "0",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("missing", { status: 500 });
    };

    const session = await openSessionWithKey("Example", FAKE_KEY, {
      fetchImpl,
      baseUrl: "https://api.cursor.com",
    });
    if (session.sessionId !== "ses_spike" || session.name !== "Example" || session.latestUpdatedSeq !== "0") {
      failures.push("session fields were not parsed");
    }
    if (!sawAuth) failures.push("request did not send the bearer token");
    if (sawKeyInUrl) failures.push("key leaked into the URL");

    try {
      await openSessionWithKey("Example", "", { fetchImpl, baseUrl: "https://api.cursor.com" });
      failures.push("missing key did not throw");
    } catch (error) {
      if (!(error instanceof GrokBotApiError) || !error.message.includes("No Cursor API key")) {
        failures.push("missing key threw an unexpected error");
      }
    }

    return failures.length === 0 ? { ok: true } : { ok: false, failures };
  },
});
