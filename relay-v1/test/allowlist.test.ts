import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_ALLOWLIST_MESSAGE, loadAllowlist, requireAllowlist } from "../bot/lib/allowlist.js";
import { resolveAgentName } from "../bot/lib/agents.js";

const missing = () => undefined;

test("env names are trimmed, deduped, and * is dropped", () => {
  const agents = loadAllowlist({
    env: " Feedhand, Research Bot, Feedhand, * ,",
    readFile: missing,
  });
  assert.deepEqual(agents, [{ name: "Feedhand" }, { name: "Research Bot" }]);
});

test("a file supplies descriptions and env wins over the file", () => {
  const file = JSON.stringify({
    agents: [
      { name: "Feedhand", description: "Drafts posts." },
      "Research Bot",
    ],
  });
  assert.deepEqual(loadAllowlist({ env: "", filePath: "/etc/example.json", readFile: () => file }), [
    { name: "Feedhand", description: "Drafts posts." },
    { name: "Research Bot" },
  ]);
  assert.deepEqual(
    loadAllowlist({
      env: "Only",
      filePath: "/etc/example.json",
      readFile: () => file,
    }),
    [{ name: "Only" }],
  );
});

test("empty, missing, and star-only allowlists return no names and requireAllowlist throws", () => {
  let reads = 0;
  const counting = () => {
    reads += 1;
    return undefined;
  };
  for (const env of ["*", "*, *", ",,"]) {
    const agents = loadAllowlist({ env, readFile: counting });
    assert.deepEqual(agents, []);
    assert.throws(() => requireAllowlist(agents), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, EMPTY_ALLOWLIST_MESSAGE);
      assert.match(error.message, /does not mean any name/);
      return true;
    });
  }
  assert.equal(reads, 0, "a present env value must not fall through to the file");

  for (const env of [undefined, "", "  "]) {
    assert.deepEqual(loadAllowlist({ env, filePath: "/missing.json", readFile: missing }), []);
  }
  assert.deepEqual(
    loadAllowlist({ filePath: "/empty.json", readFile: () => JSON.stringify({ agents: [] }) }),
    [],
  );
  assert.throws(() => requireAllowlist([]), /does not mean any name/);
  assert.throws(() => resolveAgentName("Whatever", []), /does not mean any name/);
});

test("a name outside the allowlist is refused and a single name is the default", () => {
  const agents = [{ name: "Feedhand", description: "Drafts posts." }];
  assert.equal(resolveAgentName(undefined, agents), "Feedhand");
  assert.equal(resolveAgentName("feedhand", agents), "Feedhand");
  assert.throws(() => resolveAgentName("Other", agents), /not on this relay's allowlist/);
  assert.throws(() => resolveAgentName("*", agents), /does not mean any name/);
  assert.throws(
    () => resolveAgentName(undefined, [{ name: "A" }, { name: "B" }]),
    /agent` is required/,
  );
});

test("invalid files and case-insensitive duplicates throw", () => {
  assert.throws(
    () => loadAllowlist({ filePath: "/bad.json", readFile: () => "{" }),
    /not JSON/,
  );
  assert.throws(
    () => loadAllowlist({ filePath: "/bad.json", readFile: () => JSON.stringify({ bots: [] }) }),
    /must contain/,
  );
  assert.throws(
    () =>
      loadAllowlist({
        filePath: "/bad.json",
        readFile: () => JSON.stringify({ agents: [{ name: "Feedhand" }, { name: "feedhand" }] }),
      }),
    /case-insensitively/,
  );
});
