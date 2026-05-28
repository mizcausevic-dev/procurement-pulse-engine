# procurement-pulse-engine

> The crawl + aggregate engine behind the [AI Procurement Pulse](https://pulse.kineticgain.com/). Probes a universe of vendor domains for the eleven [Kinetic Gain Protocol Suite](https://github.com/mizcausevic-dev/kinetic-gain-protocol-suite) documents and produces the quarterly issue dataset.

```bash
node src/run.mjs --issue issue-1 --concurrency 8 --timeout 6000
# → data/issue-1.json  (the publishable aggregate)
# → data/issue-1-raw.json  (per-domain ProbeResults)
```

## Status — [v0.4.0](https://github.com/mizcausevic-dev/procurement-pulse-engine/releases/tag/v0.4.0) (2026-05-28)

- **Universe:** 1,412 unique domains across 49 verticals. Pre-Issue #5 expansion (2026-05-28) added 412 buyer-readable vendors across ten under-represented verticals: Customer Data Platform (25), eCommerce Platform (37), AI Coding & Developer AI (32), AI Agent Platform (36), AI Data Labeling (34), MarTech (63), Customer Service Platform (30), Document & eSignature (24), Mid-Market HR/Payroll (48), Vertical SaaS (83). Previous footprint: 1,007 domains / 38 verticals (2026-05-28); 37 at Issue #1. **Locked baseline snapshot** at [`data/baseline-2026-05-28.json`](data/baseline-2026-05-28.json) (1,007 domains, frozen — August Issue #5 measures the +412 expansion against this baseline so the original 1,007 stay comparable issue-to-issue). Snapshot: 1 publisher (KG), 0.10% rate, verifiedRate 1.0.
- **Quarterly cadence pre-registered.** [`.github/workflows/quarterly-crawl.yml`](.github/workflows/quarterly-crawl.yml) auto-fires Aug/Nov/Feb/May 15 at 14:00 UTC, against universe.csv at HEAD, with drift vs the locked `data/issue-4-v04-full.json` baseline. The August fire is Issue #5.
- **Per-spec discriminator on all 11 Suite paths.** Each spec now requires its canonical `*_version` field (`agent_card_version`, `incident_card_version`, etc.). Closes the Gatsby/SPA-catchall false positive surfaced in Issue #4 — `corporate.charter.com` dropped 82/100 → 0/100; canonical publisher `kineticgain.com` still 100/100.
- **First verified signing posture.** All 11 kineticgain.com dogfooded `/.well-known/` docs are ed25519-signed against the public key at [`kineticgain.com/.well-known/pulse-signing.json`](https://kineticgain.com/.well-known/pulse-signing.json). Engine probe reports `{ verified: 11, unsigned: 0, invalid: 0 }`.
- **Engine tests:** 15/15 pass on `main`.

> The sections below preserve the Issue #1 baseline narrative and the journey through Issues #2–#4. Issue #5 (the first true quarterly delta, August 2026) inherits the v0.4 discriminator + signing posture by default.

## What it does

1. Reads [`universe.csv`](universe.csv) — `domain,vertical,note`, the set of vendors measured this issue.
2. Probes each domain's eleven well-known paths in parallel (bounded concurrency) using the vendored [`well-known-probe`](https://github.com/mizcausevic-dev/well-known-probe-js) core.
3. Aggregates into headline rate, per-vertical rollups, per-spec adoption, and a leaderboard.
4. Writes the issue dataset that [`procurement-pulse-landing`](https://github.com/mizcausevic-dev/procurement-pulse-landing) renders.

## The Issue #1 baseline finding

The first real crawl (37 domains across 9 verticals — AI Platform, EdTech, HealthTech, FinTech, Enterprise SaaS, Data, Observability, Identity, plus the Kinetic Gain reference properties) returned:

> **0.0% publication rate. Zero domains — including kineticgain.com's own properties — publish any Suite document at `/.well-known/` yet.**

This is the honest starting line. The Suite shipped in 2025; adoption begins from zero. Issue #1 is **"The Zero Baseline"** — the instrument is calibrated, the universe is defined, and every future issue measures the climb. (Methodology note: an empty `index.json` counts as published; a `200` of the wrong shape does not. The zero is real, not a probe artifact — verified against the discriminator-bearing specs too.)

## Usage

```bash
npm run crawl -- --issue issue-1                  # full universe.csv
node src/run.mjs --issue issue-1 --limit 5        # first 5 domains (smoke test)
node src/run.mjs --issue issue-2 --concurrency 12 # next issue, more parallelism

# diff two issues (aggregate deltas; add --from-raw/--to-raw for per-domain movers)
npm run drift -- --from data/issue-1.json --to data/issue-2.json \
  --from-raw data/issue-1-raw.json --to-raw data/issue-2-raw.json
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--issue` | `issue-1` | Output filename stem (`data/<issue>.json`) |
| `--concurrency` | `8` | Parallel domain probes |
| `--timeout` | `6000` | Per-fetch timeout (ms) |
| `--limit` | `0` (all) | Cap the universe (for smoke tests) |

## Output shape (`data/<issue>.json`)

```jsonc
{
  "issue": "issue-2",
  "generatedAt": "2026-05-24T…",
  "universe": { "total": 350, "verticals": 18 },
  "headline": { "domainsPublishingAny": 1, "publicationRate": 0.0029, "avgScore": 0.3 },
  "signatures": { "foundDocs": 11, "verifiedDocs": 0, "invalidDocs": 0, "verifiedRate": 0 },
  "byVertical": { "AI Platform": { "domains": 40, "publicationRate": 0, "avgScore": 0 }, … },
  "bySpec": { "aeo": { "label": "AEO Protocol", "publishers": 1, "rate": 0.0029, "verified": 0 }, … },
  "leaderboard": [ { "domain": "kineticgain.com", "score": 100, "tier": "comprehensive", "published": 11 }, … ]
}
```

## Signature verification (ed25519)

Each found document is checked for an ed25519 signature using Node's built-in `crypto` (no dependencies). A signed Suite document carries a top-level `signature` block:

```jsonc
"signature": {
  "algorithm": "ed25519",
  "public_key": "<base64 SPKI-DER>",
  "signing_key_url": "https://vendor.example/.well-known/keys/2026.json", // optional
  "value": "<base64 ed25519 signature>"
}
```

The signature covers the **canonical** serialization of the document with its own `signature` block removed (recursively key-sorted JSON, array order preserved). Each document resolves to one of three states, surfaced per-document and rolled up into `signatures` / `bySpec[].verified`:

| Status | Meaning |
| --- | --- |
| `verified` | Signature present and verifies (tamper-evident). |
| `unsigned` | No `signature` block. |
| `invalid` | Signature present but fails verification, or malformed. |

By default the embedded `public_key` is used (tamper-evidence). Pass `--verify-key-fetch` semantics (`verifyKeyFetch` option) to instead trust the key fetched from `signing_key_url` (provenance). Mirrors [`hash-attestation-rs`](https://github.com/mizcausevic-dev/hash-attestation-rs).

## Drift (`src/drift.mjs`)

`driftAggregate(prev, curr)` diffs two committed issue datasets (headline / per-vertical / per-spec / signature-rate deltas, and flags `new` / `dropped` verticals). `driftDomains(prevRaw, currRaw)` diffs the per-domain raw arrays to find movers — newly publishing, stopped, score and per-spec changes. The CLI writes `data/<to>-drift.json` and prints a human summary.

## Crawl etiquette

GET-only requests to public, designed-to-be-fetched `/.well-known/` paths. Bounded concurrency, per-request timeout, `redirect: follow`. No authentication, no headless browser, no scraping of page content. The universe is published alongside each issue so the run is reproducible by anyone.

## Roadmap

- **Expand the universe** further toward ~1,200 domains. Issue #2 grew the lens from 37 → **350 domains across 18 verticals**; the next pass deepens toward Fortune 500 + top 100 K-12 EdTech + top 50 HealthTech AI.
- ✅ **Signature verification** — ed25519 over the canonical document hash (`src/signature.mjs`).
- ✅ **Drift tracking** — `src/drift.mjs` diffs each issue against the previous.
- **Scheduled GH Action** that runs the crawl quarterly and commits the dataset, which triggers the landing-site rebuild.
- **Sign the dogfooded docs** — sign kineticgain.com's own Suite documents so they flip from `unsigned` to `verified`.

## Composes with

| Repo | Relationship |
| --- | --- |
| [`well-known-probe-js`](https://github.com/mizcausevic-dev/well-known-probe-js) | The probe core (vendored into `src/probe.mjs`) |
| [`procurement-pulse-landing`](https://github.com/mizcausevic-dev/procurement-pulse-landing) | Renders this engine's dataset at pulse.kineticgain.com |
| [`kinetic-gain-protocol-suite`](https://github.com/mizcausevic-dev/kinetic-gain-protocol-suite) | The eleven specs measured |
| [`aeo-crawler`](https://github.com/mizcausevic-dev/aeo-crawler) | Heavyweight crawler; this is the Pulse-specific lightweight aggregator |

## License

MIT.
