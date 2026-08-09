import test from "node:test";
import assert from "node:assert/strict";
import { findCatalogLocation } from "@/lib/shelf-scouter/catalog";

test("shelf scouter resolves a demo catalog location", async () => {
  const location = await findCatalogLocation(
    { productName: "Coca-Cola", brand: "Coca-Cola", confidence: 0.9 },
    "demo-store",
  );
  assert.equal(location?.aisle, "B12");
  assert.equal(location?.source, "demo");
});

test("shelf scouter returns no location for an unknown item", async () => {
  const location = await findCatalogLocation(
    { productName: "Unknown Product", confidence: 0.9 },
    "demo-store",
  );
  assert.equal(location, undefined);
});
