import { test } from "node:test";
import assert from "node:assert/strict";

import { generateKeypair, signDocument, verifyDocument, canonicalize } from "../src/signature.mjs";

test("sign → verify roundtrip (embedded key)", async () => {
  const { publicKeyB64, privateKey } = generateKeypair();
  const doc = { aeo_version: "1.0", entity: { name: "X" }, claims: [1, 2, 3] };
  const signed = signDocument(doc, privateKey, publicKeyB64);
  assert.equal(signed.signature.algorithm, "ed25519");
  assert.equal(typeof signed.signature.value, "string");
  const r = await verifyDocument(signed);
  assert.equal(r.status, "verified");
  assert.equal(r.keySource, "embedded");
});

test("unsigned document → unsigned", async () => {
  const r = await verifyDocument({ aeo_version: "1.0" });
  assert.equal(r.status, "unsigned");
});

test("tampered document → invalid", async () => {
  const { publicKeyB64, privateKey } = generateKeypair();
  const signed = signDocument({ aeo_version: "1.0", n: 1 }, privateKey, publicKeyB64);
  signed.n = 2; // mutate a signed field
  const r = await verifyDocument(signed);
  assert.equal(r.status, "invalid");
});

test("wrong public key → invalid", async () => {
  const a = generateKeypair();
  const b = generateKeypair();
  const signed = signDocument({ aeo_version: "1.0" }, a.privateKey, a.publicKeyB64);
  signed.signature.public_key = b.publicKeyB64; // swap to an unrelated key
  const r = await verifyDocument(signed);
  assert.equal(r.status, "invalid");
});

test("unsupported algorithm → invalid", async () => {
  const r = await verifyDocument({ x: 1, signature: { algorithm: "rsa", value: "AA==", public_key: "AA==" } });
  assert.equal(r.status, "invalid");
});

test("canonicalize: key-order independent, array-order sensitive", () => {
  assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }));
  assert.notEqual(canonicalize([1, 2]), canonicalize([2, 1]));
});

test("signing_key_url trust path verifies via fetched key", async () => {
  const { publicKeyB64, privateKey } = generateKeypair();
  const signed = signDocument({ aeo_version: "1.0" }, privateKey, publicKeyB64, {
    signing_key_url: "https://keys.example/2026.json",
  });
  delete signed.signature.public_key; // force reliance on the fetched key
  const fakeFetch = async () => ({ status: 200, json: async () => ({ public_key: publicKeyB64 }) });
  const r = await verifyDocument(signed, { fetchKey: true, fetch: fakeFetch });
  assert.equal(r.status, "verified");
  assert.equal(r.keySource, "signing_key_url");
});
