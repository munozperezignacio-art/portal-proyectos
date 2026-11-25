import test from 'node:test';
import assert from 'node:assert/strict';
import {previousReportDay,reportDateMessage} from './reportDateCheck.js';
test('missing previous day warning includes selected date and equipment',()=>{
 assert.equal(previousReportDay('2026-11-25'),'2026-11-24');
 const message=reportDateMessage('2026-11-25',false,'EXC-04');
 assert.match(message,/EXC-04/);assert.match(message,/24\/11\/2026/);assert.match(message,/25\/11\/2026/);assert.match(message,/No hay reporte/);
});
test('existing and unavailable history are not described as missing',()=>{
 assert.doesNotMatch(reportDateMessage('2026-11-25',true,'EXC-04'),/No hay reporte/);
 assert.match(reportDateMessage('2026-11-25',null,'EXC-04'),/No se pudo comprobar/);
 assert.equal(previousReportDay('2026-12-01'),'2026-11-30');
 assert.equal(previousReportDay('2026-01-01'),'2025-12-31');
});
