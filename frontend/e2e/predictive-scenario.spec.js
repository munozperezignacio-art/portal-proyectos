import {test,expect} from '@playwright/test';
test('forecast and daily recovery targets survive missing cost inputs and future holiday calendar',async({page})=>{
 await page.goto('/e2e/fixtures/predictive-scenario.html');
 await expect(page.getByRole('heading',{name:'Proyección de obra',exact:true})).toBeVisible();
 await expect(page.getByText('Sin base de plazo',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Término estimado · calendario parcial')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Qué necesitamos para llegar al plazo'})).toBeVisible();
 await expect(page.getByRole('columnheader',{name:'Necesario / día'})).toHaveCount(2);
 await expect(page.getByText('0 meses calendario')).toHaveCount(0);
 await expect(page.getByText('Costo previsto al término · base de control')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
