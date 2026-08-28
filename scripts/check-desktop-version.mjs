import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tauriConfig = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const cargoToml = await readFile(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
const cargoLock = await readFile(new URL("../src-tauri/Cargo.lock", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const cargoLockVersion = cargoLock.match(/\[\[package\]\]\nname = "scalengi-views"\nversion = "([^"]+)"/)?.[1];
const readmeVersion = readme.match(/img\.shields\.io\/static\/v1\?label=version&message=v([^&]+)&color=blue/)?.[1];

assert.equal(tauriConfig.version, packageJson.version, "package.json et tauri.conf.json doivent avoir la même version");
assert.equal(cargoVersion, packageJson.version, "package.json et Cargo.toml doivent avoir la même version");
assert.equal(cargoLockVersion, packageJson.version, "package.json et Cargo.lock doivent avoir la même version");
assert.equal(readmeVersion, packageJson.version, "le badge du README doit afficher la version de package.json");

const releaseTag = process.env.GITHUB_REF_NAME;
if (releaseTag?.startsWith("v")) {
  assert.equal(releaseTag, `v${packageJson.version}`, "le tag de release doit correspondre à la version de l’application");
}

console.log(`Version desktop cohérente : ${packageJson.version}`);
