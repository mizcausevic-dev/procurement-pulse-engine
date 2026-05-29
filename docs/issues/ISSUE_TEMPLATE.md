# AI Procurement Pulse — Issue {{ISSUE_NUMBER}}

> **{{ISSUE_DATE}}** · {{UNIVERSE_TOTAL}} domains across {{UNIVERSE_VERTICALS}} verticals · publication rate **{{PUBLICATION_RATE_PCT}}%** · verified signatures **{{VERIFIED_DOCS}}/{{FOUND_DOCS}}**

The AI Procurement Pulse is a quarterly measurement of how many AI vendor sites publish machine-readable governance documents — AEO entity cards, agent cards, prompt provenance, AI evidence, MCP tool cards, tutor cards, student-AI disclosures, classroom AUPs, clinical-AI disclosures, AI incident cards, and AI procurement decision cards — and how many of those documents are cryptographically signed.

Methodology, locked baseline, and signing convention: <https://pulse.kineticgain.com/baseline/>

## Headline

| | This issue | Locked baseline | Delta |
| --- | --- | --- | --- |
| Universe size | {{UNIVERSE_TOTAL}} domains | {{BASELINE_UNIVERSE_TOTAL}} | {{UNIVERSE_TOTAL_DELTA_SIGNED}} |
| Verticals | {{UNIVERSE_VERTICALS}} | {{BASELINE_UNIVERSE_VERTICALS}} | {{UNIVERSE_VERTICALS_DELTA_SIGNED}} |
| Domains publishing **any** Suite doc | {{DOMAINS_PUBLISHING_ANY}} | {{BASELINE_DOMAINS_PUBLISHING_ANY}} | {{DOMAINS_PUBLISHING_ANY_DELTA_SIGNED}} |
| Publication rate | {{PUBLICATION_RATE_PCT}}% | {{BASELINE_PUBLICATION_RATE_PCT}}% | {{PUBLICATION_RATE_DELTA_SIGNED_PP}} pp |
| Average score | {{AVG_SCORE}} | {{BASELINE_AVG_SCORE}} | {{AVG_SCORE_DELTA_SIGNED}} |
| Verified docs / found docs | {{VERIFIED_DOCS}}/{{FOUND_DOCS}} | {{BASELINE_VERIFIED_DOCS}}/{{BASELINE_FOUND_DOCS}} | — |
| Verified rate | {{VERIFIED_RATE_PCT}}% | {{BASELINE_VERIFIED_RATE_PCT}}% | {{VERIFIED_RATE_DELTA_SIGNED_PP}} pp |

## Per-spec publication

| Spec | Publishers | Rate | Verified |
| --- | ---: | ---: | ---: |
{{BY_SPEC_ROWS}}

## Per-vertical publication

Top verticals by publication rate; full table in `data/{{STEM}}.json`.

| Vertical | Domains | Publishers | Rate | Avg score |
| --- | ---: | ---: | ---: | ---: |
{{BY_VERTICAL_ROWS}}

## Leaderboard

Top {{LEADERBOARD_LIMIT}} domains by score.

| # | Domain | Vertical | Score | Tier | Docs published |
| ---: | --- | --- | ---: | --- | ---: |
{{LEADERBOARD_ROWS}}

## Movement vs. locked baseline

{{DRIFT_SUMMARY}}

## Methodology

- Probe: `well-known-probe` (vendored from `well-known-probe-js`)
- Concurrency: {{METHODOLOGY_CONCURRENCY}} · timeout: {{METHODOLOGY_TIMEOUT_MS}} ms
- Specs checked: {{METHODOLOGY_SPECS_CHECKED}}
- Signature check: {{METHODOLOGY_SIGNATURE_CHECK}}
- Crawled at: `{{GENERATED_AT}}`
- Universe source: `universe.csv` on `main` at run time
- Locked baseline: `data/{{BASELINE_STEM}}.json` ({{BASELINE_UNIVERSE_TOTAL}} domains, frozen for issue-to-issue comparison)

## Reproduce

```bash
git clone https://github.com/mizcausevic-dev/procurement-pulse-engine
cd procurement-pulse-engine
npm install
node src/run.mjs --issue {{STEM}} --concurrency 12 --timeout 6000
node src/drift.mjs --from data/{{BASELINE_STEM}}.json --to data/{{STEM}}.json
node src/summarize.mjs --issue {{STEM}} --baseline {{BASELINE_STEM}}
```

Same engine, same universe, no editorial pivots between issues.

---

*This page is auto-generated from `data/{{STEM}}.json` + `data/{{STEM}}-drift.json` via `src/summarize.mjs`. See `docs/issues/ISSUE_TEMPLATE.md` for the source skeleton.*
