import { readFile, writeFile } from "node:fs/promises";

const nextVersion = process.argv[2];
const allowedVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.(0|[1-9]\d*))?$/;

if (!nextVersion || !allowedVersion.test(nextVersion)) {
  throw new Error("Usage : pnpm version:set <major.minor.patch[-alpha|beta|rc.numero]>");
}

const packageUrl = new URL("../package.json", import.meta.url);
const tauriUrl = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const cargoUrl = new URL("../src-tauri/Cargo.toml", import.meta.url);
const cargoLockUrl = new URL("../src-tauri/Cargo.lock", import.meta.url);
const readmeUrl = new URL("../README.md", import.meta.url);
const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
const currentVersion = packageJson.version;

const parsed = (version) => {
  const match = version.match(allowedVersion);
  if (!match) throw new Error(`Version existante invalide : ${version}`);
  const channelRank = { alpha: 0, beta: 1, rc: 2 };
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ? channelRank[match[4]] : 3, Number(match[5] ?? 0)];
};
const compare = (left, right) => {
  const a = parsed(left);
  const b = parsed(right);
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
};

if (compare(nextVersion, currentVersion) <= 0) {
  throw new Error(`La prochaine version (${nextVersion}) doit être supérieure à la version actuelle (${currentVersion}).`);
}

const tauriConfig = JSON.parse(await readFile(tauriUrl, "utf8"));
const cargoToml = await readFile(cargoUrl, "utf8");
const cargoLock = await readFile(cargoLockUrl, "utf8");
const readme = await readFile(readmeUrl, "utf8");
packageJson.version = nextVersion;
tauriConfig.version = nextVersion;

const nextCargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${nextVersion}"`);
const nextCargoLock = cargoLock.replace(
  /(\[\[package\]\]\nname = "scalengi-views"\nversion = ")[^"]+("\n)/,
  `$1${nextVersion}$2`,
);
const nextReadme = readme.replace(
  /img\.shields\.io\/static\/v1\?label=version&message=v[^&]+&color=blue/,
  `img.shields.io/static/v1?label=version&message=v${nextVersion}&color=blue`,
);

await Promise.all([
  writeFile(packageUrl, `${JSON.stringify(packageJson, null, 2)}\n`),
  writeFile(tauriUrl, `${JSON.stringify(tauriConfig, null, 2)}\n`),
  writeFile(cargoUrl, nextCargoToml),
  writeFile(cargoLockUrl, nextCargoLock),
  writeFile(readmeUrl, nextReadme),
]);

console.log(`Version préparée : ${currentVersion} → ${nextVersion}`);
console.log(`Complétez CHANGELOG.md, validez la CI, puis créez le tag v${nextVersion}.`);
