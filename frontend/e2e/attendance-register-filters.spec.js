import {test,expect} from '@playwright/test';
test('attendance supports combined day and worker search, RUT and clear',async({page})=>{
 await page.goto('/e2e/fixtures/attendance-register-filters.html');
 await page.getByLabel('Filtrar asistencia por trabajador').fill('franco munoz');
 await expect(page.getByRole('listitem')).toHaveCount(2);
 await page.getByLabel('Filtrar asistencia por día').fill('2026-10-13');
 await expect(page.getByRole('listitem')).toHaveText(['2026-10-13 · Franco Muñoz']);
 await expect(page.getByRole('status')).toHaveText('Mostrando 1 de 3 marcajes');
 await page.getByLabel('Filtrar asistencia por trabajador').fill('207095818');
 await expect(page.getByRole('listitem')).toHaveText(['2026-10-13 · María Pérez']);
 await page.getByLabel('Filtrar asistencia por día').fill('2026-10-14');
 await expect(page.getByText('No hay marcajes con estos filtros.')).toBeVisible();
 await page.getByRole('button',{name:'Limpiar filtros'}).click();
 await expect(page.getByRole('listitem')).toHaveCount(3);
 await expect(page.getByLabel('Filtrar asistencia por día')).toHaveValue('');
 await expect(page.getByLabel('Filtrar asistencia por trabajador')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
