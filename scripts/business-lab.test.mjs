import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, EXAMPLES } from '../src/tools/catalog-business-lab.js';

const expected = {
  business_hourly_floor: ['hourlyFloor', 50],
  business_project_quote: ['quote', 660],
  business_capacity_plan: ['wholeProjects', 6],
  business_revenue_target: ['leads', 32],
  business_break_even: ['breakEvenUnits', 25],
  business_margin_price: ['price', 100],
  business_discount_impact: ['volumeMultiplier', 1.5],
  business_payment_fee_price: ['charge', 100],
  business_retainer_usage: ['total', 1375],
  business_scope_change: ['addedPrice', 660],
  business_pert_estimate: ['standardDeviation', 2],
  business_utilization: ['billablePct', 50],
  business_pipeline_forecast: ['weightedRevenue', 1250],
  business_funnel_forecast: ['expectedFinal', 5],
  business_acquisition_cost: ['loadedCAC', 150],
  business_customer_payback: ['paybackMonths', 5],
  business_churn_cohort: ['endingCustomers', 81],
  business_repeat_purchase_value: ['contributionAfterAcquisition', 100],
  business_offer_compare: ['ranked.0.contributionPerHour', 80],
  business_client_concentration: ['largestSharePct', 60],
  business_cash_runway: ['runwayMonths', 4],
  business_cash_schedule: ['fundingGap', 300],
  business_invoice_aging: ['buckets.days31to60', 200],
  business_milestone_payments: ['milestones.1.amount', 700],
  business_budget_variance: ['totalRemaining', -20],
  business_outsource_compare: ['savings', 100],
  business_hiring_capacity: ['additionalWorkers', 2],
  business_meeting_cost: ['totalCost', 180],
  business_inventory_reorder: ['reorderPoint', 100],
  business_batch_cost: ['unitCost', 6],
  business_shipping_subsidy: ['contribution', 49.85],
  business_refund_exposure: ['retainedRevenue', 4500],
  business_bundle_economics: ['contribution', 60],
  business_commission_plan: ['commission', 100],
  business_ad_break_even: ['breakEvenROAS', 2],
  creator_campaign_budget: ['channels.1.budget', 750],
  creator_content_mix: ['pillars.0.posts', 7],
  creator_production_capacity: ['assetsPerWeek', 16],
  creator_repurpose_matrix: ['totalAssets', 3],
  creator_publishing_queue: ['backlog.0', 'B'],
  creator_campaign_metrics: ['costPerConversion', 5],
  creator_engagement_audit: ['ranked.0.engagementPct', 10],
  creator_video_retention: ['finalRetentionPct', 40],
  creator_sponsorship_quote: ['quote', 450],
  creator_email_performance: ['unsubscribePct', 1],
  creator_webinar_forecast: ['contribution', 600],
  creator_launch_pacing: ['requiredDailySales', 10],
  business_priority_score: ['ranked.0.score', 10],
  business_risk_reserve: ['expectedCost', 100],
  business_workload_balance: ['totalOverloadHours', 10]
};
const run = async (name, input) => JSON.parse(await TOOLS.find(t => t.name === name).run({}, input));
test('50 unique business and creator tools have complete public examples and value tests', () => {
  assert.equal(TOOLS.length, 50);
  assert.equal(new Set(TOOLS.map(t => t.name)).size, 50);
  assert.deepEqual(Object.keys(expected).sort(), TOOLS.map(t => t.name).sort());
});
for (const tool of TOOLS) {
  test(`${tool.name}: expected result and deterministic non-mutating execution`, async () => {
    const example = structuredClone(EXAMPLES[tool.name]);
    const before = JSON.stringify(example);
    const result = await run(tool.name, example);
    const [path, value] = expected[tool.name];
    const actual = path.split('.').reduce((v, key) => v[key], result);
    if (typeof value === 'number') assert.ok(Math.abs(actual - value) < 1e-7, `${actual} != ${value}`);
    else assert.equal(actual, value);
    assert.equal(result.estimate, true);
    assert.deepEqual(await run(tool.name, example), result);
    assert.equal(JSON.stringify(example), before);
    assert.deepEqual(tool.input_examples, [EXAMPLES[tool.name]]);
  });
  test(`${tool.name}: rejects missing, unknown and wrong-type input`, async () => {
    await assert.rejects(tool.run({}, {}));
    await assert.rejects(tool.run({}, { ...EXAMPLES[tool.name], unexpected: 1 }));
    for (const [key, schema] of Object.entries(tool.input_schema.properties)) {
      const bad = schema.type === 'array' ? [] : schema.type === 'string' ? '' : Infinity;
      await assert.rejects(tool.run({}, { ...EXAMPLES[tool.name], [key]: bad }));
      if (schema.type === 'number' || schema.type === 'integer') {
        await assert.rejects(tool.run({}, { ...EXAMPLES[tool.name], [key]: schema.minimum - 1 }));
        await assert.rejects(tool.run({}, { ...EXAMPLES[tool.name], [key]: schema.maximum + 1 }));
        await assert.rejects(tool.run({}, { ...EXAMPLES[tool.name], [key]: '1' }));
      }
    }
  });
}
test('domain relationships reject impossible scenarios', async () => {
  for (const [name, patch] of [
    ['business_capacity_plan', { timeOffHours: 1000 }],
    ['business_pert_estimate', { optimistic: 20 }],
    ['business_utilization', { billableHours: 140 }],
    ['business_milestone_payments', { milestones: [{ name: 'A', percent: 50 }] }],
    ['business_batch_cost', { rejectedUnits: 100 }],
    ['creator_production_capacity', { setupHours: 20 }],
    ['creator_campaign_metrics', { conversions: 101 }],
    ['creator_video_retention', { checkpoints: [{ seconds: 5, viewers: 1 }, { seconds: 1, viewers: 2 }] }],
    ['creator_email_performance', { bounced: 1001 }],
    ['creator_launch_pacing', { elapsedDays: 11 }]
  ]) await assert.rejects(TOOLS.find(t => t.name === name).run({}, { ...EXAMPLES[name], ...patch }));
});
test('nested validation blocks unbounded arrays, strings, fractional counts and unknown fields', async () => {
  const tool = TOOLS.find(t => t.name === 'business_pipeline_forecast');
  for (const deals of [Array(101).fill({ name: 'A', value: 1, probabilityPct: 50 }), [{ name: 'x'.repeat(501), value: 1, probabilityPct: 50 }], [{ name: 'A', value: NaN, probabilityPct: 50 }], [{ name: 'A', value: 1, probabilityPct: 101 }], [{ name: 'A', value: 1, probabilityPct: 50, x: 1 }]]) await assert.rejects(tool.run({}, { deals }));
  await assert.rejects(TOOLS.find(t => t.name === 'business_refund_exposure').run({}, { ...EXAMPLES.business_refund_exposure, orders: 1.5 }));
});
test('unavailable ratios are explicit null, and loss-making operations remain visible', async () => {
  assert.deepEqual(await run('business_break_even', { fixedCosts: 100, price: 10, variableCost: 20 }), { estimate: true, contribution: -10, breakEvenUnits: null, feasible: false });
  assert.equal((await run('business_cash_runway', { cash: 1000, monthlyReceipts: 100, monthlyOutgoings: 100 })).runwayMonths, null);
  assert.equal((await run('creator_campaign_metrics', { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 })).ROAS, null);
});
test('allocation totals reconcile and content queue preserves source order', async () => {
  const payments = await run('business_milestone_payments', { total: 0.01, milestones: [{ name: 'A', percent: 50 }, { name: 'B', percent: 50 }] });
  assert.deepEqual(payments.milestones.map(m => m.amount), [0, 0.01]);
  const mix = await run('creator_content_mix', { postCount: 2, pillars: [{ name: 'A', weight: 1 }, { name: 'B', weight: 1 }, { name: 'C', weight: 1 }] });
  assert.deepEqual(mix.pillars.map(p => p.posts), [1, 1, 0]);
  const queue = await run('creator_publishing_queue', { titles: ['A', 'B'], slots: ['Mon', 'Tue', 'Wed'] });
  assert.deepEqual(queue.scheduled, [{ title: 'A', slot: 'Mon' }, { title: 'B', slot: 'Tue' }]);
  assert.deepEqual(queue.unusedSlots, ['Wed']);
});
