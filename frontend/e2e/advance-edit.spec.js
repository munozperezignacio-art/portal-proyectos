import {test,expect} from '@playwright/test';

async function openEdit(page) {
  await page.goto('/e2e/fixtures/project-profile.html?budget&advance');
  await page.getByText('Reporte de Avance',{exact:true}).click();
  await page.getByRole('button',{name:'Registro de Reportes'}).click();
  await page.getByTitle('Editar reporte de avance').click();
}

test('editar permite agregar partidas con una observación general y conserva el ID original',async({page})=>{
  await openEdit(page);
  const observations=page.getByLabel('Observaciones generales del reporte');
  await expect(observations).toHaveValue('Observación original conservada');
  await page.getByRole('button',{name:'Agregar Otra Partida al Reporte'}).click();
  await expect(page.locator('#avance-observaciones')).toHaveCount(1);
  const form=observations.locator('xpath=ancestor::form');
  await form.locator('select').filter({has:page.locator('option[value="Servicio camión aljibe"]')}).last().selectOption('Servicio camión aljibe');
  await form.locator('input[type="number"]').last().fill('1');
  await page.getByRole('button',{name:'Guardar cambios del reporte'}).click();
  await expect(page.getByText('Reporte de avance actualizado correctamente.',{exact:true})).toBeVisible();
  const [save]=await page.evaluate(()=>window.advanceSaves);
  expect(save.action).toBe('upsert');
  expect(save.data).toHaveLength(2);
  expect(save.data[0].id).toBe(81);
  expect(save.data[1].id).toBeUndefined();
  expect(save.data.every(row=>row.observaciones==='Observación original conservada')).toBe(true);
});

test('fallo de guardado conserva las partidas y la observación para corregir',async({page})=>{
  await openEdit(page);
  await page.evaluate(()=>{window.failSave=true;});
  await page.getByRole('button',{name:'Guardar cambios del reporte'}).click();
  await expect(page.getByText('Fallo simulado',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Observaciones generales del reporte')).toHaveValue('Observación original conservada');
});
