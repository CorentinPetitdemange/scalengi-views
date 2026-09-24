import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps the application version synchronized across web, native and server manifests", async () => {
  const [packageSource, tauriSource, cargoSource, cargoLockSource, authCargoSource, authCargoLockSource, moduleSource, readme] = await Promise.all([
    read("package.json"),
    read("src-tauri/tauri.conf.json"),
    read("src-tauri/Cargo.toml"),
    read("src-tauri/Cargo.lock"),
    read("server/Cargo.toml"),
    read("server/Cargo.lock"),
    read("scalengi-module.json"),
    read("README.md"),
  ]);
  const packageVersion = JSON.parse(packageSource).version;
  assert.match(packageVersion, /^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/);
  assert.equal(JSON.parse(tauriSource).version, packageVersion);
  assert.equal(cargoSource.match(/^version = "([^"]+)"/m)?.[1], packageVersion);
  assert.equal(cargoLockSource.match(/\[\[package\]\]\nname = "scalengi-views"\nversion = "([^"]+)"/)?.[1], packageVersion);
  assert.equal(authCargoSource.match(/^version = "([^"]+)"/m)?.[1], packageVersion);
  assert.equal(authCargoLockSource.match(/\[\[package\]\]\nname = "scalengi-views-auth"\nversion = "([^"]+)"/)?.[1], packageVersion);
  assert.equal(JSON.parse(moduleSource).version, packageVersion);
  assert.equal(readme.match(/img\.shields\.io\/static\/v1\?label=version&message=v([^&]+)&color=blue/)?.[1], packageVersion);
});

test("runs pinned CodeQL security analysis for the Rust and TypeScript code", async () => {
  const workflow = await read(".github/workflows/codeql.yml");
  assert.match(workflow, /security-events: write/);
  assert.match(workflow, /- javascript-typescript/);
  assert.match(workflow, /- rust/);
  assert.match(workflow, /build-mode: none/);
  assert.match(workflow, /queries: security-extended/);
  assert.match(workflow, /github\/codeql-action\/init@[a-f0-9]{40}/);
  assert.match(workflow, /github\/codeql-action\/analyze@[a-f0-9]{40}/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});

test("publishes tagged prereleases through the desktop workflow", async () => {
  const workflow = await read(".github/workflows/desktop-release.yml");
  assert.match(workflow, /- "v\*"/);
  assert.match(workflow, /tagName: v__VERSION__/);
  assert.match(workflow, /prerelease: \$\{\{ contains\(github\.ref_name, '-'\) \}\}/);
  assert.match(workflow, /git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/);
  assert.match(workflow, /needs: validate-release/);
  assert.match(workflow, /No Apple certificate configured; using the ad hoc identity/);
  assert.doesNotMatch(workflow, /^\s+APPLE_CERTIFICATE: \$\{\{ secrets\.APPLE_CERTIFICATE \}\}/m);
  assert.match(workflow, /--target aarch64-apple-darwin --bundles dmg/);
  assert.match(workflow, /--target x86_64-apple-darwin --bundles dmg/);
  assert.match(workflow, /pnpm module:package/);
  assert.match(workflow, /gh release upload "\$GITHUB_REF_NAME" dist-module\/\*\.zip --clobber/);
  assert.doesNotMatch(workflow, /version prioritaire|à valider/);
});

test("publishes a bounded installable module contract", async () => {
  const [manifestSource, schemaSource, entrySource, integrationGuide] = await Promise.all([
    read("scalengi-module.json"),
    read("scalengi-module.schema.json"),
    read("module/entry.ts"),
    read("docs/MODULE_INTEGRATION.md"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const schema = JSON.parse(schemaSource);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "com.scalengi.views");
  assert.equal(manifest.compatibility.standalone, true);
  assert.equal(manifest.permissions.businessDataNetworkAccess, false);
  assert.match(manifest.distribution.assetPattern, /^scalengi-views-module-v\{version\}\.zip$/);
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.additionalProperties, false);
  assert.match(entrySource, /ScalengiViewsApp/);
  assert.match(entrySource, /export \* from "\.\.\/library\/src"/);
  assert.match(integrationGuide, /platform owns the workspace, identity, navigation, module lifecycle/i);
});
