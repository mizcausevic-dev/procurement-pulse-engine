/**
 * ed25519 signature verification for Suite documents.
 *
 * Convention (matches `hash-attestation-rs`): a signed Suite document carries a
 * top-level `signature` object:
 *
 *   "signature": {
 *     "algorithm": "ed25519",
 *     "public_key": "<base64 SPKI DER of the ed25519 public key>",
 *     "signing_key_url": "https://vendor.example/.well-known/keys/2026.json", // optional
 *     "value": "<base64 ed25519 signature>"
 *   }
 *
 * The signature is computed over the *canonical* serialization of the document
 * with its own `signature` block removed (so the signature can live inside the
 * file it signs). Canonicalization sorts object keys recursively and preserves
 * array order — a small, dependency-free JCS-style canonical form.
 *
 * Zero dependencies: uses Node's built-in `node:crypto` ed25519 support.
 */

import { createPublicKey, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";

/**
 * Deterministic canonical JSON: object keys sorted recursively, arrays kept in
 * order, primitives via JSON.stringify. Not full RFC 8785 (no number
 * normalization beyond JSON) but stable and sufficient for signing.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalize(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

/**
 * The byte message an ed25519 signature covers: the document minus its own
 * `signature` block, canonicalized.
 * @param {Record<string, unknown>} doc
 * @returns {Buffer}
 */
export function signingMessage(doc) {
  const rest = { ...doc };
  delete rest.signature;
  return Buffer.from(canonicalize(rest), "utf8");
}

/**
 * Generate an ed25519 keypair. publicKeyB64 is base64 SPKI-DER (the form stored
 * in a document's `signature.public_key`); privateKey is a KeyObject for signing.
 * @returns {{ publicKeyB64: string, privateKey: import("node:crypto").KeyObject }}
 */
export function generateKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyB64: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey,
  };
}

/**
 * Return a copy of `doc` with a `signature` block attached.
 * @param {Record<string, unknown>} doc
 * @param {import("node:crypto").KeyObject} privateKey
 * @param {string} publicKeyB64  base64 SPKI-DER public key
 * @param {{ signing_key_url?: string }} [extra]
 * @returns {Record<string, unknown>}
 */
export function signDocument(doc, privateKey, publicKeyB64, extra = {}) {
  const value = cryptoSign(null, signingMessage(doc), privateKey).toString("base64");
  const signature = { algorithm: "ed25519", public_key: publicKeyB64, value };
  if (extra.signing_key_url) signature.signing_key_url = extra.signing_key_url;
  return { ...doc, signature };
}

/**
 * @typedef {Object} SignatureResult
 * @property {'verified'|'unsigned'|'invalid'} status
 * @property {'embedded'|'signing_key_url'} [keySource]
 * @property {string} [error]
 */

/**
 * Verify a document's ed25519 signature.
 *
 * - No `signature` block            → { status: 'unsigned' }
 * - Signature verifies              → { status: 'verified', keySource }
 * - Present but fails / malformed    → { status: 'invalid', error }
 *
 * By default verifies against the embedded `public_key` (tamper-evidence). Pass
 * `{ fetchKey: true, fetch }` to instead trust the key fetched from
 * `signing_key_url` (provenance), falling back to the embedded key on failure.
 *
 * @param {Record<string, unknown>} doc
 * @param {{ fetchKey?: boolean, fetch?: typeof fetch }} [options]
 * @returns {Promise<SignatureResult>}
 */
export async function verifyDocument(doc, options = {}) {
  const { fetchKey = false, fetch: fetchImpl = globalThis.fetch } = options;
  const sig = doc && typeof doc === "object" ? doc.signature : null;
  if (!sig || typeof sig !== "object") return { status: "unsigned" };
  if (sig.algorithm && sig.algorithm !== "ed25519") {
    return { status: "invalid", error: `unsupported algorithm '${sig.algorithm}'` };
  }
  if (typeof sig.value !== "string") return { status: "invalid", error: "signature block missing 'value'" };

  let keyB64 = typeof sig.public_key === "string" ? sig.public_key : null;
  let keySource = keyB64 ? "embedded" : undefined;

  if (fetchKey && typeof sig.signing_key_url === "string" && typeof fetchImpl === "function") {
    try {
      const res = await fetchImpl(sig.signing_key_url, { headers: { Accept: "application/json" } });
      if (res.status === 200) {
        const body = await res.json();
        const fetched = typeof body === "string" ? body : body?.public_key ?? body?.publicKey;
        if (typeof fetched === "string") {
          keyB64 = fetched;
          keySource = "signing_key_url";
        }
      }
    } catch {
      /* fall back to embedded key */
    }
  }

  if (!keyB64) return { status: "invalid", error: "no public key available" };

  let keyObj;
  try {
    keyObj = createPublicKey({ key: Buffer.from(keyB64, "base64"), format: "der", type: "spki" });
  } catch (err) {
    return { status: "invalid", error: "unreadable public key: " + String(err) };
  }

  let ok = false;
  try {
    ok = cryptoVerify(null, signingMessage(doc), keyObj, Buffer.from(sig.value, "base64"));
  } catch (err) {
    return { status: "invalid", error: String(err) };
  }
  return ok ? { status: "verified", keySource } : { status: "invalid", error: "signature did not verify", keySource };
}
