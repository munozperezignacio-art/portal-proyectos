import {test,expect} from '@playwright/test';
test('budget margin saves and updates CPI, supports zero and fits mobile',async({page})=>{
 await page.goto('/e2e/fixtures/budget-margin.html');
 const input=page.getByRole('spinbutton',{name:'Margen presupuestado (%)'});
 await expect(page.getByTestId('cpi')).toHaveText('Pendiente');
 await input.fill('20');await page.getByRole('button',{name:'Guardar margen'}).click();
 await expect(page.getByTestId('cpi')).toHaveText('1.00');
 await input.fill('0');await page.getByRole('button',{name:'Guardar margen'}).click();
 await expect(page.getByTestId('cpi')).toHaveText('1.25');
 await input.fill('100');await page.getByRole('button',{name:'Guardar margen'}).click();
 await expect(page.getByRole('status')).toContainText('menor que 100');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/e2e/fixtures/budget-margin.html?readonly');await expect(input).toBeDisabled();
 await expect(page.getByRole('button',{name:'Guardar margen'})).toHaveCount(0);
});
