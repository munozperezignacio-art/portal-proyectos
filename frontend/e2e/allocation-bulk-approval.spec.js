import {test,expect} from '@playwright/test';
test('selected days can share a reason while keeping their own hours and destinations',async({page})=>{
 await page.goto('/e2e/fixtures/allocation-bulk-approval.html');
 const button=page.getByRole('button',{name:'Aprobar seleccionados (2) con este motivo'});
 await expect(button).toBeDisabled();
 await page.getByLabel('Motivo común de aprobación').fill('Revisado con supervisión');
 await button.click();
 const decisions=await page.evaluate(()=>window.decisions);
 expect(decisions.map(d=>d.comentario)).toEqual(['Revisado con supervisión','Revisado con supervisión']);
 expect(decisions.map(d=>d.centro_id)).toEqual([10,20]);expect(decisions.map(d=>d.horas_extra)).toEqual([1,2]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
