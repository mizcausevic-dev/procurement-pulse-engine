/**
 * Probe a domain's well-known endpoints for all eleven Kinetic Gain Protocol
 * Suite documents. Zero dependencies, uses the platform fetch.
 */

import { scoreResult } from "./scoring.mjs";
import { verifyDocument } from "./signature.mjs";

/**
 * The eleven canonical Suite paths. Each entry maps a spec slug to its
 * well-known URL (relative to the origin). For `agents` / `tools` / `decisions`
 * / `incidents` / `prompts` / `evidence` / `tutor-cards` / `student-ai` /
 * `clinical-ai` we probe the index.json that publishers use to enumerate the
 * documents in that family.
 *
 * Discriminator fields (the `<thing>_version` keys) confirm we actually
 * received the document we expected — a 200 with the wrong JSON shape is
 * NOT counted as a published spec.
 */
export const SUITE_PATHS = Object.freeze({
  aeo:          { url: "/.well-known/aeo.json",                  discriminator: "aeo_version" },
  agents:       { url: "/.well-known/agents/index.json",         discriminator: "agent_card_version" },
  prompts:      { url: "/.well-known/prompts/index.json",        discriminator: "provenance_version" },
  evidence:     { url: "/.well-known/evidence/index.json",       discriminator: "evidence_version" },
  toolCards:    { url: "/.well-known/tool-cards/index.json",     discriminator: "tool_card_version" },
  tutorCards:   { url: "/.well-known/tutor-cards/index.json",    discriminator: "tutor_card_version" },
  studentAI:    { url: "/.well-known/student-ai/index.json",     discriminator: "disclosure_version" },
  classroomAUP: { url: "/.well-known/aup.json",                  discriminator: "aup_version" },
  clinicalAI:   { url: "/.well-known/clinical-ai/index.json",    discriminator: "clinical_ai_card_version" },
  incidents:    { url: "/.well-known/incidents/index.json",      discriminator: "incident_card_version" },
  decisions:    { url: "/.well-known/decisions/index.json",      discriminator: "decision_card_version" },
});

const SPEC_COUNT = Object.keys(SUITE_PATHS).length;

/**
 * @typedef {Object} ProbeOptions
 * @property {number} [timeout=5000]   Per-fetch timeout in milliseconds.
 * @property {AbortSignal} [signal]    External AbortSignal to cancel the probe.
 * @property {typeof fetch} [fetch]    Custom fetch implementation (for tests / instrumentation).
 * @property {string} [scheme='https'] URL scheme. Default https; pass 'http' for localhost testing.
 */

/**
 * @typedef {Object} DocumentResult
 * @property {number} status      HTTP status code (0 if the request failed before a response).
 * @property {boolean} found      True if status=200 AND content is a valid JSON object (and matches discriminator if any).
 * @property {string} [url]       The exact URL probed.
 * @property {object} [json]      The parsed JSON payload (only present if found).
 * @property {string} [version]   The value of the discriminator field, if it was checked.
 * @property {'verified'|'unsigned'|'invalid'} [signature]  ed25519 posture (only present if found).
 * @property {string} [error]     Error message if the probe failed.
 */

/**
 * @typedef {Object} ProbeResult
 * @property {string} domain
 * @property {string} probedAt    ISO-8601 timestamp of when the probe started.
 * @property {number} score       0-100, fraction of the 11 Suite documents found.
 * @property {string} tier        'comprehensive' | 'strong' | 'partial' | 'minimal' | 'none'
 * @property {Record<string, DocumentResult>} documents  One entry per SUITE_PATHS key.
 * @property {string[]} published Slugs of documents that were found.
 * @property {string[]} missing   Slugs of documents that were NOT found.
 * @property {{found:number, verified:number, unsigned:number, invalid:number}} signatures  ed25519 posture across found docs.
 */

/**
 * Probe a single domain for every Suite document.
 *
 * @param {string} domain        Domain (with or without scheme). e.g. 'kineticgain.com' or 'https://kineticgain.com'.
 * @param {ProbeOptions} [options]
 * @returns {Promise<ProbeResult>}
 */
export async function probeWellKnown(domain, options = {}) {
  const {
    timeout = 5000,
    signal,
    fetch: fetchImpl = globalThis.fetch,
    scheme = "https",
    verifyKeyFetch = false,
  } = options;

  if (typeof fetchImpl !== "function") {
    throw new TypeError(
      "probeWellKnown: no fetch implementation available. Pass options.fetch or run in an environment that has globalThis.fetch.",
    );
  }
  if (typeof domain !== "string" || domain.length === 0) {
    throw new TypeError("probeWellKnown: domain must be a non-empty string");
  }

  const origin = normalizeOrigin(domain, scheme);
  const probedAt = new Date().toISOString();

  /** @type {Record<string, DocumentResult>} */
  const documents = {};
  const tasks = Object.entries(SUITE_PATHS).map(async ([slug, spec]) => {
    documents[slug] = await probeOne(origin, spec, { fetchImpl, timeout, externalSignal: signal, verifyKeyFetch });
  });
  await Promise.all(tasks);

  const published = Object.keys(documents).filter((slug) => documents[slug].found);
  const missing = Object.keys(documents).filter((slug) => !documents[slug].found);
  const { score, tier } = scoreResult({ found: published.length, total: SPEC_COUNT });

  // Signature posture across the documents that were found.
  const signatures = { found: published.length, verified: 0, unsigned: 0, invalid: 0 };
  for (const slug of published) {
    const s = documents[slug].signature;
    if (s === "verified") signatures.verified += 1;
    else if (s === "invalid") signatures.invalid += 1;
    else signatures.unsigned += 1;
  }

  return {
    domain: hostnameFromOrigin(origin),
    probedAt,
    score,
    tier,
    documents,
    published,
    missing,
    signatures,
  };
}

/**
 * @param {string} origin
 * @param {{ url: string, discriminator: string | null }} spec
 * @param {{ fetchImpl: typeof fetch, timeout: number, externalSignal?: AbortSignal }} ctx
 * @returns {Promise<DocumentResult>}
 */
async function probeOne(origin, spec, { fetchImpl, timeout, externalSignal, verifyKeyFetch = false }) {
  const url = origin + spec.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) externalSignal.addEventListener("abort", onExternalAbort, { once: true });

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      redirect: "follow",
    });

    if (response.status !== 200) {
      return { status: response.status, found: false, url };
    }

    let json;
    try {
      json = await response.json();
    } catch (_err) {
      return { status: 200, found: false, url, error: "response was 200 but not valid JSON" };
    }

    if (spec.discriminator) {
      const version = json && typeof json === "object" ? json[spec.discriminator] : undefined;
      if (typeof version !== "string") {
        return {
          status: 200,
          found: false,
          url,
          error: `200 OK but missing required discriminator field '${spec.discriminator}'`,
        };
      }
      const signature = await signatureStatus(json, { fetchImpl, verifyKeyFetch });
      return { status: 200, found: true, url, json, version, signature };
    }

    // No discriminator (index files). Accept any object/array as found.
    if (!json || (typeof json !== "object")) {
      return { status: 200, found: false, url, error: "expected JSON object or array" };
    }
    const signature = await signatureStatus(json, { fetchImpl, verifyKeyFetch });
    return { status: 200, found: true, url, json, signature };
  } catch (err) {
    if (err && typeof err === "object" && /** @type {any} */ (err).name === "AbortError") {
      return { status: 0, found: false, url, error: `timed out after ${timeout}ms` };
    }
    return { status: 0, found: false, url, error: String(err) };
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * Resolve a found document's ed25519 posture to a single status string.
 * Never throws — verification failures degrade to 'invalid'/'unsigned'.
 * @returns {Promise<'verified'|'unsigned'|'invalid'>}
 */
async function signatureStatus(json, { fetchImpl, verifyKeyFetch }) {
  try {
    const { status } = await verifyDocument(json, { fetchKey: verifyKeyFetch, fetch: fetchImpl });
    return status;
  } catch {
    return "unsigned";
  }
}

function normalizeOrigin(input, scheme) {
  // Strip any path/query/fragment; keep scheme + host.
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) {
    s = scheme + "://" + s;
  }
  const u = new URL(s);
  return u.origin;
}

function hostnameFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}
