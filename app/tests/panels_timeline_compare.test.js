'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('../js/core/net.js');
const model = require('../js/core/model.js');
require('../js/core/bus.js');
const registry = require('../js/core/registry.js');
require('../js/core/store.js');
const engine = require('../js/core/engine.js');
const eventTimeline = require('../js/modules/timeline/event_timeline.js');
const baselineCompare = require('../js/modules/compare/baseline_compare.js');
require('../scenarios/ref_hai_router.js');

describe('eventTimeline: filterEvents', () => {
  const events = [
    { type: 'arp.request', deviceIds: ['laptop1', 'r1'], linkIds: [], severity: 'info', confirmed: true, tSim: 10, stepIndex: 1 },
    { type: 'route.match', deviceIds: ['r1'], linkIds: ['l_r1_r2_chinh'], severity: 'success', confirmed: true, tSim: 20, stepIndex: 2 },
    { type: 'link.state', deviceIds: ['r1', 'r2'], linkIds: ['l_r1_r2_chinh'], severity: 'fail', confirmed: true, tSim: 30, stepIndex: 3 },
    { type: 'forward.fail', deviceIds: ['r2'], linkIds: [], severity: 'fail', confirmed: false, tSim: 40, stepIndex: 4 },
    { type: 'recovered', deviceIds: ['laptop1'], linkIds: [], severity: 'success', confirmed: true, tSim: 50, stepIndex: 5 }
  ];

  test('lọc theo deviceId', () => {
    const out = eventTimeline.filterEvents(events, { deviceId: 'r1' });
    assert.equal(out.length, 3);
  });

  test('lọc category arp', () => {
    const out = eventTimeline.filterEvents(events, { category: 'arp' });
    assert.equal(out.length, 1);
    assert.equal(out[0].type, 'arp.request');
  });

  test('lọc category route (bao gồm recovered)', () => {
    const out = eventTimeline.filterEvents(events, { category: 'route' });
    assert.equal(out.length, 2);
  });

  test('lọc category link', () => {
    const out = eventTimeline.filterEvents(events, { category: 'link' });
    assert.equal(out.length, 1);
    assert.equal(out[0].type, 'link.state');
  });

  test('lọc category fault', () => {
    const out = eventTimeline.filterEvents(events, { category: 'fault' });
    assert.equal(out.length, 2);
  });

  test('lọc severity normal/fail/unconfirmed', () => {
    assert.equal(eventTimeline.filterEvents(events, { severity: 'normal' }).length, 3);
    assert.equal(eventTimeline.filterEvents(events, { severity: 'fail' }).length, 2);
    assert.equal(eventTimeline.filterEvents(events, { severity: 'unconfirmed' }).length, 1);
  });

  test('kết hợp deviceId + category + severity', () => {
    const out = eventTimeline.filterEvents(events, { deviceId: 'r2', category: 'fault', severity: 'unconfirmed' });
    assert.equal(out.length, 1);
  });

  test('filterEvents trên trace thực của ref_hai_router', () => {
    const state = registry.loadScenario('ref_hai_router', 'binh_thuong');
    const trace = engine.build(state, { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });
    const all = eventTimeline.filterEvents(trace.events, {});
    assert.equal(all.length, trace.events.length);
    const fails = eventTimeline.filterEvents(trace.events, { severity: 'fail' });
    assert.ok(Array.isArray(fails));
  });
});

describe('eventTimeline: đăng ký panel và xuất helper', () => {
  test('đăng ký panel_event_timeline', () => {
    assert.equal(typeof eventTimeline.filterEvents, 'function');
    const panel = registry.listPanels().find((p) => p.id === 'panel_event_timeline');
    assert.ok(panel, 'panel_event_timeline phải được đăng ký');
    assert.equal(panel.title, 'Dòng thời gian sự kiện (Network Event Timeline)');
  });
});

describe('baselineCompare: compareBaselineAndVariant trên ref_hai_router', () => {
  test('cơ sở vs ngat_lien_ket_chinh', () => {
    const result = baselineCompare.compareBaselineAndVariant('ref_hai_router', 'ngat_lien_ket_chinh');
    assert.equal(Array.isArray(result.pathBefore), true);
    assert.deepEqual(result.pathBefore, ['laptop1', 'r1', 'r2', 'srv1', 'r2', 'r1', 'laptop1']);
    assert.deepEqual(result.pathAfter, ['laptop1', 'r1']);
    assert.equal(result.statusBefore, 'ok');
    assert.equal(result.statusAfter, 'fail');
    assert.equal(result.totalCostBefore, 3);
    assert.equal(result.totalCostAfter, 1);
    assert.ok(result.affectedLinks.indexOf('l_r1_r2_chinh') !== -1);
  });

  test('cơ sở vs thieu_tuyen_ve_r2', () => {
    const result = baselineCompare.compareBaselineAndVariant('ref_hai_router', 'thieu_tuyen_ve_r2');
    assert.equal(result.statusBefore, 'ok');
    assert.equal(result.statusAfter, 'không nhận được phản hồi');
    assert.deepEqual(result.pathAfter, ['laptop1', 'r1', 'r2', 'srv1', 'r2', 'laptop1']);
    assert.ok(result.routingDiffs.length > 0);
  });

  test('cơ sở vs binh_thuong (không khác biệt)', () => {
    const result = baselineCompare.compareBaselineAndVariant('ref_hai_router', 'binh_thuong');
    assert.deepEqual(result.pathBefore, result.pathAfter);
    assert.equal(result.statusBefore, result.statusAfter);
    assert.equal(result.affectedLinks.length, 0);
  });

  test('chấp nhận scenario object và action tùy chỉnh', () => {
    const sc = registry.getScenario('ref_hai_router');
    const result = baselineCompare.compareBaselineAndVariant(sc, 'ngat_lien_ket_chinh', { type: 'ping', from: 'laptop1', to: 'srv1', ttl: 64 });
    assert.equal(result.scenarioId, 'ref_hai_router');
    assert.equal(result.variantId, 'ngat_lien_ket_chinh');
    assert.ok(result.hopCountBefore > result.hopCountAfter);
  });

  test('đăng ký panel_baseline_compare', () => {
    const panel = registry.listPanels().find((p) => p.id === 'panel_baseline_compare');
    assert.ok(panel, 'panel_baseline_compare phải được đăng ký');
    assert.equal(panel.title, 'So sánh cơ sở và sự cố (Baseline vs Failure)');
  });
});