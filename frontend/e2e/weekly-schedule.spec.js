import {test,expect} from '@playwright/test';
test('weekly schedule has separate weekdays and meal intervals and saves them',async({page})=>{
 await page.goto('/e2e/fixtures/weekly-schedule.html');
 await expect(page.getByRole('dialog',{name:'Jornada semanal'})).toBeVisible();
 await page.getByLabel('Viernes Salida',{exact:true}).fill('14:00');
 await page.getByLabel('Viernes Inicio colación',{exact:true}).fill('');
 await page.getByLabel('Viernes Fin colación',{exact:true}).fill('');
 await page.getByRole('button',{name:'Guardar jornada semanal'}).click();
 expect(await page.evaluate(()=>window.savedSchedule.jornada_semanal['5'].end)).toBe('14:00');
 expect(await page.evaluate(()=>window.savedSchedule.jornada_semanal['0'].active)).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
