import {test,expect} from '@playwright/test';
test('report register supports date search, chronological order and clear',async({page})=>{
 await page.goto('/e2e/fixtures/advance-report-dates.html');
 await expect(page.getByRole('listitem')).toHaveText(['06-10-2026','01-10-2026','30-09-2026']);
 await page.getByLabel('Orden de reportes').selectOption('asc');
 await expect(page.getByRole('listitem')).toHaveText(['30-09-2026','01-10-2026','06-10-2026']);
 await page.getByLabel('Buscar por fecha del avance').fill('2026-10-01');
 await expect(page.getByRole('listitem')).toHaveText(['01-10-2026']);
 await expect(page.getByRole('status')).toHaveText('Mostrando 1 de 3 reportes');
 await page.getByLabel('Buscar por fecha del avance').fill('2026-10-02');
 await expect(page.getByText('No hay reportes para esta fecha.')).toBeVisible();
 await page.getByRole('button',{name:'Limpiar fecha'}).click();
 await expect(page.getByRole('listitem')).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
