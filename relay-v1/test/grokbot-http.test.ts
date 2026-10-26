import assert from "node:assert/strict";
import { test } from "node:test";
import { RELAY_SENDER_HEADER } from "../bot/lib/header.js";
import {
  createHttpBackend,
  GrokBotApiError,
  isAcceptedDelivery,
  parseEntriesJson,
  parseSendJson,
  parseSessionJson,
  type FetchLike,
} from "../bot/lib/grokbot-http.js";

const KEY = "self-check-not-a-credential";

test("session JSON parses id, name, createdAtMs, and latestUpdatedSeq", () => {
  const session = parseSessionJson(
    JSON.stringify({
      id: "ses_self_check",
      name: "Example",
      createdAtMs: 1,
      latestUpdatedSeq: "0",
    }),
  );
  assert.deepEqual(session, {
    sessionId: "ses_self_check",
    name: "Example",
    createdAtMs: 1,
    latestUpdatedSeq: "0",
  });
});

test("session JSON rejects a non-string id and non-JSON", () => {
  assert.throws(
    () => parseSessionJson(JSON.stringify({ id: 15100626, name: "Example", createdAtMs: 1, latestUpdatedSeq: "0" })),
    (error: unknown) => error instanceof GrokBotApiError && error.message.includes("unexpected shape"),
  );
  assert.throws(
    () => parseSessionJson("not-json"),
    (error: unknown) => error instanceof GrokBotApiError && error.message.includes("non-JSON"),
  );
});

test("delivery accepted_temporal and duplicate are accepted; anything else is not", () => {
  assert.equal(isAcceptedDelivery("accepted_temporal"), true);
  assert.equal(isAcceptedDelivery("duplicate"), true);
  assert.equal(isAcceptedDelivery("rejected"), false);
  const accepted = parseSendJson(JSON.stringify({ messageId: "m1", delivery: "accepted_temporal" }));
  const duplicate = parseSendJson(JSON.stringify({ messageId: "m1", delivery: "duplicate" }));
  assert.equal(accepted.delivery, "accepted_temporal");
  assert.equal(duplicate.delivery, "duplicate");
  assert.throws(
    () => parseSendJson(JSON.stringify({ messageId: "m1" })),
    (error: unknown) => error instanceof GrokBotApiError && error.message.includes("unexpected shape"),
  );
});

test("entries JSON parses the page the ask loop reads", () => {
  const page = parseEntriesJson(
    JSON.stringify({
      entries: [
        { seq: "1", updatedSeq: "1", kind: "send-message", role: "assistant", text: "hello", createdAtMs: 2 },
        { seq: "2", updatedSeq: "2", kind: "tool", createdAtMs: 3 },
      ],
      latestUpdatedSeq: "2",
      turn: { idle: true, inFlight: false, queued: 0 },
    }),
  );
  assert.equal(page.entries.length, 2);
  assert.equal(page.entries[0]?.text, "hello");
  assert.equal(page.latestUpdatedSeq, "2");
  assert.equal(page.turn.idle, true);
});

test("send stamps the relay header and treats accepted_temporal and duplicate as success", async () => {
  for (const delivery of ["accepted_temporal", "duplicate"] as const) {
    const seen: { url?: string; authorization?: string; text?: string; keyInUrl?: boolean } = {};
    const fetchImpl: FetchLike = async (url, init) => {
      const href = String(url);
      seen.url = href;
      seen.keyInUrl = href.includes(KEY);
      seen.authorization = new Headers(init?.headers).get("authorization") ?? "";
      seen.text = JSON.parse(String(init?.body)).text;
      return new Response(JSON.stringify({ messageId: "m1", delivery }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const backend = createHttpBackend({ apiKey: KEY, fetchImpl, baseUrl: "https://api.cursor.com" });
    await backend.send("ses_self_check", "hello from the tool");
    assert.equal(seen.authorization, `Bearer ${KEY}`);
    assert.equal(seen.keyInUrl, false);
    assert.equal(seen.url, "https://api.cursor.com/v0/grokbot/sessions/ses_self_check/messages");
    assert.equal(seen.text, `${RELAY_SENDER_HEADER}hello from the tool`);
    assert.ok(seen.text?.startsWith("[relay:claude-code]\n"));
  }
});

test("send rejects a delivery other than accepted_temporal or duplicate", async () => {
  const fetchImpl: FetchLike = async () =>
    new Response(JSON.stringify({ messageId: "m1", delivery: "rejected" }), { status: 200 });
  const backend = createHttpBackend({ apiKey: KEY, fetchImpl, baseUrl: "https://api.cursor.com" });
  await assert.rejects(
    () => backend.send("ses", "hello"),
    (error: unknown) => error instanceof GrokBotApiError && error.message.includes("delivery: rejected"),
  );
});

test("a stamped message is stamped again", async () => {
  let text = "";
  const fetchImpl: FetchLike = async (_url, init) => {
    text = JSON.parse(String(init?.body)).text;
    return new Response(JSON.stringify({ messageId: "m1", delivery: "accepted_temporal" }), { status: 200 });
  };
  const backend = createHttpBackend({ apiKey: KEY, fetchImpl, baseUrl: "https://api.cursor.com" });
  await backend.send("ses", "[relay:claude-code]\nalready");
  assert.equal(text, `${RELAY_SENDER_HEADER}[relay:claude-code]\nalready`);
});

test("session open sends the bearer token as a header and parses the body", async () => {
  let authorization = "";
  let keyInUrl = false;
  const fetchImpl: FetchLike = async (url, init) => {
    keyInUrl = String(url).includes(KEY);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(
      JSON.stringify({ id: "ses_self_check", name: "Example", createdAtMs: 1, latestUpdatedSeq: "0" }),
      { status: 200 },
    );
  };
  const backend = createHttpBackend({ apiKey: KEY, fetchImpl, baseUrl: "https://api.cursor.com/" });
  const session = await backend.session("Example");
  assert.equal(session.sessionId, "ses_self_check");
  assert.equal(authorization, `Bearer ${KEY}`);
  assert.equal(keyInUrl, false);
});

test("missing key and HTTP 401 throw, and the key is not copied into the error", async () => {
  const backend = createHttpBackend({
    apiKey: "",
    fetchImpl: async () => new Response("no", { status: 500 }),
    baseUrl: "https://api.cursor.com",
  });
  await assert.rejects(
    () => backend.session("Example"),
    (error: unknown) => error instanceof GrokBotApiError && error.message.includes("No Cursor API key"),
  );

  const denied = createHttpBackend({
    apiKey: KEY,
    fetchImpl: async () => new Response(JSON.stringify({ error: "Invalid User API Key" }), { status: 401 }),
    baseUrl: "https://api.cursor.com",
  });
  await assert.rejects(
    () => denied.session("Example"),
    (error: unknown) => {
      assert.ok(error instanceof GrokBotApiError);
      assert.equal(error.status, 401);
      assert.equal(error.message.includes(KEY), false);
      assert.match(error.message, /Invalid User API Key/);
      return true;
    },
  );
});

test("wildcard and empty names are refused before fetch", async () => {
  let called = false;
  const backend = createHttpBackend({
    apiKey: KEY,
    fetchImpl: async () => {
      called = true;
      return new Response("no", { status: 500 });
    },
    baseUrl: "https://api.cursor.com",
  });
  await assert.rejects(() => backend.session("*"), GrokBotApiError);
  await assert.rejects(() => backend.session("  "), GrokBotApiError);
  assert.equal(called, false);
});
