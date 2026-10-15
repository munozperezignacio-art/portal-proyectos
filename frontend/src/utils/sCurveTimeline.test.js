import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarTimeline, calendarLabelIndices } from './sCurveTimeline.js';

test('includes weekends, holidays and cutoff instead of stopping at last weekly milestone', () => {
  const days = calendarTimeline('2026-09-28','2026-10-15');
  assert.equal(days.length,18);
  assert.equal(days.at(-1).dateStr,'2026-10-15');
  assert.ok(days.some(d => d.dateStr === '2026-10-12'));
  assert.ok(days.some(d => d.dateStr === '2026-10-11'));
});
test('handles leap days and DST without skipped dates', () => {
  assert.equal(calendarTimeline('2024-02-28','2024-03-01').length,3);
  assert.equal(calendarTimeline('2026-09-01','2026-09-30').length,30);
  assert.equal(calendarTimeline('2026-04-01','2026-04-30').length,30);
});
test('invalid, reversed and single day ranges', () => {
  assert.deepEqual(calendarTimeline('2026-02-30','2026-03-01'),[]);
  assert.deepEqual(calendarTimeline('2026-10-16','2026-10-15'),[]);
  assert.equal(calendarTimeline('2026-10-15','2026-10-15').length,1);
});
test('labels retain endpoints and spacing for mobile, desktop and long projects', () => {
  for (const count of [1,2,3,18,30,365,1500]) for (const width of [182,260,430,900]) {
    const indices = calendarLabelIndices(count,width);
    assert.equal(indices[0],0);
    assert.equal(indices.at(-1),count-1);
    for(let i=1;i<indices.length;i++) assert.ok((indices[i]-indices[i-1])*width/(count-1)>=85);
  }
});
