import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export function getCodespacesForwardedHost(
  environment: NodeJS.ProcessEnv = process.env,
  port = 3000,
) {
  const codespaceName = environment.CODESPACE_NAME?.trim().toLowerCase();
  const forwardingDomain = environment.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ?.trim()
    .toLowerCase();

  if (!codespaceName || !forwardingDomain || !Number.isInteger(port) || port < 1) {
    return undefined;
  }

  const forwardedHost = `${codespaceName}-${port}.${forwardingDomain}`;
  if (
    forwardedHost.includes("..")
    || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(forwardedHost)
  ) {
    return undefined;
  }

  return forwardedHost;
}

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  const codespacesForwardedHost = getCodespacesForwardedHost();
  const server = {
    ...(codespacesForwardedHost
      ? { allowedHosts: [codespacesForwardedHost] }
      : {}),
    ...(isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : {}),
  };

  return {
    server: Object.keys(server).length > 0 ? server : undefined,
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
