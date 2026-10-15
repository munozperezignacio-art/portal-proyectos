import {test,expect} from '@playwright/test';
test('manual attendance supports selecting workers individually or all visible without sharing signatures',async({page})=>{
 await page.goto('/e2e/fixtures/attendance-workers.html');
 await page.getByLabel(/Seleccionar visibles/).check();
 await expect(page.getByText('Trabajadores seleccionados: 2')).toBeVisible();
 await page.getByRole('button',{name:'Registrar seleccionados'}).click();
 const rows=await page.evaluate(()=>window.batch);expect(rows.map(r=>r.trabajador)).toEqual(['Ana','Luis']);expect(rows.every(r=>r.firma_base64===null && !r.verificado_qr)).toBe(true);
 await page.getByLabel('Buscar trabajadores para marcaje').fill('Ana');
 await page.getByLabel(/Seleccionar visibles/).uncheck();
 await expect(page.getByText('Trabajadores seleccionados: 1')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
