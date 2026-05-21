# procurement-pulse-engine

> The crawl + aggregate engine behind the [AI Procurement Pulse](https://pulse.kineticgain.com/). Probes a universe of vendor domains for the eleven [Kinetic Gain Protocol Suite](https://github.com/mizcausevic-dev/kinetic-gain-protocol-suite) documents and produces the quarterly issue dataset.

```bash
node src/run.mjs --issue issue-1 --concurrency 8 --timeout 6000
# → data/issue-1.json  (the publishable aggregate)
# → data/issue-1-raw.json  (per-domain ProbeResults)
```

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
  "issue": "issue-1",
  "generatedAt": "2026-05-21T…",
  "universe": { "total": 37, "verticals": 9 },
  "headline": { "domainsPublishingAny": 0, "publicationRate": 0, "avgScore": 0 },
  "byVertical": { "AI Platform": { "domains": 9, "publicationRate": 0, "avgScore": 0 }, … },
  "bySpec": { "aeo": { "label": "AEO Protocol", "publishers": 0, "rate": 0 }, … },
  "leaderboard": [ { "domain": "…", "score": 0, "tier": "none", "published": 0 }, … ]
}
```

## Crawl etiquette

GET-only requests to public, designed-to-be-fetched `/.well-known/` paths. Bounded concurrency, per-request timeout, `redirect: follow`. No authentication, no headless browser, no scraping of page content. The universe is published alongside each issue so the run is reproducible by anyone.

## Roadmap

- **Expand the universe** to the full ~1,200 domains (Fortune 500 + top 100 EdTech + top 50 HealthTech) for the first public Issue #1.
- **Signature verification** — when a document references a `signing_key_url`, verify the ed25519 signature (via `hash-attestation-rs`).
- **Drift tracking** — diff each issue against the previous to report which vendors added/changed/removed documents.
- **Scheduled GH Action** that runs the crawl quarterly and commits the dataset, which triggers the landing-site rebuild.

## Composes with

| Repo | Relationship |
| --- | --- |
| [`well-known-probe-js`](https://github.com/mizcausevic-dev/well-known-probe-js) | The probe core (vendored into `src/probe.mjs`) |
| [`procurement-pulse-landing`](https://github.com/mizcausevic-dev/procurement-pulse-landing) | Renders this engine's dataset at pulse.kineticgain.com |
| [`kinetic-gain-protocol-suite`](https://github.com/mizcausevic-dev/kinetic-gain-protocol-suite) | The eleven specs measured |
| [`aeo-crawler`](https://github.com/mizcausevic-dev/aeo-crawler) | Heavyweight crawler; this is the Pulse-specific lightweight aggregator |

## License

MIT.
