import {test,expect} from '@playwright/test';
test('daily ordinary hours make overtime calculation visible and historical mismatches reviewable',async({page})=>{
 await page.goto('/e2e/fixtures/attendance-hours.html');
 await expect(page.getByText('Trabajadas: 10 h · Ordinarias: 9 h · Extras calculadas: 1 h')).toBeVisible();
 await expect(page.getByText('Jornada aplicada: 08:00–18:00 · Colación 13:00–14:00')).toBeVisible();
 await expect(page.getByRole('button',{name:'Guardar como jornada base de esta obra'})).toHaveCount(0);
 await expect(page.getByLabel('Jornada ordinaria del día')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Revisar y recalcular'})).toBeVisible();
});
