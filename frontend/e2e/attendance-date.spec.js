import {test,expect} from '@playwright/test';
test('manual date can be backdated while QR always uses today',async({page})=>{
 await page.goto('/e2e/fixtures/attendance-date.html');
 const date=page.getByLabel('Fecha del marcaje manual');
 const today=await date.getAttribute('max');
 await date.fill('2026-10-13');
 await page.getByRole('button',{name:'Guardar prueba'}).click();
 await expect(page.getByTestId('saved')).toHaveText('2026-10-13');
 await page.getByRole('button',{name:'Cambiar modo'}).click();
 await expect(date).toHaveCount(0);
 await page.getByRole('button',{name:'Guardar prueba'}).click();
 await expect(page.getByTestId('saved')).toHaveText(today);
});
