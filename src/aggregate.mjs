/**
 * Aggregate per-domain ProbeResults into a publishable issue dataset.
 * Pure function — no I/O — so it's unit-testable without a network.
 */

import { SUITE_PATHS } from "./probe.mjs";

/**
 * @param {Array<{domain:string, vertical:string}>} universe
 * @param {Array<{score:number, tier:string, published:string[], documents:Record<string,{found:boolean}>}>} probes
 * @param {{ issue:string, concurrency?:number, timeoutMs?:number, generatedAt?:string }} meta
 */
export function aggregate(universe, probes, meta) {
  const specSlugs = Object.keys(SUITE_PATHS);
  const total = universe.length;

  const byVertical = {};
  for (let i = 0; i < universe.length; i++) {
    const v = universe[i].vertical;
    const p = probes[i];
    byVertical[v] ??= { domains: 0, anyPublished: 0, sumScore: 0 };
    byVertical[v].domains += 1;
    byVertical[v].anyPublished += p.published.length > 0 ? 1 : 0;
    byVertical[v].sumScore += p.score;
  }
  for (const v of Object.values(byVertical)) {
    v.publicationRate = +(v.anyPublished / v.domains).toFixed(4);
    v.avgScore = +(v.sumScore / v.domains).toFixed(1);
    delete v.sumScore;
  }

  const bySpec = {};
  for (const slug of specSlugs) {
    const count = probes.filter((p) => p.documents[slug]?.found).length;
    bySpec[slug] = {
      label: SUITE_PATHS[slug].label ?? slug,
      publishers: count,
      rate: total ? +(count / total).toFixed(4) : 0,
    };
  }

  const anyPublished = probes.filter((p) => p.published.length > 0).length;

  return {
    issue: meta.issue,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    methodology: {
      probe: "well-known-probe (vendored from well-known-probe-js)",
      concurrency: meta.concurrency ?? null,
      timeoutMs: meta.timeoutMs ?? null,
      specsChecked: specSlugs.length,
    },
    universe: { total, verticals: Object.keys(byVertical).length },
    headline: {
      domainsPublishingAny: anyPublished,
      publicationRate: total ? +(anyPublished / total).toFixed(4) : 0,
      avgScore: total ? +(probes.reduce((s, p) => s + p.score, 0) / total).toFixed(1) : 0,
    },
    byVertical,
    bySpec,
    leaderboard: universe
      .map((u, i) => ({
        domain: u.domain,
        vertical: u.vertical,
        score: probes[i].score,
        tier: probes[i].tier,
        published: probes[i].published.length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25),
  };
}
