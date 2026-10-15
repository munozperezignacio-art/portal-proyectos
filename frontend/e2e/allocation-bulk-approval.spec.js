import {test,expect} from '@playwright/test';
test('selected days can share a reason while keeping their own hours and destinations',async({page})=>{
 await page.goto('/e2e/fixtures/allocation-bulk-approval.html');
 const button=page.getByRole('button',{name:'Aprobar seleccionados (2) con este motivo'});
 await expect(button).toBeDisabled();
 await page.getByLabel('Motivo común de aprobación').fill('Revisado con supervisión');
 await button.click();
 await expect(page.getByRole('group',{name:'Confirmar aprobación del lote'})).toBeVisible();
 await page.getByRole('button',{name:'Confirmar aprobación',exact:true}).click();
 const decisions=await page.evaluate(()=>window.decisions);
 expect(decisions.map(d=>d.comentario)).toEqual(['Revisado con supervisión','Revisado con supervisión']);
 expect(decisions.map(d=>d.centro_id)).toEqual([10,20]);expect(decisions.map(d=>d.horas_extra)).toEqual([1,2]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('full approval saves only past dates without native confirm and preserves each decision',async({page})=>{
 await page.goto('/e2e/fixtures/personnel-allocations.html');
 await page.getByLabel('Seleccionar pendientes filtrados').check();
 await expect(page.getByLabel('Seleccionar día 2099-01-01',{exact:true})).toBeDisabled();
 await page.getByLabel('Motivo común de aprobación').fill('Marcaje manual');
 await page.getByRole('button',{name:'Aprobar seleccionados (2) con este motivo',exact:true}).click();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 expect(await page.evaluate(()=>window.approvalCalls.length)).toBe(0);
 await page.getByRole('button',{name:'Aprobar seleccionados (2) con este motivo',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar aprobación',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('2 cargos aprobados');
 const calls=await page.evaluate(()=>window.approvalCalls);
 expect(calls).toHaveLength(1);
 expect(calls[0].p_decisiones.map(d=>d.comentario)).toEqual(['Marcaje manual','Marcaje manual']);
 expect(calls[0].p_decisiones.map(d=>d.horas_extra)).toEqual([1,2]);
 expect(calls[0].p_decisiones.map(d=>d.centro_id)).toEqual([10,20]);
});

test('automatic costing shows references and no required monthly setup',async({page})=>{
 await page.goto('/e2e/fixtures/personnel-allocations.html?scenario=automatic');
 await expect(page.getByText('Costeo automático listo',{exact:true})).toBeVisible();
 await expect(page.getByText(/no incluye la tasa adicional particular de mutualidad/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Guardar configuración excepcional',exact:true})).not.toBeVisible();
 await page.getByLabel('Seleccionar pendientes filtrados').check();
 await page.getByLabel('Motivo común de aprobación').fill('Marcajes revisados');
 await page.getByRole('button',{name:'Aprobar seleccionados (2) con este motivo',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar aprobación',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('2 cargos aprobados');
});

for(const scenario of ['missing-cost','server-error'])test(`approval shows ${scenario} next to the button without clearing selection`,async({page})=>{
 await page.goto(`/e2e/fixtures/personnel-allocations.html?scenario=${scenario}`);
 await page.getByLabel('Seleccionar pendientes filtrados').check();
 await page.getByLabel('Motivo común de aprobación').fill('Marcaje manual');
 await page.getByRole('button',{name:'Aprobar seleccionados (2) con este motivo',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar aprobación',exact:true}).click();
 await expect(page.getByRole('status')).toContainText(scenario==='missing-cost'?'ficha del trabajador':'Cambió la asistencia');
 await expect(page.getByRole('button',{name:'Aprobar seleccionados (2) con este motivo',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>window.approvalCalls.length)).toBe(scenario==='missing-cost'?0:1);
});
