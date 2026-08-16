import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  const [app, exportMenu, exportView, registry, builtins, builtinConfigurations, configuration, dataset, storage, collaboratorView, partitionView, urbanisationView, layersView, metamodelView, togafView, verbatimView, excelImport, agents, architecture, createViewGuide] = await Promise.all([
    readFile(new URL("../app/scalengi-views-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/view-export-menu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/export-view.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/view-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/builtin-views.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/builtin-configurations.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/configuration.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/dataset.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/view-instance-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/CollaboratorJourneyView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/PartitionView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/UrbanisationRadarView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/SILayersView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/SIMetamodelView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/TogafTrackingView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/VerbatimCloudView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../library/src/excel-import.ts", import.meta.url), "utf8"),
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/ARCHITECTURE.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/CREATE_A_VIEW.md", import.meta.url), "utf8"),
  ]);
  assert.match(app, /Comment ça fonctionne/);
  assert.match(app, /Données de cette vue uniquement/);
  assert.match(app, /Configuration intrinsèque de la vue/);
  assert.match(app, /Exporter YAML/);
  assert.match(app, /Page blanche/);
  assert.match(app, /Jeu d’exemple/);
  assert.match(app, /Aucune donnée/);
  assert.match(app, /Désactiver l’exemple/);
  assert.match(app, /kind: "demo"/);
  assert.match(app, /Contrat de données généré/);
  assert.match(app, /VIEW_CATALOG_GROUPS/);
  assert.match(app, /Exemple portable inclus dans le YAML/);
  assert.doesNotMatch(app, /aria-label="Changer de thème"/);
  assert.match(exportMenu, /Image \(PNG\)/);
  assert.match(exportMenu, /Vecteur \(SVG\)/);
  assert.match(exportView, /toPng/);
  assert.match(exportView, /toSvg/);
  assert.match(exportView, /data-export-exclude/);
  assert.match(exportView, /data-view-export-content/);
  assert.doesNotMatch(app, /scalengi-view-dataset-v1/);
  assert.match(registry, /class ViewRegistry/);
  assert.match(registry, /defineView/);
  assert.match(registry, /importExcel/);
  assert.match(registry, /organisation-experience/);
  assert.match(builtins, /registerMany/);
  assert.match(builtins, /summarize/);
  assert.doesNotMatch(app, /definition\.id\s*===/);
  assert.match(builtinConfigurations, /modele-vue-collaborateurs\.xlsx/);
  assert.match(builtinConfigurations, /modele-vue-en-decoupage\.xlsx/);
  assert.match(builtinConfigurations, /modele-diagnostic-urbanisation\.xlsx/);
  assert.match(builtinConfigurations, /modele-si-par-couches\.xlsx/);
  assert.match(builtinConfigurations, /modele-metamodele-si\.xlsx/);
  assert.match(builtinConfigurations, /modele-togaf-adm\.xlsx/);
  assert.match(builtinConfigurations, /modele-analyse-verbatims\.xlsx/);
  assert.match(builtins, /title: "Vue en découpage"/);
  assert.match(builtins, /title: "POS urbain"/);
  assert.match(storage, /indexedDB\.open/);
  assert.match(storage, /normalizeDataset/);
  assert.match(storage, /ViewSource/);
  assert.match(storage, /value\.source\.kind === "demo"/);
  assert.match(configuration, /MAX_YAML_BYTES/);
  assert.match(configuration, /forbiddenKeys/);
  assert.match(dataset, /createEmptyDataset/);
  assert.match(builtins, /name: "Retours"/);
  assert.match(collaboratorView, /Affichage des anneaux/);
  assert.match(collaboratorView, /Noms des processus/);
  assert.doesNotMatch(collaboratorView, /source:\s*["']current["']/);
  assert.match(partitionView, /Vue en découpage/);
  assert.match(partitionView, /partitionItems/);
  assert.match(partitionView, /partitionRelations/);
  assert.match(partitionView, /Conditions sur les informations/);
  assert.match(partitionView, /Niveaux réellement visibles/);
  assert.match(partitionView, /displayedIds/);
  assert.match(partitionView, /Toutes les conditions/);
  assert.match(partitionView, /Au moins une/);
  assert.match(partitionView, /filterRules/);
  assert.match(partitionView, /requestFullscreen/);
  assert.match(urbanisationView, /Écarts prioritaires/);
  assert.match(urbanisationView, /Composer le diagnostic/);
  assert.match(urbanisationView, /requestFullscreen/);
  assert.match(layersView, /Analyse d’impact inter-couches/);
  assert.match(layersView, /Point focal/);
  assert.match(layersView, /Profondeur/);
  assert.match(layersView, /impactScope/);
  assert.match(layersView, /requestFullscreen/);
  assert.match(metamodelView, /Métamodèle du SI/);
  assert.match(metamodelView, /Relation autorisée/);
  assert.match(metamodelView, /ReactFlow/);
  assert.match(metamodelView, /requestFullscreen/);
  assert.match(togafView, /TOGAF ADM/);
  assert.match(togafView, /adm-cycle-ring/);
  assert.match(togafView, /data-view-export-content/);
  assert.match(togafView, /Gestion des exigences/);
  assert.match(togafView, /ReactFlow/);
  assert.match(togafView, /requestFullscreen/);
  assert.match(verbatimView, /Analyse des verbatims/);
  assert.match(verbatimView, /selectedWord/);
  assert.match(verbatimView, /requestFullscreen/);
  assert.match(excelImport, /Objectif Niveau d'Urbanisation/);
  assert.match(excelImport, /niveau_cartographie/);
  assert.match(excelImport, /importSILayersExcel/);
  assert.match(excelImport, /importMetamodelExcel/);
  assert.match(excelImport, /importTogafExcel/);
  assert.match(excelImport, /importVerbatimExcel/);
  assert.match(agents, /shell must never switch on a view id/i);
  assert.match(architecture, /ViewRegistry/);
  assert.match(createViewGuide, /defineView/);
});
