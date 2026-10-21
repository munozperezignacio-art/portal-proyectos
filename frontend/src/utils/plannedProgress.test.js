import test from 'node:test';
import assert from 'node:assert/strict';
import { plannedValueAt, physicalProgressAt, dailyBudgetRate, plannedCurveFinish } from './plannedProgress.js';
import { calendarTimeline } from './sCurveTimeline.js';

test('curve extends until 100 percent using the same working-day production rate', () => {
  const working = d => ![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay()) && d !== '2026-10-12';
  const add = (start, days) => calendarTimeline(start,'2026-12-31').filter(d=>working(d.dateStr))[days-1].dateStr;
  const count = (start,end) => calendarTimeline(start,end).filter(d=>working(d.dateStr)).length;
  const items=[{start:'2026-10-09',quantity:100,dailyRate:20,duration:20,unitPrice:10}];
  const finish=plannedCurveFinish(items,'2026-10-09',add);
  assert.equal(finish,'2026-10-16');
  assert.equal(plannedValueAt(items,finish,count),1000);
  assert.equal(plannedValueAt(items,'2026-10-09',count),200);
  assert.equal(plannedCurveFinish(items,'2026-10-20',add),'2026-10-20');
});

test('curve includes later dependent starts and uses duration without daily rate',()=>{
 const add=(start,days)=>calendarTimeline(start,'2026-12-31')[days-1].dateStr;
 assert.equal(plannedCurveFinish([{start:'2026-11-01',quantity:10,duration:5}], '2026-10-21',add),'2026-11-05');
 assert.equal(plannedCurveFinish([{quantity:10}], '2026-10-21',add),'2026-10-21');
});

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

test('budgeted 20 units per day produces 260 at day 13 and caps the final partial day', () => {
  const item = {quantity:463,executed:168,start:'2026-10-01',duration:24,dailyRate:20,unitPrice:100};
  const result = physicalProgressAt(item,'2026-10-20',()=>13);
  assert.equal(result.planned,260);
  assert.equal(result.difference,-92);
  assert.equal(plannedValueAt([item],'2026-10-20',()=>13),26000);
  assert.equal(physicalProgressAt(item,'2026-11-01',()=>23).planned,460);
  assert.equal(physicalProgressAt(item,'2026-11-02',()=>24).planned,463);
  assert.equal(physicalProgressAt(item,'2026-10-01',()=>0).planned,0);
  assert.equal(dailyBudgetRate({rendimiento:20,unidad_tiempo:'Día'}),20);
  assert.equal(dailyBudgetRate({rendimiento:20,unidad_tiempo:'Hora'}),null);
});
