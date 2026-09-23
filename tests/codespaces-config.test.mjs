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

test("builds and smoke-tests the Codespaces development environment", async () => {
  const [devcontainerSource, devcontainerLockSource, setupScript, startScript, ciWorkflow] = await Promise.all([
    readFile(new URL("../.devcontainer/devcontainer.json", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/devcontainer-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/setup.sh", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/start-demo.sh", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
  ]);
  const devcontainer = JSON.parse(devcontainerSource);
  const devcontainerLock = JSON.parse(devcontainerLockSource);
  const lockedNodeFeature = devcontainerLock.features["ghcr.io/devcontainers/features/node:2"];

  assert.equal(devcontainer.image, "mcr.microsoft.com/devcontainers/base:ubuntu-24.04");
  assert.ok(devcontainer.features["ghcr.io/devcontainers/features/node:2"]);
  assert.equal(devcontainer.features["ghcr.io/devcontainers/features/node:2"].version, "22.19.0");
  assert.equal(devcontainer.features["ghcr.io/devcontainers/features/node:2"].pnpmVersion, "10.17.0");
  assert.match(lockedNodeFeature.resolved, /^ghcr\.io\/devcontainers\/features\/node@sha256:[a-f0-9]{64}$/);
  assert.equal(lockedNodeFeature.integrity, lockedNodeFeature.resolved.slice(lockedNodeFeature.resolved.indexOf("sha256:")));
  assert.equal(devcontainer.features["ghcr.io/devcontainers/features/docker-in-docker:2"], undefined);
  assert.equal(devcontainer.portsAttributes["3000"].onAutoForward, "openBrowserOnce");
  assert.deepEqual(devcontainer.forwardPorts, [3000]);
  assert.equal(
    devcontainer.postCreateCommand,
    "bash .devcontainer/setup.sh && bash .devcontainer/start-demo.sh",
  );
  assert.equal(devcontainer.postStartCommand, "bash .devcontainer/start-demo.sh");
  assert.match(setupScript, /CI=true pnpm install --frozen-lockfile/);
  assert.match(setupScript, /pnpm version:check/);
  assert.doesNotMatch(setupScript, /docker/);
  assert.match(startScript, /pnpm dev --hostname 0\.0\.0\.0/);
  assert.doesNotMatch(startScript, /pnpm dev -- --hostname/);
  assert.match(startScript, /fetch\('\$APP_URL'\)/);
  assert.match(startScript, /nohup/);
  assert.doesNotMatch(startScript, /docker/);
  assert.match(ciWorkflow, /devcontainers\/ci@[a-f0-9]{40}/);
  assert.match(ciWorkflow, /Build and smoke-test Codespaces devcontainer/);
  assert.match(ciWorkflow, /hostname -I/);
  assert.match(ciWorkflow, /fetch\('http:\/\/\$container_ip:3000\/'\)/);
  assert.match(ciWorkflow, /sleep 10/);
  assert.match(ciWorkflow, /storeDir: \/tmp\/stale-pnpm-store/);
  assert.match(ciWorkflow, /bash \.devcontainer\/setup\.sh/);
});

test("publishes the persistent standalone demo container", async () => {
  const [composeSource, dockerfile, nextConfig, workflow] = await Promise.all([
    readFile(new URL("../.devcontainer/compose.yaml", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/container.yml", import.meta.url), "utf8"),
  ]);

  assert.match(composeSource, /restart: unless-stopped/);
  assert.match(composeSource, /ghcr\.io\/corentinpetitdemange\/scalengi-view:latest/);
  assert.match(composeSource, /SCALENGI_VIEWS_PORT:-3000/);
  assert.match(dockerfile, /FROM node:22\.19\.0-bookworm-slim AS runtime/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
  assert.match(nextConfig, /output: "standalone"/);
  assert.match(workflow, /packages: write/);
  assert.match(workflow, /docker\/build-push-action@[a-f0-9]{40}/);
  assert.match(workflow, /ghcr\.io\/corentinpetitdemange\/scalengi-view:latest/);
});
