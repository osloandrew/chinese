import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const payload = JSON.parse(
  await readFile(new URL("../vocabulary-frequency.json", import.meta.url), "utf8"),
);

test("Chinese frequency data is populated from the NAER COCT source", () => {
  assert.equal(payload.version, 5);
  assert.equal(payload.method, "exact-headword-match");
  assert.match(payload.sources.coct.source, /coct\.naer\.edu\.tw/);
  assert.ok(payload.matchedDictionaryEntries > 650);

  const de = payload.entries["的|particle"];
  assert.ok(de);
  assert.equal(de.rank, 1);
  assert.ok(de.weight > 0 && de.weight <= 1);
  assert.ok(Number.isFinite(de.bandPercentiles.A1));
});

test("every entry has a rank, a 0-1 weight, and COCT counts", () => {
  for (const [key, entry] of Object.entries(payload.entries)) {
    assert.ok(Number.isInteger(entry.rank) && entry.rank > 0, key);
    assert.ok(entry.weight >= 0 && entry.weight <= 1, key);
    assert.ok(entry.sources.coct.perMillion.spoken >= 0, key);
  }
});
