import assert from "node:assert/strict";
import test from "node:test";

import { configurationFromYaml, configurationToYaml, validateConfiguration, withExampleData } from "../library/src/configuration.ts";
import { normalizeDataset } from "../library/src/dataset.ts";
import { createWorkbookBytes } from "../library/src/xlsx-template.ts";

const validConfiguration = {
  version: 1,
  viewType: "test-view",
  label: "Configuration de test",
  sections: [{
    id: "axes",
    title: "Axes",
    description: "Axes configurables",
    itemLabel: "axe",
    fields: [{ key: "id", label: "Identifiant", type: "text", required: true }],
    items: [{ id: "architecture" }],
  }],
  options: { scoreMax: 5 },
};

test("round-trips a bounded YAML configuration", () => {
  const parsed = configurationFromYaml(configurationToYaml(validConfiguration), "test-view");
  assert.deepEqual(parsed, validConfiguration);
});

test("keeps the example dataset inside the portable YAML", () => {
  const withExample = withExampleData(validConfiguration, normalizeDataset({ verbatims: [{ id: "v1", text: "Besoin de données fiables", category: "needs", team: "Data", sentiment: "Neutre", weight: 1 }] }));
  const parsed = configurationFromYaml(configurationToYaml(withExample), "test-view");
  assert.equal(parsed.exampleData.verbatims.length, 1);
  assert.equal(parsed.exampleData.verbatims[0].text, "Besoin de données fiables");
  assert.deepEqual(parsed.exampleData.collaborators, []);
});

test("serializes an incomplete editor draft before validating it", () => {
  const draft = structuredClone(validConfiguration);
  draft.sections[0].fields.push({ key: "label", label: "Libellé", type: "text", required: true });
  draft.sections[0].items.push({ id: "axes-new", label: "" });
  assert.match(configurationToYaml(draft), /id: axes-new/);
  assert.match(validateConfiguration(draft, "test-view").join(" "), /Libellé est obligatoire/);
});

test("rejects malformed, oversized and cross-view YAML", () => {
  assert.throws(() => configurationFromYaml("sections: nope", "test-view"), /version|type|sections/i);
  assert.throws(() => configurationFromYaml(`version: 1\nviewType: other-view\nlabel: Test\nsections: []\noptions: {}`, "test-view"), /other-view/);
  assert.throws(() => configurationFromYaml("x".repeat(256_001), "test-view"), /taille maximale/i);
});

test("rejects reserved keys and duplicate identifiers", () => {
  const unsafe = structuredClone(validConfiguration);
  unsafe.sections[0].items = [{ id: "architecture", constructor: "interdit" }, { id: "architecture" }];
  const errors = validateConfiguration(unsafe, "test-view").join(" ");
  assert.match(errors, /constructor/);
  assert.match(errors, /plusieurs fois/);
});

test("rejects unsafe keys inside the example dataset", () => {
  const unsafe = structuredClone(validConfiguration);
  unsafe.exampleData = { verbatims: [{ id: "v1", constructor: "interdit" }] };
  assert.match(validateConfiguration(unsafe, "test-view").join(" "), /collection d’exemple.*invalide/i);
});

test("normalizes the dataset envelope and bounds collections", () => {
  const normalized = normalizeDataset({ collaborators: [null, "bad", ...Array.from({ length: 25_010 }, (_, id) => ({ id }))] });
  assert.equal(normalized.collaborators.length, 25_000);
  assert.deepEqual(normalized.processes, []);
});

test("rejects an oversized generated workbook contract", () => {
  assert.throws(() => createWorkbookBytes({
    filename: "too-large.xlsx",
    viewTitle: "Test",
    sheets: [{ name: "Données", description: "", columns: Array.from({ length: 101 }, (_, index) => ({ key: `c${index}`, label: `C${index}` })) }],
  }), /100 colonnes/);
});
