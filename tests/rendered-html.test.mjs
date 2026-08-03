import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Scalengi Views shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Scalengi Views<\/title>/i);
  assert.match(html, /Mes vues/);
  assert.match(html, /Nouvelle vue/);
  assert.match(html, /STOCKAGE PAR VUE/);
  assert.match(html, /Chargement des vues locales/);
});

test("keeps data, guides and Excel contracts scoped per view", async () => {
  const [app, registry, builtins, storage, collaboratorView, urbanPosView] = await Promise.all([
    readFile(new URL("../app/scalengi-views-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/view-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/builtin-views.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/view-instance-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/CollaboratorJourneyView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/UrbanPosView.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /Comment ça fonctionne/);
  assert.match(app, /Données de cette vue uniquement/);
  assert.doesNotMatch(app, /scalengi-view-dataset-v1/);
  assert.match(registry, /class ViewRegistry/);
  assert.match(registry, /importExcel/);
  assert.match(builtins, /modele-vue-collaborateurs\.xlsx/);
  assert.match(builtins, /modele-vue-capacites\.xlsx/);
  assert.match(builtins, /modele-pos-urbain\.xlsx/);
  assert.match(builtins, /Plan d’occupation du sol urbain/);
  assert.match(storage, /indexedDB\.open/);
  assert.match(builtins, /name: "Retours"/);
  assert.match(collaboratorView, /Affichage des anneaux/);
  assert.match(collaboratorView, /Noms des processus/);
  assert.doesNotMatch(collaboratorView, /source:\s*["']current["']/);
  assert.match(urbanPosView, /Cartographie urbaine du SI/);
  assert.match(urbanPosView, /urbanZones/);
  assert.match(urbanPosView, /urbanDistricts/);
  assert.match(urbanPosView, /urbanBlocks/);
  await access(new URL("../public/templates/modele-vue-collaborateurs.xlsx", import.meta.url));
  await access(new URL("../public/templates/modele-vue-capacites.xlsx", import.meta.url));
  await access(new URL("../public/templates/modele-pos-urbain.xlsx", import.meta.url));
});
