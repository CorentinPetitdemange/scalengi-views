import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageDirectoryUrl = new URL("../dist-module/package/", import.meta.url);
const packageDirectory = fileURLToPath(packageDirectoryUrl);
const manifest = JSON.parse(await readFile(new URL("../scalengi-module.json", import.meta.url), "utf8"));
const manifestSchema = await readFile(new URL("../scalengi-module.schema.json", import.meta.url));
const packageMetadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

if (manifest.version !== packageMetadata.version) {
  throw new Error(`Le manifeste du module (${manifest.version}) ne correspond pas à l’application (${packageMetadata.version}).`);
}

await mkdir(packageDirectory, { recursive: true });
await writeFile(new URL("scalengi-module.json", packageDirectoryUrl), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(new URL("scalengi-module.schema.json", packageDirectoryUrl), manifestSchema);
await writeFile(new URL("README.txt", packageDirectoryUrl), [
  `Scalengi Views module v${manifest.version}`,
  "",
  "Ce paquet est destiné au chargeur de modules de la plateforme Scalengi.",
  "Le fichier scalengi-module.json est le contrat d’installation et de compatibilité.",
  "Scalengi Views reste également distribuable comme application autonome.",
  "",
].join("\n"));

const files = {};
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else files[relative(packageDirectory, path).replaceAll("\\", "/")] = new Uint8Array(await readFile(path));
  }
}
await collect(packageDirectory);
for (const entrypoint of Object.values(manifest.entrypoints)) {
  if (!files[entrypoint]) throw new Error(`Point d’entrée absent du paquet : ${entrypoint}`);
}
if (Object.keys(files).some((path) => path.startsWith("/") || path.includes("../"))) {
  throw new Error("Le paquet contient un chemin non sûr.");
}

const output = new URL(`../dist-module/${manifest.distribution.assetPattern.replace("{version}", manifest.version)}`, import.meta.url);
await writeFile(output, zipSync(files, { level: 9 }));
const outputPath = fileURLToPath(output);
console.log(`Module créé : ${relative(root, outputPath)} (${basename(outputPath)})`);
