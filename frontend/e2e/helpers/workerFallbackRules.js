import {expect} from '@playwright/test';
export async function checkWorkerFallbackRules(page){
 await page.goto('/e2e/fixtures/worker-fallback-rules.html');
 await expect(page.getByLabel('Trabajador de la regla')).toBeEnabled();
 await page.getByLabel('Trabajador de la regla').selectOption('1');
 await page.getByLabel('Centro de respaldo').selectOption('10');
 await page.getByLabel('Regla vigente desde').fill('2026-10-18');
 await page.getByLabel('Hora de cierre de la regla').fill('19:30');
 await page.getByLabel('Sábado',{exact:true}).check();
 await page.getByRole('button',{name:'Guardar regla del trabajador'}).click();
 await expect(page.getByText('Regla guardada.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>window.calls[0])).toEqual({name:'guardar_regla_sin_asistencia',args:{p_empresa:'Prueba',p_trabajador:1,p_centro:10,p_desde:'2026-10-18',p_hasta:null,p_dias:[1,2,3,4,5,6],p_hora:'19:30',p_activa:true}});
 await page.getByLabel('Trabajador de la regla').selectOption('2');
 await expect(page.getByLabel('Centro de respaldo')).toHaveValue('');
 await page.getByLabel('Centro de respaldo').selectOption('20');
 await page.getByRole('button',{name:'Guardar regla del trabajador'}).click();
 await expect.poll(()=>page.evaluate(()=>window.rules.length)).toBe(2);
 await page.getByRole('button',{name:'Editar regla'}).first().click();
 await expect(page.getByLabel('Centro de respaldo')).toHaveValue('10');
 await page.getByLabel('Regla activa',{exact:true}).uncheck();
 await page.getByRole('button',{name:'Guardar regla del trabajador'}).click();
 await expect.poll(()=>page.evaluate(()=>window.rules.find(rule=>rule.trabajador_id===1).activa)).toBe(false);
 expect(await page.evaluate(()=>window.rules.length)).toBe(2);
 await page.evaluate(()=>{window.fail=true;});
 await page.getByRole('button',{name:'Guardar regla del trabajador'}).click();
 await expect(page.getByRole('status')).toHaveText('Error simulado de guardado');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
}
export async function checkWorkerFallbackReadOnly(page){
 await page.goto('/e2e/fixtures/worker-fallback-rules.html?readonly');
 await expect(page.getByLabel('Trabajador de la regla')).toBeDisabled();
 await expect(page.getByRole('button',{name:'Guardar regla del trabajador'})).toBeDisabled();
 expect(await page.evaluate(()=>window.calls.length)).toBe(0);
}
