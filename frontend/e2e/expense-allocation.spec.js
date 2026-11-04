import {test,expect} from '@playwright/test';
test('allocates existing expenses without replacing IDs or adding rows',async({page})=>{
 await page.goto('/e2e/fixtures/expense-allocation.html');
 await page.locator('summary').click();
 await page.getByLabel('Seleccionar todos los gastos pendientes').check();
 await page.getByRole('button',{name:'Seleccionar todas las partidas y ponderar'}).click();
 await page.getByRole('button',{name:'Aprobar distribución de gastos seleccionados'}).click();
 await expect(page.getByRole('status')).toContainText('2 gastos imputados');
 await expect(page.locator('summary')).toContainText('0 gastos');
 const costs=await page.evaluate(()=>window.costs);expect(costs.map(c=>c.id)).toEqual([1,2]);expect(costs.map(c=>c.monto)).toEqual([1000,2000]);expect(costs[0].imputaciones.map(p=>p.porcentaje)).toEqual([75,25]);
 expect(await page.evaluate(()=>window.calls.length)).toBe(1);
});
