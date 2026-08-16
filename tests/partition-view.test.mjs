import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateConfiguration } from "../library/src/configuration.ts";
import { normalizeDataset } from "../library/src/dataset.ts";

const baseConfiguration = {
  version: 1,
  viewType: "partition-view",
  label: "Découpage test",
  options: { preset: "blank" },
  sections: [{
    id: "levels", title: "Niveaux", description: "", itemLabel: "niveau",
    fields: [{ key: "id", label: "Identifiant", type: "text", required: true, identifier: true }],
    items: [{ id: "domain" }],
  }],
};

test("validates safe technical identifiers for partition structures", () => {
  assert.equal(validateConfiguration(baseConfiguration, "partition-view").length, 0);
  const unsafe = structuredClone(baseConfiguration);
  unsafe.sections[0].items[0].id = "__proto__";
  assert.match(validateConfiguration(unsafe, "partition-view").join(" "), /identifiant technique sûr/i);
});

test("normalizes partition data at the IndexedDB boundary", () => {
  const data = normalizeDataset({
    partitionItems: [{ id: "domain-sales", name: "Ventes", levelId: "domain", description: "", values: { maturity: 3, constructor: "drop" } }],
    partitionRelations: [{ id: "coverage-1", sourceId: "capability-1", targetId: "application-1", type: "coverage" }],
  });
  assert.equal(data.partitionItems.length, 1);
  assert.equal(data.partitionItems[0].values.maturity, 3);
  assert.equal(Object.hasOwn(data.partitionItems[0].values, "constructor"), false);
  assert.equal(data.partitionRelations.length, 1);
});

test("ships one partition renderer, three presets and legacy migrations", async () => {
  const [builtins, model, storage, excel] = await Promise.all([
    readFile(new URL("../library/src/builtin-views.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/partition-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/view-instance-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../library/src/excel-import.ts", import.meta.url), "utf8"),
  ]);
  assert.match(builtins, /title: "Vue en découpage"/);
  assert.match(builtins, /title: "Capacités fonctionnelles"/);
  assert.match(builtins, /title: "POS urbain"/);
  assert.match(builtins, /title: "Structure vierge"/);
  assert.match(model, /partitionRelations/);
  assert.match(model, /migrateLegacyPartition/);
  assert.match(storage, /type === "pos" \|\| type === "urban-pos"/);
  assert.match(excel, /importPartitionExcel/);
  assert.match(excel, /Ancien modèle Capacités reconnu/);
  assert.match(excel, /Ancien modèle POS reconnu/);
});
