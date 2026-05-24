import { test } from "node:test";
import assert from "node:assert/strict";

import { driftAggregate, driftDomains } from "../src/drift.mjs";

const prev = {
  issue: "issue-1",
  universe: { total: 37, verticals: 9 },
  headline: { domainsPublishingAny: 0, publicationRate: 0, avgScore: 0 },
  signatures: { verifiedRate: 0 },
  byVertical: { "AI Platform": { domains: 9, publicationRate: 0, avgScore: 0 } },
  bySpec: { aeo: { label: "AEO Protocol", publishers: 0, rate: 0, verified: 0 } },
};

const curr = {
  issue: "issue-2",
  universe: { total: 350, verticals: 18 },
  headline: { domainsPublishingAny: 1, publicationRate: 0.0029, avgScore: 0.3 },
  signatures: { verifiedRate: 0.5 },
  byVertical: {
    "AI Platform": { domains: 40, publicationRate: 0, avgScore: 0 },
    "Legal AI": { domains: 12, publicationRate: 0, avgScore: 0 },
  },
  bySpec: { aeo: { label: "AEO Protocol", publishers: 1, rate: 0.0029, verified: 1 } },
};

test("driftAggregate computes headline + spec deltas", () => {
  const d = driftAggregate(prev, curr);
  assert.equal(d.from, "issue-1");
  assert.equal(d.to, "issue-2");
  assert.equal(d.headline.universeTotalDelta, 313);
  assert.equal(d.headline.domainsPublishingAnyDelta, 1);
  assert.equal(d.headline.verifiedRateDelta, 0.5);
  assert.equal(d.bySpec.aeo.publishersDelta, 1);
  assert.equal(d.bySpec.aeo.verifiedDelta, 1);
});

test("driftAggregate flags new vs changed verticals", () => {
  const d = driftAggregate(prev, curr);
  assert.equal(d.byVertical["Legal AI"].status, "new");
  assert.equal(d.byVertical["AI Platform"].status, "changed");
  assert.equal(d.byVertical["AI Platform"].domainsDelta, 31);
});

test("driftDomains finds movers + newly publishing", () => {
  const prevRaw = [
    { domain: "a.com", score: 0, published: [], signatures: { verified: 0 } },
    { domain: "b.com", score: 100, published: ["aeo"], signatures: { verified: 1 } },
  ];
  const currRaw = [
    { domain: "a.com", score: 9, published: ["aeo"], signatures: { verified: 1 } },
    { domain: "b.com", score: 100, published: ["aeo"], signatures: { verified: 1 } },
  ];
  const d = driftDomains(prevRaw, currRaw);
  assert.equal(d.newlyPublishing, 1);
  assert.equal(d.stoppedPublishing, 0);
  assert.equal(d.changed, 1);
  assert.equal(d.movers[0].domain, "a.com");
  assert.deepEqual(d.movers[0].gainedSpecs, ["aeo"]);
  assert.equal(d.movers[0].delta, 9);
  assert.equal(d.movers[0].verifiedDelta, 1);
});

test("driftDomains: unchanged domains are omitted", () => {
  const same = [{ domain: "x.com", score: 50, published: ["aeo"], signatures: { verified: 0 } }];
  const d = driftDomains(same, same);
  assert.equal(d.changed, 0);
  assert.equal(d.movers.length, 0);
});
