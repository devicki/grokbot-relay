import * as z from "zod/v4";
import { KeyedLock } from "./lock.js";

/**
 * Per-caller read cursors. The HTTP routes use one Cursor API key, so every
 * bot is that account's. What we store per caller is how far they have read,
 * so `check` returns what arrived since that caller last read, and `check`
 * can address a bot without creating one.
 *
 * The key prefix is `grokbot-relay-v1/` so a v1 state directory does not
 * reuse v0's `grokbot-agents/` records.
 */

const PREFIX = "grokbot-relay-v1";
const locks = new KeyedLock();

export type Contact = {
  name: string;
  sessionId: string;
  cursor: string;
  firstContactAt: string;
  lastContactAt: string;
};

export type ContactHost = {
  principal: string;
  now(): Date;
  get(key: string): Promise<unknown>;
  put(key: string, value: Contact[]): Promise<void>;
};

const contactsSchema = z.array(
  z.object({
    name: z.string(),
    sessionId: z.string(),
    cursor: z.string(),
    firstContactAt: z.string(),
    lastContactAt: z.string(),
  }),
);

/** Tool calls with no auth share one principal, same as local `tool call`. */
export function principalOf(auth: { principalType: string; principalId: string } | null): string {
  return auth === null ? "anonymous" : `${auth.principalType}:${auth.principalId}`;
}

export function contactHostFrom(ctx: {
  now(): Date;
  session: { auth: { principalType: string; principalId: string } | null };
  host: {
    kv: {
      get(key: string): Promise<unknown>;
      put(key: string, value: Contact[]): Promise<void>;
    };
  };
}): ContactHost {
  return {
    principal: principalOf(ctx.session.auth),
    now: () => ctx.now(),
    get: (key) => ctx.host.kv.get(key),
    put: (key, value) => ctx.host.kv.put(key, value),
  };
}

export async function listContacts(host: ContactHost): Promise<Contact[]> {
  const parsed = contactsSchema.safeParse(await host.get(contactsKey(host.principal)));
  return parsed.success ? parsed.data : [];
}

/** Exact spelling first, then case-insensitively. */
export function findContact(contacts: readonly Contact[], name: string): Contact | undefined {
  const wanted = name.trim();
  return (
    contacts.find((contact) => contact.name === wanted) ??
    contacts.find((contact) => contact.name.toLowerCase() === wanted.toLowerCase())
  );
}

/** Insert or replace one record, newest first. */
export async function saveContact(host: ContactHost, contact: Contact): Promise<void> {
  const key = contactsKey(host.principal);
  await locks.run(key, async () => {
    const others = (await listContacts(host)).filter((existing) => existing.sessionId !== contact.sessionId);
    await host.put(key, [contact, ...others]);
  });
}

export type ListPayload = {
  configured: Array<{ name: string; description?: string }>;
  contacted: Array<{ name: string; sessionId: string; firstContactAt: string; lastContactAt: string }>;
};

/** Allowlist plus this caller's contacts. Cursor stays in kv. Not an account list. */
export function listPayload(
  agents: readonly { name: string; description?: string }[],
  contacts: readonly Contact[],
): ListPayload {
  return {
    configured: agents.map((agent) =>
      agent.description ? { name: agent.name, description: agent.description } : { name: agent.name },
    ),
    contacted: contacts.map((contact) => ({
      name: contact.name,
      sessionId: contact.sessionId,
      firstContactAt: contact.firstContactAt,
      lastContactAt: contact.lastContactAt,
    })),
  };
}

function contactsKey(principal: string): string {
  return `${PREFIX}/principals/${encodeURIComponent(principal)}`;
}
