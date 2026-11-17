import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prepareViewReport, ViewReport, viewRegistry } from "../dist-module/package/scalengi-views-renderer.mjs";
import { createEmptyDataset } from "../library/src/dataset.ts";

test("empty platform reports never activate sample data", () => {
  const definition = viewRegistry.get("collaborator-journey");
  const empty = createEmptyDataset();
  const report = prepareViewReport(definition, empty);
  assert.equal(report.data, empty);
  assert.equal(report.configuration.exampleData, undefined);
  assert.ok(definition.createDefaultConfiguration().exampleData);
});

test("repository-dependent views require a supplied structure, not a guessed demo model", () => {
  for (const id of ["partition-view", "urbanisation-maturity", "si-metamodel"]) {
    const definition = viewRegistry.get(id);
    assert.throws(() => prepareViewReport(definition, createEmptyDataset()));
    const configuration = definition.createDefaultConfiguration();
    assert.equal(prepareViewReport(definition, createEmptyDataset(), configuration).configuration.exampleData, undefined);
    assert.throws(() => prepareViewReport(definition, createEmptyDataset(), { ...configuration, viewType: "other" }), /pas une vue/);
  }
});

test("renderer accepts a controlled locale and host actions without browser storage", () => {
  const definition = { ...viewRegistry.get("verbatim-cloud"), component: () => createElement("p", null, "Résultat autorisé") };
  const html = renderToStaticMarkup(createElement(ViewReport, {
    definition, data: createEmptyDataset(), locale: "fr", actions: createElement("button", null, "Exporter"),
  }));
  assert.match(html, /Résultat autorisé/);
  assert.doesNotMatch(html, /Connexion|IndexedDB|Structure|Données|sidebar/);
});

test("installable renderer bundle excludes standalone identity and persistence", async () => {
  const bundle = await readFile(new URL("../dist-module/package/scalengi-views-renderer.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(bundle, /indexedDB|localStorage|\/api\/auth|scalengi-views-auth|ScalengiViewsApp/);
  const manifest = JSON.parse(await readFile(new URL("../scalengi-module.json", import.meta.url), "utf8"));
  assert.equal(manifest.entrypoints.renderer, "scalengi-views-renderer.mjs");
  assert.equal(manifest.entrypoints.rendererStylesheet, "scalengi-views-renderer.css");
});

test("renderer dependency styles are confined to Views rather than changing another package canvas", async () => {
  const css = await readFile(new URL("../dist-module/package/scalengi-views-renderer.css", import.meta.url), "utf8");
  assert.match(css, /@scope\s*\(\.app-shell,\s*\.scalengi-views-surface\)\s*\{\s*\.react-flow\{/);
});
