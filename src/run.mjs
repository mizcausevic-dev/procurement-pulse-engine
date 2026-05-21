#!/usr/bin/env node
/**
 * run.mjs — crawl the universe, aggregate, write the issue dataset.
 *
 * Reads universe.csv (domain,vertical,note), probes each domain's eleven
 * Suite well-known paths with bounded concurrency, and writes:
 *   - data/<issue>-raw.json    per-domain ProbeResult
 *   - data/<issue>.json        aggregate report (the publishable dataset)
 * and prints a human summary.
 *
 * Usage:
 *   node src/run.mjs --issue issue-1 [--concurrency 8] [--timeout 6000] [--limit N]
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { probeWellKnown, SUITE_PATHS } from "./probe.mjs";
import { aggregate } from "./aggregate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ISSUE = arg("issue", "issue-1");
const CONCURRENCY = Number(arg("concurrency", "8"));
const TIMEOUT = Number(arg("timeout", "6000"));
const LIMIT = Number(arg("limit", "0")); // 0 = no limit

function parseUniverse() {
  const csv = readFileSync(join(ROOT, "universe.csv"), "utf8").trim();
  const [, ...rows] = csv.split(/\r?\n/);
  const out = rows
    .filter(Boolean)
    .map((line) => {
      const [domain, vertical, note] = line.split(",");
      return { domain: domain.trim(), vertical: (vertical || "Uncategorized").trim(), note: (note || "").trim() };
    });
  return LIMIT > 0 ? out.slice(0, LIMIT) : out;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const universe = parseUniverse();
  console.error(`Crawling ${universe.length} domains (concurrency=${CONCURRENCY}, timeout=${TIMEOUT}ms)…`);

  let done = 0;
  const probes = await mapWithConcurrency(universe, CONCURRENCY, async (entry) => {
    let result;
    try {
      result = await probeWellKnown(entry.domain, { timeout: TIMEOUT });
    } catch (err) {
      result = { domain: entry.domain, score: 0, tier: "none", documents: {}, published: [], missing: Object.keys(SUITE_PATHS), error: String(err) };
    }
    done += 1;
    console.error(`  [${done}/${universe.length}] ${entry.domain} → ${result.score}/100`);
    return result;
  });

  const report = aggregate(universe, probes, {
    issue: ISSUE,
    concurrency: CONCURRENCY,
    timeoutMs: TIMEOUT,
  });

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(join(ROOT, "data", `${ISSUE}-raw.json`), JSON.stringify(probes, null, 2));
  writeFileSync(join(ROOT, "data", `${ISSUE}.json`), JSON.stringify(report, null, 2));

  console.log("");
  console.log(`=== ${ISSUE} summary ===`);
  console.log(`Universe: ${report.universe.total} domains across ${report.universe.verticals} verticals`);
  console.log(`Domains publishing any Suite doc: ${report.headline.domainsPublishingAny} (${(report.headline.publicationRate * 100).toFixed(1)}%)`);
  console.log(`Average disclosure score: ${report.headline.avgScore}/100`);
  console.log("");
  console.log("By vertical:");
  for (const [v, d] of Object.entries(report.byVertical)) {
    console.log(`  ${v.padEnd(18)} ${(d.publicationRate * 100).toFixed(0)}% publish · avg ${d.avgScore}`);
  }
  console.log("");
  console.log(`Wrote data/${ISSUE}.json + data/${ISSUE}-raw.json`);
}

main();
