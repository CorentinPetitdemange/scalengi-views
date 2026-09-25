import assert from "node:assert/strict";
import test from "node:test";

import { catalogBootstrapAction } from "../app/catalog-bootstrap.ts";

test("standard installations never receive default views", () => {
  assert.equal(catalogBootstrapAction("standard", false, false, 0), "mark-only");
});

test("demo installations seed once only on an empty fresh catalogue", () => {
  assert.equal(catalogBootstrapAction("demo", false, false, 0), "seed-demo");
  assert.equal(catalogBootstrapAction("demo", true, false, 0), "none");
});

test("existing or deliberately cleared catalogues are never overwritten", () => {
  assert.equal(catalogBootstrapAction("demo", false, false, 1), "mark-only");
  assert.equal(catalogBootstrapAction("demo", false, true, 0), "mark-only");
});
