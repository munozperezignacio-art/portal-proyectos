import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDelay} from './scheduleDelay.js';
const part=(id,start,duration,delay=0,extra={})=>({id,name:id,start,duration,delay,...extra});
test('130 units / 20 per day retains 6.5 days on critical path',()=>{
 const r=scheduleDelay([part('a',0,20,130/20),part('b',20,5,0,{predecessor:'a'})]);
 assert.equal(r.delay,6.5);assert.equal(r.rows[0].critical,true);
});
test('parallel local delay consumes float without delaying project',()=>{
 const r=scheduleDelay([part('a',0,20),part('b',0,10,6.5)]);
 assert.equal(r.delay,0);assert.equal(r.rows[1].float,10);assert.equal(r.rows[1].impact,0);
});
test('parallel delays use maximum and upstream delay is not counted twice',()=>{
 assert.equal(scheduleDelay([part('a',0,20,6.5),part('b',0,20,4)]).delay,6.5);
 assert.equal(scheduleDelay([part('a',0,20,6.5),part('b',20,5,6.5,{predecessor:'a'})]).delay,6.5);
});
test('noncritical activity can consume float and affect completion',()=>{
 const r=scheduleDelay([part('a',0,20),part('b',0,10,12)]);
 assert.equal(r.delay,2);assert.equal(r.rows[1].impact,2);
});
test('SS is not a finish dependency',()=>{
 const r=scheduleDelay([part('a',0,10,4),part('b',0,20,0,{predecessor:'a',relation:'SS',started:true})]);
 assert.equal(r.delay,0);
});
test('finish links and lag propagate through the network',()=>{
 const r=scheduleDelay([part('a',0,10,3),part('b',7,5,0,{predecessor:'a',relation:'FF',lag:2})]);
 assert.equal(r.delay,3);assert.equal(r.rows[0].critical,true);
 const sf=scheduleDelay([part('a',5,2),part('b',0,5,0,{predecessor:'a',relation:'SF'})]);
 assert.equal(sf.delay,0);
});
test('missing dependencies, cycles and invalid rate do not claim on time',()=>{
 assert.equal(scheduleDelay([part('a',0,10,0,{predecessor:'missing'})]).delay,null);
 assert.equal(scheduleDelay([part('a',0,10,0,{predecessor:'b'}),part('b',0,10,0,{predecessor:'a'})]).delay,null);
 assert.equal(scheduleDelay([part('a',0,10,NaN)]).delay,null);
});
