import {test,expect} from '@playwright/test';
test('physical completion is separate from schedule and charge closure',async({page})=>{
 await page.goto('/e2e/fixtures/work-completion.html');
 const panel=page.getByRole('region',{name:'Término automático de trabajos'});
 await expect(panel).toContainText('Trabajos terminados al 100%');
 await expect(panel).toContainText('Cierre de costos pendiente');
 await expect(panel).toContainText('2026-10-30');await expect(panel).toContainText('2026-11-10');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/e2e/fixtures/work-completion.html?review');
 await expect(panel).toContainText('Revisar término');await expect(panel).toContainText('2026-10-30');
 await expect(panel).toContainText('2 de 3');await expect(panel).not.toContainText('Trabajos terminados al 100%');
});
