#!/usr/bin/env node
/**
 * sign-suite-docs.mjs — Re-sign the 11 KG Suite documents at
 * kineticgain-com-apex/.well-known/ using the ed25519 private key.
 *
 * Why this script exists:
 * Suite docs at /.well-known/<spec>.json carry an embedded `signature` block
 * (see src/signature.mjs convention). When a doc is edited (content update,
 * spec bump, etc) the signature MUST be regenerated or the Pulse engine's
 * verifier will (correctly) report it unsigned. This script does that batch.
 *
 * Discovery story: an Aug 15 Pulse Issue #5 dry-run on 2026-06-01 reported
 * "0/11 verified" against a "11/11 verified" baseline because all 11 docs
 * had been edited without re-signing somewhere between the original signing
 * (2026-05-28) and the dry-run. This script + the Pulse workflow that uses it
 * close that gap permanently.
 *
 * Usage:
 *   node scripts/sign-suite-docs.mjs \
 *     --apex /path/to/kineticgain-com-apex \
 *     --key /path/to/kg-pulse-signing-key.pem \
 *     [--signing-key-url https://kineticgain.com/.well-known/pulse-signing.json] \
 *     [--dry-run]
 *
 * The key file is PKCS#8 PEM (mode 0600). Never committed.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { signDocument, verifyDocument } from "../src/signature.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}

const APEX_ROOT = arg("apex", null);
const KEY_PATH = arg("key", null);
const SIGNING_KEY_URL = arg("signing-key-url", "https://kineticgain.com/.well-known/pulse-signing.json");
const DRY_RUN = flag("dry-run");

if (!APEX_ROOT || !KEY_PATH) {
  console.error("usage: node scripts/sign-suite-docs.mjs --apex <path-to-apex-repo> --key <path-to-private-key.pem> [--signing-key-url URL] [--dry-run]");
  process.exit(2);
}

// The 11 canonical Suite docs the Pulse engine probes for.
const SUITE_DOCS = [
  ".well-known/aeo.json",
  ".well-known/agents/index.json",
  ".well-known/prompts/index.json",
  ".well-known/evidence/index.json",
  ".well-known/tool-cards/index.json",
  ".well-known/tutor-cards/index.json",
  ".well-known/student-ai/index.json",
  ".well-known/aup.json",
  ".well-known/clinical-ai/index.json",
  ".well-known/incidents/index.json",
  ".well-known/decisions/index.json",
];

// ---- Load + derive the keypair from a PKCS#8 PEM private key ----
const privatePem = readFileSync(KEY_PATH, "utf8");
const privateKey = createPrivateKey({ key: privatePem, format: "pem" });
const publicKey = createPublicKey(privateKey);
const publicKeyB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

console.log("Public key (SPKI-DER base64):");
console.log("  " + publicKeyB64);
console.log();

// Sanity: this should match what's in /.well-known/pulse-signing.json on apex
const expectedPubKey = "MCowBQYDK2VwAyEARxsDtZsl4R481NdBerN2RlCF74VZdQhqRHpgvAIJoTo=";
if (publicKeyB64 !== expectedPubKey) {
  console.error("✗ Public key derived from private key does NOT match the published pulse-signing.json key.");
  console.error("  Expected: " + expectedPubKey);
  console.error("  Got:      " + publicKeyB64);
  console.error("  Either the wrong private key was loaded, or the published public key needs updating.");
  process.exit(1);
}
console.log("✓ Derived public key matches the published pulse-signing.json key.\n");

// ---- Sign each doc ----
let signed = 0, skipped = 0, errors = 0;
for (const relPath of SUITE_DOCS) {
  const absPath = join(APEX_ROOT, relPath);
  let doc;
  try {
    doc = JSON.parse(readFileSync(absPath, "utf8"));
  } catch (e) {
    console.error(`  ✗ ${relPath}: read/parse failed — ${e.message}`);
    errors++;
    continue;
  }

  // If already signed AND signature verifies, skip.
  if (doc.signature) {
    const verify = await verifyDocument(doc);
    if (verify.status === "verified") {
      console.log(`  − ${relPath}: already signed + verified, skipping`);
      skipped++;
      continue;
    }
    console.log(`  ! ${relPath}: existing signature is ${verify.status} (${verify.error || "no error msg"}); will re-sign`);
  }

  const signedDoc = signDocument(doc, privateKey, publicKeyB64, { signing_key_url: SIGNING_KEY_URL });

  // Verify roundtrip before writing — never write a doc whose own signature we can't verify.
  const verify = await verifyDocument(signedDoc);
  if (verify.status !== "verified") {
    console.error(`  ✗ ${relPath}: post-sign verify failed (${verify.status}: ${verify.error || ""})`);
    errors++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`  ✓ ${relPath}: (DRY-RUN) would write signed doc, verify ok`);
  } else {
    writeFileSync(absPath, JSON.stringify(signedDoc, null, 2) + "\n", "utf8");
    console.log(`  ✓ ${relPath}: signed + verified, written`);
  }
  signed++;
}

console.log();
console.log(`Summary: ${signed} signed, ${skipped} skipped (already valid), ${errors} errors${DRY_RUN ? " (DRY-RUN — no files changed)" : ""}.`);
if (errors > 0) process.exit(1);
