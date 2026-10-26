import type { AllowlistedAgent } from "./allowlist.js";
import { resolveAgentName } from "./agents.js";
import { findContact, listContacts, saveContact, type Contact, type ContactHost } from "./contacts.js";
import type { GrokBotBackend, GrokBotEntriesPage } from "./grokbot-http.js";
import { KeyedLock } from "./lock.js";

/**
 * One exchange with a hosted Grok Bot: get-or-create the session, send the
 * caller's message, then read transcript entries until the turn settles or
 * the wait budget runs out. Only `send-message` entries are the reply.
 * A still-running turn returns `status: "running"`; `check` continues from
 * the caller's cursor. This module does not interrupt.
 */

export const DEFAULT_WAIT_SECONDS = 120;
export const MAX_WAIT_SECONDS = 600;
export const POLL_INTERVAL_MS = 750;

/** Idle polls required before a turn counts as settled when it was never seen busy. */
const MIN_IDLE_POLLS_WITHOUT_BUSY = 4;
const CREATED_WINDOW_MS = 60_000;
/** Transcript tail of a bot nobody has spoken to. */
const EMPTY_TRANSCRIPT_TAIL = "-1";

const agentLocks = new KeyedLock();

export type ReplyStatus = "finished" | "running";

export type AskResult = {
  agent: string;
  sessionId: string;
  status: ReplyStatus;
  reply?: string;
  earlierReplies?: string[];
  created?: true;
  note?: string;
};

export type CheckResult = {
  agent: string;
  sessionId: string;
  status: ReplyStatus;
  reply?: string;
  note?: string;
};

export type ConversationDeps = {
  backend: GrokBotBackend;
  agents: readonly AllowlistedAgent[];
  host: ContactHost;
  pollIntervalMs?: number;
  nowMs?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export async function askAgent(
  input: { agent?: string; message: string; waitSeconds: number },
  deps: ConversationDeps,
): Promise<AskResult> {
  const name = resolveAgentName(input.agent, deps.agents);
  const nowMs = deps.nowMs ?? Date.now;
  const startedAt = nowMs();
  const session = await deps.backend.session(name);
  return agentLocks.run(session.sessionId, async () => {
    const contact = (await listContacts(deps.host)).find((candidate) => candidate.sessionId === session.sessionId);
    const created =
      contact === undefined &&
      session.latestUpdatedSeq === EMPTY_TRANSCRIPT_TAIL &&
      session.createdAtMs >= startedAt - CREATED_WINDOW_MS;
    const deadline = startedAt + input.waitSeconds * 1000;
    const before = await collectReplies(deps, session.sessionId, {
      cursor: contact?.cursor ?? session.latestUpdatedSeq,
      deadline,
      confirmIdle: false,
    });
    if (before.status === "running") {
      throw new Error(
        `"${session.name}" is still working on an earlier message; nothing was sent. Call check to read that reply, then wait.`,
      );
    }
    await deps.backend.send(session.sessionId, input.message);
    const replies = await collectReplies(deps, session.sessionId, {
      cursor: before.cursor,
      deadline,
      confirmIdle: true,
    });
    const now = deps.host.now().toISOString();
    await saveContact(deps.host, {
      name: session.name,
      sessionId: session.sessionId,
      cursor: replies.cursor,
      firstContactAt: contact?.firstContactAt ?? now,
      lastContactAt: now,
    });
    const notes = [
      created
        ? `No Grok Bot agent named "${session.name}" existed on this account, so an empty one was created. Check the name if that is unexpected.`
        : undefined,
      runningNote(session.name, replies.status),
    ].filter((note) => note !== undefined);
    return {
      agent: session.name,
      sessionId: session.sessionId,
      status: replies.status,
      reply: joinReplies(replies.deliveries),
      earlierReplies: before.deliveries.length === 0 ? undefined : before.deliveries,
      created: created ? true : undefined,
      note: notes.length === 0 ? undefined : notes.join(" "),
    };
  });
}

export async function checkAgent(
  input: { agent?: string; waitSeconds: number },
  deps: ConversationDeps,
): Promise<CheckResult> {
  const contact = await knownContact(deps, input.agent);
  return agentLocks.run(contact.sessionId, async () => {
    const current = (await listContacts(deps.host)).find((candidate) => candidate.sessionId === contact.sessionId) ?? contact;
    const nowMs = deps.nowMs ?? Date.now;
    const replies = await collectReplies(deps, current.sessionId, {
      cursor: current.cursor,
      deadline: nowMs() + input.waitSeconds * 1000,
      confirmIdle: true,
    });
    await saveContact(deps.host, { ...current, cursor: replies.cursor });
    return {
      agent: current.name,
      sessionId: current.sessionId,
      status: replies.status,
      reply: joinReplies(replies.deliveries),
      note: runningNote(current.name, replies.status),
    };
  });
}

async function knownContact(deps: ConversationDeps, requested: string | undefined): Promise<Contact> {
  const name = resolveAgentName(requested, deps.agents);
  const contact = findContact(await listContacts(deps.host), name);
  if (contact === undefined) {
    throw new Error(`You have not asked "${name}" anything yet; call ask first.`);
  }
  return contact;
}

type CollectOptions = {
  cursor: string;
  deadline: number;
  confirmIdle: boolean;
};

async function collectReplies(
  deps: ConversationDeps,
  sessionId: string,
  options: CollectOptions,
): Promise<{ status: ReplyStatus; deliveries: string[]; cursor: string }> {
  const sleep = deps.sleep ?? defaultSleep;
  const nowMs = deps.nowMs ?? Date.now;
  const pollIntervalMs = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  const deliveries: string[] = [];
  let cursor = options.cursor;
  let sawBusy = false;
  let idlePolls = 0;
  while (true) {
    const page = await deps.backend.entries(sessionId, cursor);
    cursor = page.latestUpdatedSeq;
    for (const entry of page.entries) {
      if (entry.kind === "send-message" && entry.text !== undefined) deliveries.push(entry.text);
    }
    const busy = isBusy(page.turn);
    if (busy) sawBusy = true;
    if (page.entries.length === 0 && !busy && page.turn.idle) {
      idlePolls += 1;
      if (sawBusy || !options.confirmIdle || idlePolls >= MIN_IDLE_POLLS_WITHOUT_BUSY) {
        return { status: "finished", deliveries, cursor };
      }
    }
    if (nowMs() >= options.deadline) return { status: "running", deliveries, cursor };
    await sleep(pollIntervalMs);
  }
}

function isBusy(turn: GrokBotEntriesPage["turn"]): boolean {
  return turn.inFlight || turn.queued > 0;
}

function joinReplies(deliveries: readonly string[]): string | undefined {
  return deliveries.length === 0 ? undefined : deliveries.join("\n\n");
}

function runningNote(name: string, status: ReplyStatus): string | undefined {
  return status === "running"
    ? `"${name}" is still replying. Call check with the same agent to keep waiting; a reply so far, if any, is above.`
    : undefined;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
