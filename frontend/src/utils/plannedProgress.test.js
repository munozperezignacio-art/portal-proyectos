import test from 'node:test';
import assert from 'node:assert/strict';
import { plannedValueAt, physicalProgressAt } from './plannedProgress.js';
import { calendarTimeline } from './sCurveTimeline.js';

test('weighted plan uses resolved schedule and preserves one decimal', () => {
  const items = [
    { start:'2026-07-01', duration:100, quantity:300, unitPrice:100 },
    { start:'2026-08-01', duration:100, quantity:700, unitPrice:100 }
  ];
  const days = start => start === '2026-07-01' ? 60 : 37;
  const cutoff = '2026-10-15';
  const executive = plannedValueAt(items,cutoff,days);
  const curve = calendarTimeline('2026-09-28',cutoff).map(d => plannedValueAt(items,d.dateStr,days));
  assert.equal(executive,43900);
  assert.equal(curve.at(-1),executive);
  assert.equal((executive/100000*100).toFixed(1),'43.9');
});
test('future dependent tasks do not advance and completed tasks cap at full value', () => {
  const items = [{start:'2026-10-20',duration:5,quantity:10,unitPrice:500}];
  assert.equal(plannedValueAt(items,'2026-10-15',()=>10),0);
  assert.equal(plannedValueAt(items,'2026-10-30',()=>10),5000);
});

test('physical variance distinguishes units, percentage points and plan compliance', () => {
  const result = physicalProgressAt({ quantity: 200, executed: 80, start: '2026-10-01', duration: 10 }, '2026-10-06', () => 5);
  assert.equal(result.planned, 100);
  assert.equal(result.actualPct, 40);
  assert.equal(result.difference, -20);
  assert.equal(result.differencePct, -10);
  assert.equal(result.planCompliance, 80);
  assert.equal(result.remaining, 120);
});

test('physical progress handles missing/future schedules and actual overproduction', () => {
  const item = { quantity: 100, executed: 120, start: '2026-10-20', duration: 5 };
  const result = physicalProgressAt(item, '2026-10-30', () => 20);
  assert.equal(result.planned, 100);
  assert.equal(result.actualPct, 120);
  assert.equal(result.difference, 20);
  assert.equal(result.remaining, 0);
  assert.equal(result.excess, 20);
  assert.equal(physicalProgressAt(item, '2026-10-01', () => 0).planCompliance, null);
  assert.equal(physicalProgressAt({ ...item, start: null }, '2026-10-30', () => 20).difference, null);
  assert.equal(physicalProgressAt({ ...item, quantity: 0 }, '2026-10-30', () => 20).actualPct, null);
});
