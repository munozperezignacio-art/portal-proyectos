import {test,expect} from '@playwright/test';
test('distribution and expandable details reconcile without page overflow',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/e2e/fixtures/cost-distribution.html');
 await expect(page.getByRole('img')).toHaveAttribute('aria-label',/Margen estimado \$300.000/);
 await page.locator('summary').filter({hasText:'Pilas de grava'}).click();
 await expect(page.getByRole('cell',{name:'Almuerzos de cuadrilla'})).toBeVisible();
 await expect(page.getByRole('cell',{name:'OC 820-134'})).toBeVisible();
 await expect(page.getByRole('cell',{name:'$60.000',exact:true})).toBeVisible();
 await page.locator('summary').filter({hasText:'Sin imputar'}).click();
 await expect(page.getByRole('cell',{name:'Excavadora',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
