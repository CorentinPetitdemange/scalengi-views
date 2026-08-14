import assert from "node:assert/strict";
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
