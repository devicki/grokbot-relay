import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

/**
 * Local contract for the SDK surface this relay imports.
 * Child processes so env edits cannot leak into other tests, and so a
 * resolved key is never printed.
 */
function runContract(script: string, env: NodeJS.ProcessEnv = process.env): string {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: new URL("..", import.meta.url),
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test("cursorExternalApiUrl defaults to https://api.cursor.com and trims a trailing slash", () => {
  const env = { ...process.env };
  delete env.CURSOR_API_BASE_URL;
  const def = runContract(
    `
import { cursorExternalApiUrl } from "@grok/agent-sdk";
const url = cursorExternalApiUrl();
if (url !== "https://api.cursor.com") process.exit(2);
`,
    env,
  );
  assert.equal(def, "");

  const overridden = { ...env, CURSOR_API_BASE_URL: "http://127.0.0.1:9/" };
  const out = runContract(
    `
import { cursorExternalApiUrl } from "@grok/agent-sdk";
process.stdout.write(cursorExternalApiUrl());
`,
    overridden,
  );
  assert.equal(out, "http://127.0.0.1:9");
});

test("resolveApiKeySync prefers an explicit option and does not echo it", () => {
  const env = { ...process.env };
  delete env.CURSOR_API_KEY;
  delete env.CURSOR_API_KEY_FILE;
  delete env.CURSOR_SERVICE_ACCOUNT_KEY;
  // Keep stored login from winning by pointing the config dir at an empty folder.
  env.AGENT_SERVE_CONFIG_DIR = new URL("./.sdk-contract-empty/", import.meta.url).pathname;
  const out = runContract(
    `
import { resolveApiKeySync } from "@grok/agent-sdk";
const resolved = resolveApiKeySync({ apiKey: "explicit-test-key", backendUrl: "https://example.invalid" });
if (!resolved || resolved.source !== "option" || resolved.backendUrl !== "https://example.invalid") process.exit(2);
if (resolved.apiKey !== "explicit-test-key") process.exit(3);
process.stdout.write(resolved.source);
`,
    env,
  );
  assert.equal(out, "option");
});

test("defineAgent preserves an empty harness tool allowlist", () => {
  const out = runContract(`
import { defineAgent } from "@grok/agent-sdk";
const agent = defineAgent({ tools: [] });
if (!Array.isArray(agent.tools) || agent.tools.length !== 0) process.exit(2);
process.stdout.write("empty");
`);
  assert.equal(out, "empty");
});
