import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCodespacesForwardedHost } from "../vite.config.ts";

test("allows only the exact forwarded host for the Codespaces demo", () => {
  assert.equal(
    getCodespacesForwardedHost({
      CODESPACE_NAME: "verbose-guide-v7pq499pr672wrrg",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
    }),
    "verbose-guide-v7pq499pr672wrrg-3000.app.github.dev",
  );
});

test("does not broaden the Vite allowlist outside Codespaces", () => {
  assert.equal(getCodespacesForwardedHost({}), undefined);
  assert.equal(
    getCodespacesForwardedHost({
      CODESPACE_NAME: "unsafe/name",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
    }),
    undefined,
  );
});

test("waits for a production demo that serves an HTML page", async () => {
  const [devcontainerSource, setupScript, startScript] = await Promise.all([
    readFile(new URL("../.devcontainer/devcontainer.json", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/setup.sh", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/start-demo.sh", import.meta.url), "utf8"),
  ]);
  const devcontainer = JSON.parse(devcontainerSource);

  assert.equal(devcontainer.waitFor, "postStartCommand");
  assert.equal(devcontainer.portsAttributes["3000"].onAutoForward, "openBrowserOnce");
  assert.match(setupScript, /pnpm build/);
  assert.match(startScript, /pnpm start -- -H 0\.0\.0\.0 -p 3000/);
  assert.match(startScript, /200 text\/html/);
  assert.doesNotMatch(startScript, /pnpm dev/);
});
