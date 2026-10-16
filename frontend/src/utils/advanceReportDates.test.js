import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceReportDay,advanceReportDateLabel,filterAdvanceReports} from './advanceReportDates.js';
const reports=[{id:1,created_at:'2026-09-30T12:00:00Z'},{id:2,created_at:'2026-10-06T12:00:00Z'},{id:3,fecha:'2026-10-01',created_at:'2026-10-15T19:00:00Z'},{id:4,fecha_avance:'2026-10-06',created_at:'2026-10-16T00:00:00Z'},{id:5}];
test('sorts by worked report date descending, not formatted text or insertion order, without mutating sources',()=>{
 assert.deepEqual(filterAdvanceReports(reports).map(r=>r.id),[4,2,3,1,5]);
 assert.deepEqual(filterAdvanceReports(reports,{order:'asc'}).map(r=>r.id),[1,3,4,2,5]);
 assert.deepEqual(reports.map(r=>r.id),[1,2,3,4,5]);
});
test('exact date search includes all reports of that day, and clear restores all',()=>{
 assert.deepEqual(filterAdvanceReports(reports,{date:'2026-10-06'}).map(r=>r.id),[4,2]);
 assert.equal(filterAdvanceReports(reports,{date:'2026-10-07'}).length,0);
 assert.equal(filterAdvanceReports(reports,{date:''}).length,5);
});
test('day-only dates never shift with timezone and missing dates are not falsely marked today',()=>{
 assert.equal(advanceReportDateLabel(reports[2]),'01-10-2026');
 assert.equal(advanceReportDateLabel({}),'Sin fecha');
 assert.equal(advanceReportDay({fecha:'2026-02-30',fecha_avance:'2026-10-01'}),'2026-10-01');
 assert.equal(advanceReportDay({created_at:'2026-10-06T00:30:00Z'}),'2026-10-06');
});
