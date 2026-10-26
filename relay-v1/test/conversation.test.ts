import assert from "node:assert/strict";
import { test } from "node:test";
import type { AllowlistedAgent } from "../bot/lib/allowlist.js";
import { askAgent, checkAgent, type ConversationDeps } from "../bot/lib/conversation.js";
import { listContacts, listPayload, type Contact, type ContactHost } from "../bot/lib/contacts.js";
import { RELAY_SENDER_HEADER } from "../bot/lib/header.js";
import {
  createHttpBackend,
  type FetchLike,
  type GrokBotBackend,
  type GrokBotEntriesPage,
} from "../bot/lib/grokbot-http.js";

const agents: AllowlistedAgent[] = [{ name: "Example", description: "A bot." }];

function memoryHost(now = "2026-10-26T00:00:00.000Z"): ContactHost & { store: Map<string, Contact[]> } {
  const store = new Map<string, Contact[]>();
  return {
    store,
    principal: "user:trial",
    now: () => new Date(now),
    async get(key) {
      return store.get(key);
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

function idle(latestUpdatedSeq: string, entries: GrokBotEntriesPage["entries"] = []): GrokBotEntriesPage {
  return {
    entries,
    latestUpdatedSeq,
    turn: { idle: true, inFlight: false, queued: 0 },
  };
}

function busy(latestUpdatedSeq: string): GrokBotEntriesPage {
  return {
    entries: [],
    latestUpdatedSeq,
    turn: { idle: false, inFlight: true, queued: 0 },
  };
}

test("empty allowlist and unknown names do not call the backend", async () => {
  let called = false;
  const backend: GrokBotBackend = {
    async session() {
      called = true;
      throw new Error("session");
    },
    async send() {
      called = true;
    },
    async entries() {
      called = true;
      throw new Error("entries");
    },
  };
  const host = memoryHost();
  await assert.rejects(() => askAgent({ message: "hi", waitSeconds: 0 }, { backend, agents: [], host }), /does not mean any name/);
  await assert.rejects(
    () => askAgent({ agent: "Other", message: "hi", waitSeconds: 0 }, { backend, agents, host }),
    /not on this relay's allowlist/,
  );
  assert.equal(called, false);
});

test("ask get-or-creates, stamps via HTTP, polls entries, and records the contact", async () => {
  const calls: string[] = [];
  let sent = "";
  const pages: GrokBotEntriesPage[] = [
    idle("-1"),
    {
      entries: [
        { seq: "1", updatedSeq: "1", kind: "tool", createdAtMs: 1 },
        { seq: "2", updatedSeq: "2", kind: "send-message", text: "pong", createdAtMs: 2 },
      ],
      latestUpdatedSeq: "2",
      turn: { idle: false, inFlight: true, queued: 0 },
    },
    idle("3"),
  ];
  const fetchImpl: FetchLike = async (url, init) => {
    const href = String(url);
    calls.push(`${init?.method} ${href}`);
    if (init?.method === "POST" && href.endsWith("/v0/grokbot/sessions")) {
      return json({ id: "ses_1", name: "Example", createdAtMs: 1_000, latestUpdatedSeq: "-1" });
    }
    if (init?.method === "POST" && href.endsWith("/messages")) {
      sent = JSON.parse(String(init.body)).text;
      return json({ messageId: "m1", delivery: "accepted_temporal" });
    }
    const page = pages.shift();
    if (!page) throw new Error("unexpected entries poll");
    return json(page);
  };
  const host = memoryHost();
  const result = await askAgent(
    { message: "ping", waitSeconds: 30 },
    deps(createHttpBackend({ apiKey: "self-check-not-a-credential", fetchImpl, baseUrl: "https://api.cursor.com" }), host, {
      nowMs: () => 1_000,
      sleep: async () => {},
    }),
  );
  assert.equal(result.status, "finished");
  assert.equal(result.reply, "pong");
  assert.equal(result.created, true);
  assert.equal(result.agent, "Example");
  assert.equal(sent, `${RELAY_SENDER_HEADER}ping`);
  assert.equal(calls.some((call) => call.includes("/interrupt")), false);
  const contacts = await listContacts(host);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0]?.cursor, "3");
  assert.equal(contacts[0]?.sessionId, "ses_1");
  const listed = listPayload(agents, contacts);
  assert.equal("cursor" in (listed.contacted[0] ?? {}), false);
  assert.deepEqual(listed.configured, [{ name: "Example", description: "A bot." }]);
});

test("a busy earlier turn sends nothing", async () => {
  let sent = false;
  const backend: GrokBotBackend = {
    async session() {
      return { sessionId: "ses_1", name: "Example", createdAtMs: 1, latestUpdatedSeq: "4" };
    },
    async send() {
      sent = true;
    },
    async entries() {
      return busy("4");
    },
  };
  await assert.rejects(
    () => askAgent({ agent: "Example", message: "ping", waitSeconds: 0 }, deps(backend, memoryHost(), { nowMs: () => 50 })),
    /nothing was sent/,
  );
  assert.equal(sent, false);
});

test("duplicate delivery still completes the ask", async () => {
  const pages: GrokBotEntriesPage[] = [
    idle("1"),
    idle("2", [{ seq: "2", updatedSeq: "2", kind: "send-message", text: "ok", createdAtMs: 1 }]),
    idle("2"),
    idle("2"),
    idle("2"),
    idle("2"),
  ];
  const fetchImpl: FetchLike = async (url, init) => {
    const href = String(url);
    if (init?.method === "POST" && href.endsWith("/sessions")) {
      return json({ id: "ses_1", name: "Example", createdAtMs: 1, latestUpdatedSeq: "1" });
    }
    if (init?.method === "POST" && href.endsWith("/messages")) {
      return json({ messageId: "m1", delivery: "duplicate" });
    }
    const page = pages.shift();
    if (!page) throw new Error("unexpected entries poll");
    return json(page);
  };
  const result = await askAgent(
    { agent: "example", message: "ping", waitSeconds: 30 },
    deps(createHttpBackend({ apiKey: "k", fetchImpl, baseUrl: "https://api.cursor.com" }), memoryHost(), {
      nowMs: () => 10_000,
      sleep: async () => {},
    }),
  );
  assert.equal(result.reply, "ok");
  assert.equal(result.status, "finished");
  assert.equal(result.created, undefined);
});

test("check resumes from the contact cursor and does not open a session", async () => {
  const host = memoryHost();
  await host.put("grokbot-relay-v1/principals/user%3Atrial", [
    {
      name: "Example",
      sessionId: "ses_1",
      cursor: "3",
      firstContactAt: "2026-10-26T00:00:00.000Z",
      lastContactAt: "2026-10-26T00:00:00.000Z",
    },
  ]);
  let opened = false;
  const pages = [
    {
      entries: [{ seq: "4", updatedSeq: "4", kind: "send-message", text: "later", createdAtMs: 4 }],
      latestUpdatedSeq: "4",
      turn: { idle: false, inFlight: true, queued: 1 },
    },
    idle("5"),
  ];
  const backend: GrokBotBackend = {
    async session() {
      opened = true;
      throw new Error("check must not get-or-create");
    },
    async send() {
      throw new Error("check must not send");
    },
    async entries(_id, after) {
      assert.equal(after, pages.length === 2 ? "3" : "4");
      const page = pages.shift();
      if (!page) throw new Error("no page");
      return page;
    },
  };
  const result = await checkAgent({ waitSeconds: 10 }, deps(backend, host, { nowMs: () => 0, sleep: async () => {} }));
  assert.equal(opened, false);
  assert.equal(result.reply, "later");
  assert.equal(result.status, "finished");
  const saved = await listContacts(host);
  assert.equal(saved[0]?.cursor, "5");
  assert.equal(saved[0]?.lastContactAt, "2026-10-26T00:00:00.000Z");
});

test("check without a prior ask refuses", async () => {
  const backend: GrokBotBackend = {
    async session() {
      throw new Error("no");
    },
    async send() {
      throw new Error("no");
    },
    async entries() {
      throw new Error("no");
    },
  };
  await assert.rejects(() => checkAgent({ waitSeconds: 0 }, deps(backend, memoryHost())), /call ask first/);
});

function deps(backend: GrokBotBackend, host: ContactHost, extra: Partial<ConversationDeps> = {}): ConversationDeps {
  return { backend, agents, host, ...extra };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
