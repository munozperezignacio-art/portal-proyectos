import {test,expect} from '@playwright/test';
test('station and commune visible without changing movement assignment',async({page})=>{
 await page.goto('/e2e/fixtures/enex.html');
 await page.getByRole('button',{name:/Combustible Enex/}).click();
 await expect(page.getByRole('columnheader',{name:'Estación de servicio',exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'Estación de prueba Comuna de prueba'})).toBeVisible();
 await page.getByRole('button',{name:'Asignar',exact:true}).click();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Estación de prueba Comuna de prueba'})).toBeVisible();
 await expect(page.getByRole('cell',{name:/Pendiente/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
