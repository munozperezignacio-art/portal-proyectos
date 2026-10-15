import {test,expect} from '@playwright/test';
test('attendance signature initializes, draws, clears and resets for next worker',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/e2e/fixtures/attendance-signature.html');
 await expect(page.getByRole('status')).toHaveText('Sin firma');
 const box=await page.locator('canvas').boundingBox();
 const draw=async()=>{await page.mouse.move(box.x+20,box.y+40);await page.mouse.down();await page.mouse.move(box.x+180,box.y+70,{steps:8});await page.mouse.up();};
 await draw();await expect(page.getByRole('status')).toHaveText('Firma registrada');
 await page.getByRole('button',{name:'Limpiar firma'}).click();await expect(page.getByRole('status')).toHaveText('Sin firma');
 await draw();await page.getByRole('button',{name:'Cambiar trabajador'}).click();await expect(page.getByRole('status')).toHaveText('Sin firma');
 expect(errors).toEqual([]);
});
