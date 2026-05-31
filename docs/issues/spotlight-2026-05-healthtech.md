# Spotlight · HealthTech AI procurement disclosure · May 2026

> **Interim Pulse spotlight** between the locked Issue #4 baseline (May 2026) and the scheduled Issue #5 quarterly crawl (August 15, 2026). This is an analytical between-issues note focused on one vertical — **HealthTech** — to surface what the next quarterly Issue will measure and what we already see in the universe.
>
> Engine version: v0.4 (per-spec discriminator + KG ed25519 signing)
> Universe size at spotlight: **1,508 domains across 38 verticals**
> HealthTech entries currently in universe: **74**
> This spotlight: qualitative, not a fresh crawl.

---

## TL;DR for a HealthTech buyer

If you are a HealthTech CISO, security review lead, or vendor risk team reading this, here's what the public AI Procurement Pulse will tell you about your vendor universe in August:

- **The 74 HealthTech-classified domains in the Pulse universe** include EHR vendors, clinical-AI platforms, RCM systems, telehealth providers, FHIR ecosystem players, and patient-experience tools.
- The Pulse engine scores each domain against the `ai-procurement-decision-spec` for measurable disclosure depth — *not for marketing claims*. The score is mechanical: does the vendor publish a Decision Card, a Vault Contract, audit-stream artifacts, a /trust/ surface, etc.
- For HealthTech specifically, the scoring axis that matters most is **PHI handling provenance** — can a buyer's auditor see what AI tool read what patient field, when, under what consent. Most vendors today have a SOC 2 report; almost none have runtime-verifiable AI-access disclosure.

The August Issue will publish the per-vendor scores. This spotlight tells you the methodology + what to expect.

---

## What we're measuring (the HealthTech-specific axes)

The Pulse engine applies the same `ai-procurement-decision-spec` to every vertical. For HealthTech, four spec fields carry disproportionate signal:

### 1. `vault_contract.data_targets`
Does the vendor publish the PHI fields they tokenize before AI tools read them? The Vault Contract pattern (KG Suite spec) lets a buyer's compliance team verify which patient fields are protected against which AI consumers — *before signature*, not after audit. Vendors who publish this score high.

### 2. `audit_stream.cadence` + `audit_stream.verify_endpoint`
Is there a public or buyer-accessible audit-stream endpoint that proves PHI access events are hash-chained and replayable? The KG audit-stream spec defines a `/verify` endpoint that walks the chain end-to-end. Vendors who expose this score high; vendors who only offer "compliance attestation reports" score lower.

### 3. `decision_card.retention_envelope`
Does the vendor accept a customer-published Decision Card that declares per-field TTL + redaction action + signed deletion-proof endpoint? Decision Card v0.3 added this field specifically for regulated verticals. Vendors who consume customer Decision Cards (rather than dictating their own ToS-style data policy) score high.

### 4. `signing.public_key_url`
Is the vendor's audit-stream output ed25519-signable, with a published public key URL at `/.well-known/`? This is the bedrock provenance test — without signing, every other claim is repudiable. Vendors who publish a `/.well-known/pulse-signing.json` (or equivalent) get the full score; vendors who don't sign get zero on this axis regardless of how strong their docs are.

---

## What we already see in the universe (qualitative read)

Without rerunning the crawl, here's what's already visible in `universe.csv` + public vendor surfaces for the HealthTech 74:

### Pattern: SOC 2 ≠ AI procurement disclosure

The strong majority of the 74 HealthTech vendors have SOC 2 Type II attestation prominently linked from their homepage. Far fewer publish anything about *which AI components touch PHI, under what consent, with what retention envelope*. SOC 2 is necessary but not sufficient for the AI procurement question. Pulse measures the AI-specific gap.

### Pattern: "Trust Center" pages are common, signed audit-streams are rare

About a third of the HealthTech 74 have a /trust/ or /security/ landing page with policy text + downloadable docs. Almost none publish a runtime-verifiable audit-stream endpoint. This will be the largest single delta in the August Issue.

### Pattern: FHIR vendors lead on standards depth, lag on signing posture

FHIR ecosystem vendors (HAPI, SMART, Cerner, Epic adjacencies) tend to lead on standards-alignment depth (they live in regulated APIs daily). But few publish ed25519-signed disclosure outputs — the discipline that lets buyers verify provenance without trusting the source.

### Pattern: Clinical-AI startups split bimodally

Roughly half the clinical-AI startups in the universe (FDA SaMD pathway or adjacent) publish thoughtful technical write-ups about model evaluation + bias testing. The other half lean heavily on regulatory tailwind ("FDA-cleared!") without specifying which subcomponents are cleared vs ancillary. Pulse will distinguish "claims" from "evidence" here.

---

## What the August Issue (Issue #5) will publish

Based on the methodology above + the universe at spotlight time (1508 total, 74 HealthTech):

- **Per-vendor score** across the 4 HealthTech-weighted axes
- **Leaderboard top 10** for HealthTech specifically
- **Largest individual jumps** since Issue #4 baseline (vendors who shipped meaningful new disclosure)
- **Largest individual regressions** (vendors whose disclosure surface got thinner — usually because of acquisitions or pivots)
- **Per-axis distribution** — which axis has the most upside if vendors adopted it (likely `signing.public_key_url`)

Issue #5 is mechanically scheduled (Aug 15, summarizer auto-drafts Issue body + per-vertical breakouts). The April→August delta will be the first full quarter measured against the v0.4 engine + locked baseline.

---

## What we're *not* claiming in this spotlight

This document is qualitative. The above patterns are *observed* in the universe but **not measured against a fresh crawl** — that's Issue #5's job.

We are not:
- Naming specific vendors as scoring high or low (Issue #5 will do that mechanically)
- Predicting specific numerical scores
- Suggesting that Pulse measures clinical safety (it doesn't — it measures *AI procurement disclosure depth*)
- Claiming this spotlight constitutes a Pulse measurement (it doesn't — only the quarterly Issues do)

We are:
- Surfacing the methodology so a HealthTech buyer can independently apply it
- Inviting HealthTech vendors to verify their own posture *before* Issue #5 lands — every vendor has the `procurement-pulse-action` GitHub Action available to drop into their own CI and get the same self-score Pulse will publish on August 15

---

## For HealthTech vendors reading this

The fastest way to improve your Pulse score before Issue #5:

1. **Publish a Decision Card** at a stable URL on your domain. Use the `ai-procurement-decision-spec` (v0.3) as your schema. ~2 hours of work for a security-aware engineer + compliance lead.
2. **Publish a vault-contract spec** describing which PHI fields you tokenize before AI tools touch them. ~2 hours.
3. **Publish ed25519 public key** at `/.well-known/pulse-signing.json` and start signing your audit-stream output. ~30 minutes once you've generated the keypair (PKCS#8 PEM).
4. **Drop the `procurement-pulse-action` GitHub Action** into your CI to see your current score privately before August 15 publishes it publicly.

You don't need our help to do any of this — every spec, every artifact, every reference implementation is open-source under the [Kinetic Gain Suite](https://suite.kineticgain.com).

---

## For HealthTech buyers reading this

The fastest way to use this spotlight today:

1. Apply the **4 HealthTech-weighted axes** above to your current vendor evaluation.
2. Where vendors score low on `audit_stream.verify_endpoint` or `signing.public_key_url`, ask them in your security review: *"What would it take to publish these for our renewal?"* Their answer is signal.
3. Wait for **Issue #5 on August 15** for the public per-vendor scoreboard.
4. Use the [browser inspector tool](https://github.com/mizcausevic-dev/vendor-ai-disclosure-inspector) on individual vendor sites to spot-check disclosure presence before sending an RFP.

The Pulse program isn't a vendor scorecard — it's a *yardstick*. The yardstick is open and measurable. Apply it however helps.

---

*Spotlight published 2026-05-31 between Issue #4 (locked baseline, 899 vendors) and Issue #5 (scheduled Aug 15). Engine v0.4. ed25519-signed engine outputs land in Issue #5; this spotlight is unsigned analytical content.*

*Signing key index: [`pulse.kineticgain.com/.well-known/pulse-signing.json`](https://pulse.kineticgain.com/.well-known/pulse-signing.json)*
*Methodology: [`ai-procurement-decision-spec`](https://github.com/mizcausevic-dev/ai-procurement-decision-spec)*
*Universe: [`universe.csv`](../../universe.csv) (1,508 domains, 74 HealthTech-classified)*
