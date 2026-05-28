# Repo primitive justification template (anti-overlap discipline)

**Per the v2 repo-strategy matrix.** Every new operator-surface repo writes this 6-field justification in (a) the PR description that opens the repo, and (b) the repo's `CHANGELOG.md` v0.1.0 entry. Codex flagged this as the operational guardrail against "same surface, different wrapper" drift across the 370+ existing repos.

## The 6 fields

| Field | Example |
|---|---|
| **Core primitive** | "Workflow inventory + identity-grant audit on Camunda 8 deployments" |
| **Target buyer** | "Platform Eng lead at a regulated-industry company running Camunda 8 in prod" |
| **Target platform** | "Camunda 8 / Zeebe REST API" |
| **Monetization tier path** | "Tier 1 now · Tier 2 planned · Tier 3 contingent on EIN→Stripe · Tier 4 by engagement" |
| **Nearest existing repo** | "`regulatory-comment-intelligence-hub` (workflow-shaped but for GovTech intake, different buyer)" |
| **Why this is distinct** | "Camunda is the build-and-run target; the nearest existing repo measures government-comment workflows externally, not BPMN inventory inside an enterprise's own Camunda instance" |

## Copy-paste template

```markdown
## Repo primitive justification (v2 anti-overlap)

| Field | Answer |
|---|---|
| Core primitive | _<one-line description of what this surface does>_ |
| Target buyer | _<role + industry + scale, e.g. "CISO at a 500+ FTE B2B SaaS shipping AI features">_ |
| Target platform | _<exact platform + API name + auth model>_ |
| Monetization tier path | _<which of free / template / hosted / KGE are real now vs planned>_ |
| Nearest existing repo | _<closest repo in the portfolio + how it differs>_ |
| Why this is distinct | _<2-3 sentences — what would have to change about the nearest existing repo to cover this, and why that's the wrong shape>_ |
```

## How this gets enforced

1. **In the PR description** — when Codex opens the v0.1 PR for the new repo, the description starts with this block.
2. **In CHANGELOG.md v0.1.0 entry** — the same block lives in the repo permanently.
3. **In the README header** (optional) — if the framing is non-obvious, paste a one-line distilled version near the top.

## Auto-prompting via GitHub PR template (not yet enabled)

To make GitHub auto-prompt this template every time a PR is opened on any `mizcausevic-dev/*` repo without its own template, create the user-level community health repo:

```bash
# Requires explicit Miz authorization per feedback_public_repo_authorization
gh repo create mizcausevic-dev/.github --public \
  --description "Default community health files for mizcausevic-dev repos" \
  --homepage "https://kineticgain.com/"

# Then commit this template as the default PR template:
# .github/PULL_REQUEST_TEMPLATE.md
```

Until that repo exists, each new repo can ship its own `.github/PULL_REQUEST_TEMPLATE.md` containing the copy-paste block above.

## Worked example (recorded for replay)

The first repo to use this discipline was `ibm-watsonx-governance-bridge` (Phase 0 anchor #1, v1.0-prod 2026-05-28). The justification was:

| Field | Answer |
|---|---|
| Core primitive | Request-time enforcement of an AI Procurement Decision Card in front of watsonx.ai |
| Target buyer | CISO / CTO / Platform Eng at an enterprise running watsonx in prod |
| Target platform | IBM watsonx.ai (text/chat endpoints) + IBM Cloud IAM auth |
| Monetization tier path | Tier 1 now · Tier 2 planned · Tier 3 contingent on EIN→Stripe · Tier 4 by engagement |
| Nearest existing repo | `azure-openai-governance-bridge` (same primitive, Azure upstream); `mcp-permission-broker` (same primitive, MCP transport) |
| Why distinct | Different upstream (watsonx vs Azure OpenAI vs MCP), different auth (IBM Cloud IAM vs api-key vs MCP session), different governance objects exposed (model cards from watsonx Governance, not Azure deployment metadata) |
