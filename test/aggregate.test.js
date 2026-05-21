import { test } from "node:test";
import assert from "node:assert/strict";

import { aggregate } from "../src/aggregate.mjs";

const universe = [
  { domain: "a.com", vertical: "AI Platform" },
  { domain: "b.com", vertical: "AI Platform" },
  { domain: "c.com", vertical: "EdTech" },
];

function probe(score, tier, published, foundSlugs = []) {
  const documents = {};
  for (const s of foundSlugs) documents[s] = { found: true };
  return { score, tier, published, documents };
}

test("all-zero universe → 0% headline, 0 avg", () => {
  const probes = [probe(0, "none", []), probe(0, "none", []), probe(0, "none", [])];
  const r = aggregate(universe, probes, { issue: "test" });
  assert.equal(r.headline.domainsPublishingAny, 0);
  assert.equal(r.headline.publicationRate, 0);
  assert.equal(r.headline.avgScore, 0);
  assert.equal(r.universe.total, 3);
  assert.equal(r.universe.verticals, 2);
});

test("mixed universe rolls up per-vertical correctly", () => {
  const probes = [
    probe(100, "comprehensive", ["aeo", "agents"], ["aeo", "agents"]),
    probe(0, "none", []),
    probe(36, "partial", ["aeo"], ["aeo"]),
  ];
  const r = aggregate(universe, probes, { issue: "test" });
  // 2 of 3 publish something
  assert.equal(r.headline.domainsPublishingAny, 2);
  assert.equal(r.headline.publicationRate, 0.6667);
  // AI Platform: 1 of 2 publish
  assert.equal(r.byVertical["AI Platform"].publicationRate, 0.5);
  assert.equal(r.byVertical["AI Platform"].avgScore, 50);
  // EdTech: 1 of 1 publish
  assert.equal(r.byVertical["EdTech"].publicationRate, 1);
  // aeo published by 2 domains
  assert.equal(r.bySpec.aeo.publishers, 2);
  assert.equal(r.bySpec.agents.publishers, 1);
});

test("leaderboard is sorted by score desc", () => {
  const probes = [probe(10, "minimal", ["aeo"]), probe(90, "comprehensive", ["aeo"]), probe(50, "partial", ["aeo"])];
  const r = aggregate(universe, probes, { issue: "test" });
  assert.deepEqual(r.leaderboard.map((x) => x.score), [90, 50, 10]);
});

test("empty universe is safe", () => {
  const r = aggregate([], [], { issue: "test" });
  assert.equal(r.headline.publicationRate, 0);
  assert.equal(r.universe.total, 0);
});
