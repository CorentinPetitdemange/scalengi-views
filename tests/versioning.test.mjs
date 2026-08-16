import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps the application version synchronized across web and native manifests", async () => {
  const [packageSource, tauriSource, cargoSource, cargoLockSource] = await Promise.all([
    read("package.json"), read("src-tauri/tauri.conf.json"), read("src-tauri/Cargo.toml"), read("src-tauri/Cargo.lock"),
  ]);
  const packageVersion = JSON.parse(packageSource).version;
  assert.match(packageVersion, /^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/);
  assert.equal(JSON.parse(tauriSource).version, packageVersion);
  assert.equal(cargoSource.match(/^version = "([^"]+)"/m)?.[1], packageVersion);
  assert.equal(cargoLockSource.match(/\[\[package\]\]\nname = "scalengi-views"\nversion = "([^"]+)"/)?.[1], packageVersion);
});

test("publishes tagged prereleases through the desktop workflow", async () => {
  const workflow = await read(".github/workflows/desktop-release.yml");
  assert.match(workflow, /- "v\*"/);
  assert.match(workflow, /tagName: v__VERSION__/);
  assert.match(workflow, /prerelease: \$\{\{ contains\(github\.ref_name, '-'\) \}\}/);
  assert.match(workflow, /git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/);
  assert.match(workflow, /needs: validate-release/);
});
