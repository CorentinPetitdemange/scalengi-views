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

test("runs the Codespaces demo as a persistent standalone container", async () => {
  const [devcontainerSource, composeSource, dockerfile, setupScript, startScript, nextConfig, workflow] = await Promise.all([
    readFile(new URL("../.devcontainer/devcontainer.json", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/compose.yaml", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/setup.sh", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/start-demo.sh", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/container.yml", import.meta.url), "utf8"),
  ]);
  const devcontainer = JSON.parse(devcontainerSource);

  assert.ok(devcontainer.features["ghcr.io/devcontainers/features/docker-in-docker:2"]);
  assert.equal(devcontainer.portsAttributes["3000"].onAutoForward, "openBrowserOnce");
  assert.deepEqual(devcontainer.forwardPorts, [3000]);
  assert.match(composeSource, /restart: unless-stopped/);
  assert.match(composeSource, /ghcr\.io\/corentinpetitdemange\/scalengi-view:latest/);
  assert.match(composeSource, /SCALENGI_VIEWS_PORT:-3000/);
  assert.match(dockerfile, /FROM node:22\.19\.0-bookworm-slim AS runtime/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
  assert.match(nextConfig, /output: "standalone"/);
  assert.match(setupScript, /docker compose .* pull/);
  assert.match(setupScript, /docker build --pull/);
  assert.match(setupScript, /docker compose .* up --detach/);
  assert.match(setupScript, /container_health.*healthy/);
  assert.match(startScript, /docker compose .* up --detach/);
  assert.doesNotMatch(startScript, /nohup|pnpm (?:dev|start)/);
  assert.match(workflow, /packages: write/);
  assert.match(workflow, /docker\/build-push-action@[a-f0-9]{40}/);
  assert.match(workflow, /ghcr\.io\/corentinpetitdemange\/scalengi-view:latest/);
});
