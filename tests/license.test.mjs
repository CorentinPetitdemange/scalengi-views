import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses PolyForm Shield consistently before public distribution", async () => {
  const [license, packageJson, cargo, container, readme, contributing] = await Promise.all([
    readFile(new URL("../LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8"),
    readFile(new URL("../.devcontainer/Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8"),
  ]);
  assert.match(license, /^# PolyForm Shield License 1\.0\.0/m);
  assert.match(license, /Required Notice: Copyright 2026 Corentin Petitdemange/);
  assert.match(license, /Licensor Line of Business: Scalengi Views software, hosting, managed services, and commercial licensing\./);
  assert.match(packageJson, /"license": "SEE LICENSE IN LICENSE"/);
  assert.match(cargo, /license-file = "\.\.\/LICENSE"/);
  assert.match(container, /org\.opencontainers\.image\.licenses="PolyForm-Shield-1\.0\.0"/);
  assert.match(readme, /source-available, not OSI Open Source/);
  assert.match(contributing, /sublicense, and relicense that contribution under any terms/);
  const formerLicenseName = String.fromCharCode(77, 73, 84);
  assert.equal([license, packageJson, cargo, container, readme, contributing].join("\n").includes(formerLicenseName), false);
});
