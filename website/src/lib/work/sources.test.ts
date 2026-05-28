import test from "node:test";
import assert from "node:assert/strict";

import { extractSupplierSignals } from "./sources";

test("extractSupplierSignals finds supplier price and MOQ text", () => {
  const signals = extractSupplierSignals("Supplier: Shenzhen Parts Factory price $2.40 - $3.10 MOQ 500 pcs");

  assert.equal(signals.supplier, "Shenzhen Parts Factory");
  assert.equal(signals.price, "$2.40 - $3.10");
  assert.equal(signals.moq, "MOQ 500 pcs");
});
