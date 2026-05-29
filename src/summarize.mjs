#!/usr/bin/env node
/**
 * summarize.mjs — render a Pulse issue markdown from an aggregate (+ optional
 * drift) JSON file by filling tokens in docs/issues/ISSUE_TEMPLATE.md.
 *
 * Output: docs/issues/<stem>.md ready to copy-paste into a GitHub Issue or
 * publish via the pulse.kineticgain.com pipeline.
 *
 * Usage:
 *   node src/summarize.mjs --issue issue-2026-08 \
 *                          --baseline issue-4-v04-full \
 *                          [--issue-number 5] \
 *                          [--leaderboard-limit 10] \
 *                          [--out docs/issues/issue-2026-08.md]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const STEM = arg("issue", null);
const BASELINE_STEM = arg("baseline", "issue-4-v04-full");
const ISSUE_NUMBER = arg("issue-number", "");
const LEADERBOARD_LIMIT = Number(arg("leaderboard-limit", "10"));
const OUT_PATH = arg("out", null);
const TEMPLATE_PATH = join(ROOT, "docs/issues/ISSUE_TEMPLATE.md");

if (!STEM) {
  console.error("error: --issue <stem> is required (e.g. --issue issue-2026-08)");
  process.exit(2);
}

const issueJsonPath = join(ROOT, `data/${STEM}.json`);
const driftJsonPath = join(ROOT, `data/${STEM}-drift.json`);
const baselineJsonPath = join(ROOT, `data/${BASELINE_STEM}.json`);

const issue = readJSON(issueJsonPath, /*required*/ true);
const baseline = readJSON(baselineJsonPath, /*required*/ false);
const drift = readJSON(driftJsonPath, /*required*/ false);

const out = OUT_PATH ?? join(ROOT, `docs/issues/${STEM}.md`);

const template = readFileSync(TEMPLATE_PATH, "utf8");
const filled = fillTemplate(template, buildContext({ issue, baseline, drift, baselineStem: BASELINE_STEM, stem: STEM, issueNumber: ISSUE_NUMBER, leaderboardLimit: LEADERBOARD_LIMIT }));

writeFileSync(out, filled);
console.log(`wrote ${out} (${filled.length} bytes, ${filled.split("\n").length} lines)`);

// ---------- helpers ----------

function readJSON(path, required) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    if (required) {
      console.error(`error: cannot read ${path}: ${e.message}`);
      process.exit(2);
    }
    return null;
  }
}

function buildContext({ issue, baseline, drift, baselineStem, stem, issueNumber, leaderboardLimit }) {
  const ctx = {};
  // Issue metadata
  ctx.ISSUE_NUMBER = issueNumber || "—";
  ctx.STEM = stem;
  ctx.BASELINE_STEM = baselineStem;
  ctx.GENERATED_AT = issue.generatedAt;
  ctx.ISSUE_DATE = new Date(issue.generatedAt).toISOString().slice(0, 10);

  // Universe + headline
  ctx.UNIVERSE_TOTAL = issue.universe.total;
  ctx.UNIVERSE_VERTICALS = issue.universe.verticals;
  ctx.DOMAINS_PUBLISHING_ANY = issue.headline.domainsPublishingAny;
  ctx.PUBLICATION_RATE_PCT = pct(issue.headline.publicationRate, 3);
  ctx.AVG_SCORE = round(issue.headline.avgScore, 2);
  ctx.FOUND_DOCS = issue.signatures.foundDocs;
  ctx.VERIFIED_DOCS = issue.signatures.verifiedDocs;
  ctx.VERIFIED_RATE_PCT = pct(issue.signatures.verifiedRate, 1);

  // Baseline + deltas
  if (baseline) {
    ctx.BASELINE_UNIVERSE_TOTAL = baseline.universe.total;
    ctx.BASELINE_UNIVERSE_VERTICALS = baseline.universe.verticals;
    ctx.BASELINE_DOMAINS_PUBLISHING_ANY = baseline.headline.domainsPublishingAny;
    ctx.BASELINE_PUBLICATION_RATE_PCT = pct(baseline.headline.publicationRate, 3);
    ctx.BASELINE_AVG_SCORE = round(baseline.headline.avgScore, 2);
    ctx.BASELINE_FOUND_DOCS = baseline.signatures.foundDocs;
    ctx.BASELINE_VERIFIED_DOCS = baseline.signatures.verifiedDocs;
    ctx.BASELINE_VERIFIED_RATE_PCT = pct(baseline.signatures.verifiedRate, 1);

    ctx.UNIVERSE_TOTAL_DELTA_SIGNED = signed(issue.universe.total - baseline.universe.total);
    ctx.UNIVERSE_VERTICALS_DELTA_SIGNED = signed(issue.universe.verticals - baseline.universe.verticals);
    ctx.DOMAINS_PUBLISHING_ANY_DELTA_SIGNED = signed(issue.headline.domainsPublishingAny - baseline.headline.domainsPublishingAny);
    ctx.PUBLICATION_RATE_DELTA_SIGNED_PP = signedPP(issue.headline.publicationRate - baseline.headline.publicationRate);
    ctx.AVG_SCORE_DELTA_SIGNED = signed(round(issue.headline.avgScore - baseline.headline.avgScore, 2));
    ctx.VERIFIED_RATE_DELTA_SIGNED_PP = signedPP(issue.signatures.verifiedRate - baseline.signatures.verifiedRate);
  } else {
    ctx.BASELINE_UNIVERSE_TOTAL = "—";
    ctx.BASELINE_UNIVERSE_VERTICALS = "—";
    ctx.BASELINE_DOMAINS_PUBLISHING_ANY = "—";
    ctx.BASELINE_PUBLICATION_RATE_PCT = "—";
    ctx.BASELINE_AVG_SCORE = "—";
    ctx.BASELINE_FOUND_DOCS = "—";
    ctx.BASELINE_VERIFIED_DOCS = "—";
    ctx.BASELINE_VERIFIED_RATE_PCT = "—";
    ctx.UNIVERSE_TOTAL_DELTA_SIGNED = "—";
    ctx.UNIVERSE_VERTICALS_DELTA_SIGNED = "—";
    ctx.DOMAINS_PUBLISHING_ANY_DELTA_SIGNED = "—";
    ctx.PUBLICATION_RATE_DELTA_SIGNED_PP = "—";
    ctx.AVG_SCORE_DELTA_SIGNED = "—";
    ctx.VERIFIED_RATE_DELTA_SIGNED_PP = "—";
  }

  // Per-spec rows
  ctx.BY_SPEC_ROWS = renderBySpecRows(issue.bySpec);

  // Per-vertical rows (sorted by publication rate desc, then by domains desc)
  ctx.BY_VERTICAL_ROWS = renderByVerticalRows(issue.byVertical);

  // Leaderboard
  ctx.LEADERBOARD_LIMIT = leaderboardLimit;
  ctx.LEADERBOARD_ROWS = renderLeaderboardRows(issue.leaderboard, leaderboardLimit);

  // Drift summary
  ctx.DRIFT_SUMMARY = renderDriftSummary(drift, baselineStem);

  // Methodology
  const m = issue.methodology ?? {};
  ctx.METHODOLOGY_CONCURRENCY = m.concurrency ?? "—";
  ctx.METHODOLOGY_TIMEOUT_MS = m.timeoutMs ?? "—";
  ctx.METHODOLOGY_SPECS_CHECKED = m.specsChecked ?? "—";
  ctx.METHODOLOGY_SIGNATURE_CHECK = m.signatureCheck ?? "—";

  return ctx;
}

function renderBySpecRows(bySpec) {
  if (!bySpec || typeof bySpec !== "object") return "_(no spec data)_";
  return Object.values(bySpec)
    .map((s) => `| \`${s.label}\` | ${s.publishers} | ${pct(s.rate, 3)}% | ${s.verified} |`)
    .join("\n");
}

function renderByVerticalRows(byVertical) {
  if (!byVertical || typeof byVertical !== "object") return "_(no vertical data)_";
  const rows = Object.entries(byVertical).map(([name, v]) => ({
    name,
    domains: v.domains ?? 0,
    anyPublished: v.anyPublished ?? 0,
    rate: v.publicationRate ?? 0,
    avg: v.avgScore ?? 0,
  }));
  rows.sort((a, b) => (b.rate - a.rate) || (b.domains - a.domains));
  return rows
    .map((r) => `| ${r.name} | ${r.domains} | ${r.anyPublished} | ${pct(r.rate, 2)}% | ${round(r.avg, 2)} |`)
    .join("\n");
}

function renderLeaderboardRows(lb, limit) {
  if (!Array.isArray(lb) || lb.length === 0) return "_(no leaderboard data)_";
  return lb
    .slice(0, limit)
    .map((r, i) => `| ${i + 1} | \`${r.domain}\` | ${r.vertical} | ${r.score} | ${r.tier} | ${r.published} |`)
    .join("\n");
}

function renderDriftSummary(drift, baselineStem) {
  if (!drift) {
    return `_No drift artifact found. Run \`node src/drift.mjs --from data/${baselineStem}.json --to data/<stem>.json\` to materialize it._`;
  }
  const h = drift.headline ?? {};
  const d = drift.domains ?? {};
  const lines = [];
  lines.push(`Compared against \`${drift.from}\` (locked baseline). Generated at \`${drift.generatedAt}\`.`);
  lines.push("");
  lines.push("| Headline delta | Value |");
  lines.push("| --- | ---: |");
  lines.push(`| Universe size change | ${signed(h.universeTotalDelta ?? 0)} domains |`);
  lines.push(`| Domains publishing change | ${signed(h.domainsPublishingAnyDelta ?? 0)} |`);
  lines.push(`| Publication rate change | ${signedPP(h.publicationRateDelta ?? 0)} pp |`);
  lines.push(`| Average score change | ${signed(round(h.avgScoreDelta ?? 0, 2))} |`);
  lines.push(`| Verified rate change | ${signedPP(h.verifiedRateDelta ?? 0)} pp |`);
  lines.push("");
  lines.push("| Domain movement | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| Newly publishing | ${count(d.newlyPublishing)} |`);
  lines.push(`| Stopped publishing | ${count(d.stoppedPublishing)} |`);
  lines.push(`| Changed (any spec flipped) | ${count(d.changed)} |`);
  lines.push(`| Score movers | ${count(d.movers)} |`);
  return lines.join("\n");
}

function fillTemplate(template, ctx) {
  let out = template;
  for (const [k, v] of Object.entries(ctx)) {
    const re = new RegExp(`{{\\s*${k}\\s*}}`, "g");
    out = out.replace(re, String(v));
  }
  // Flag any unfilled tokens loudly so we never ship one
  const leftover = out.match(/{{[^}]+}}/g);
  if (leftover) {
    console.error(`warn: ${leftover.length} unfilled token(s): ${[...new Set(leftover)].join(", ")}`);
  }
  return out;
}

function pct(x, digits) {
  if (typeof x !== "number" || Number.isNaN(x)) return "—";
  return (x * 100).toFixed(digits);
}
function round(x, digits) {
  if (typeof x !== "number" || Number.isNaN(x)) return 0;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
function signed(x) {
  if (typeof x !== "number" || Number.isNaN(x)) return "—";
  if (x === 0) return "0";
  return x > 0 ? `+${x}` : String(x);
}
function signedPP(x) {
  if (typeof x !== "number" || Number.isNaN(x)) return "—";
  const v = round(x * 100, 3);
  if (v === 0) return "0.000";
  return v > 0 ? `+${v}` : String(v);
}
function count(x) {
  if (typeof x === "number") return x;
  if (Array.isArray(x)) return x.length;
  if (x && typeof x === "object") return Object.keys(x).length;
  return 0;
}
