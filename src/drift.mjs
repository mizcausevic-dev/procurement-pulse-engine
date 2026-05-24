/**
 * drift.mjs — diff two Pulse issues and report what changed.
 *
 * Two pure functions plus a small CLI:
 *
 *   driftAggregate(prev, curr)        deltas from two committed aggregate
 *                                     datasets (headline / byVertical / bySpec
 *                                     / signature posture).
 *   driftDomains(prevRaw, currRaw)    per-domain movers from two raw arrays of
 *                                     ProbeResults (newly publishing, dropped,
 *                                     score + spec changes).
 *
 * CLI:
 *   node src/drift.mjs --from data/issue-1.json --to data/issue-2.json \
 *        [--from-raw data/issue-1-raw.json --to-raw data/issue-2-raw.json] \
 *        [--out data/issue-2-drift.json]
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const round4 = (n) => +Number(n).toFixed(4);
const round1 = (n) => +Number(n).toFixed(1);
const delta4 = (a, b) => round4((b ?? 0) - (a ?? 0));
const delta1 = (a, b) => round1((b ?? 0) - (a ?? 0));

/**
 * Aggregate-level drift between two issue datasets (the committed `data/<issue>.json`).
 * @param {object} prev  previous aggregate
 * @param {object} curr  current aggregate
 */
export function driftAggregate(prev, curr) {
  const verticals = new Set([
    ...Object.keys(prev.byVertical ?? {}),
    ...Object.keys(curr.byVertical ?? {}),
  ]);
  const byVertical = {};
  for (const v of [...verticals].sort()) {
    const a = prev.byVertical?.[v];
    const b = curr.byVertical?.[v];
    byVertical[v] = {
      status: !a ? "new" : !b ? "dropped" : "changed",
      publicationRateDelta: delta4(a?.publicationRate, b?.publicationRate),
      avgScoreDelta: delta1(a?.avgScore, b?.avgScore),
      domainsDelta: (b?.domains ?? 0) - (a?.domains ?? 0),
    };
  }

  const specs = new Set([...Object.keys(prev.bySpec ?? {}), ...Object.keys(curr.bySpec ?? {})]);
  const bySpec = {};
  for (const s of [...specs].sort()) {
    const a = prev.bySpec?.[s];
    const b = curr.bySpec?.[s];
    bySpec[s] = {
      label: b?.label ?? a?.label ?? s,
      publishersDelta: (b?.publishers ?? 0) - (a?.publishers ?? 0),
      verifiedDelta: (b?.verified ?? 0) - (a?.verified ?? 0),
    };
  }

  return {
    from: prev.issue ?? null,
    to: curr.issue ?? null,
    generatedAt: new Date().toISOString(),
    headline: {
      universeTotalDelta: (curr.universe?.total ?? 0) - (prev.universe?.total ?? 0),
      domainsPublishingAnyDelta:
        (curr.headline?.domainsPublishingAny ?? 0) - (prev.headline?.domainsPublishingAny ?? 0),
      publicationRateDelta: delta4(prev.headline?.publicationRate, curr.headline?.publicationRate),
      avgScoreDelta: delta1(prev.headline?.avgScore, curr.headline?.avgScore),
      verifiedRateDelta: delta4(prev.signatures?.verifiedRate, curr.signatures?.verifiedRate),
    },
    byVertical,
    bySpec,
  };
}

/**
 * Per-domain drift from two raw arrays of ProbeResults.
 * @param {Array<{domain:string, score:number, published?:string[], signatures?:object}>} prevRaw
 * @param {Array<{domain:string, score:number, published?:string[], signatures?:object}>} currRaw
 */
export function driftDomains(prevRaw, currRaw) {
  const prevMap = new Map((prevRaw ?? []).map((r) => [r.domain, r]));
  const currMap = new Map((currRaw ?? []).map((r) => [r.domain, r]));
  const domains = new Set([...prevMap.keys(), ...currMap.keys()]);

  let newlyPublishing = 0;
  let stoppedPublishing = 0;
  const movers = [];

  for (const dom of domains) {
    const a = prevMap.get(dom);
    const b = currMap.get(dom);
    const fromScore = a?.score ?? 0;
    const toScore = b?.score ?? 0;
    const fromPub = new Set(a?.published ?? []);
    const toPub = new Set(b?.published ?? []);
    const gainedSpecs = [...toPub].filter((s) => !fromPub.has(s));
    const lostSpecs = [...fromPub].filter((s) => !toPub.has(s));
    const verifiedFrom = a?.signatures?.verified ?? 0;
    const verifiedTo = b?.signatures?.verified ?? 0;

    if (
      fromScore === toScore &&
      gainedSpecs.length === 0 &&
      lostSpecs.length === 0 &&
      verifiedFrom === verifiedTo
    ) {
      continue;
    }

    if (fromPub.size === 0 && toPub.size > 0) newlyPublishing += 1;
    if (fromPub.size > 0 && toPub.size === 0) stoppedPublishing += 1;

    movers.push({
      domain: dom,
      fromScore,
      toScore,
      delta: toScore - fromScore,
      gainedSpecs,
      lostSpecs,
      verifiedDelta: verifiedTo - verifiedFrom,
    });
  }

  movers.sort((x, y) => y.delta - x.delta || y.toScore - x.toScore || x.domain.localeCompare(y.domain));
  return { newlyPublishing, stoppedPublishing, changed: movers.length, movers };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  const fromPath = arg("from");
  const toPath = arg("to");
  if (!fromPath || !toPath) {
    console.error("usage: node src/drift.mjs --from data/<prev>.json --to data/<curr>.json [--from-raw … --to-raw …] [--out …]");
    process.exit(2);
  }

  const prev = readJson(join(ROOT, fromPath.replace(/^\.?\//, "")));
  const curr = readJson(join(ROOT, toPath.replace(/^\.?\//, "")));
  const report = driftAggregate(prev, curr);

  const fromRaw = arg("from-raw");
  const toRaw = arg("to-raw");
  if (fromRaw && toRaw) {
    report.domains = driftDomains(
      readJson(join(ROOT, fromRaw.replace(/^\.?\//, ""))),
      readJson(join(ROOT, toRaw.replace(/^\.?\//, ""))),
    );
  }

  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  console.error(`\nDrift ${report.from} → ${report.to}`);
  console.error(`  universe:           ${sign(report.headline.universeTotalDelta)} domains`);
  console.error(`  publishing-any:     ${sign(report.headline.domainsPublishingAnyDelta)} domains`);
  console.error(`  publication rate:   ${sign(report.headline.publicationRateDelta)}`);
  console.error(`  avg score:          ${sign(report.headline.avgScoreDelta)}`);
  console.error(`  ed25519 verified:   ${sign(report.headline.verifiedRateDelta)} rate`);
  if (report.domains) {
    console.error(
      `  domains: ${report.domains.newlyPublishing} newly publishing, ${report.domains.stoppedPublishing} stopped, ${report.domains.changed} changed`,
    );
    for (const m of report.domains.movers.slice(0, 10)) {
      console.error(`    ${m.domain}: ${m.fromScore}→${m.toScore} (${sign(m.delta)})`);
    }
  }

  const out = arg("out", `data/${report.to ?? "drift"}-drift.json`);
  const outPath = join(ROOT, out.replace(/^\.?\//, ""));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.error(`\nWrote ${out}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
