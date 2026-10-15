import {test,expect} from '@playwright/test';
test('daily ordinary hours make overtime calculation visible and historical mismatches reviewable',async({page})=>{
 await page.goto('/e2e/fixtures/attendance-hours.html');
 await expect(page.getByText('Trabajadas: 10 h · Ordinarias: 9 h · Extras calculadas: 1 h')).toBeVisible();
 await page.getByLabel('Jornada ordinaria del día').fill('8');
 await expect(page.getByText('Trabajadas: 10 h · Ordinarias: 8 h · Extras calculadas: 2 h')).toBeVisible();
 await expect(page.getByRole('button',{name:'Guardar como jornada base de esta obra'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Revisar y recalcular'})).toBeVisible();
});
