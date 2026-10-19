import {test,expect} from '@playwright/test';
export async function verifyProjectProfile(page,width=1440){
  await page.setViewportSize({width,height:960});
  await page.goto('/e2e/fixtures/project-profile.html');
  await expect(page.getByRole('button',{name:'Ficha del proyecto',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Herramientas',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ficha del proyecto',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Ficha del proyecto'});
  await expect(dialog.getByLabel('Nombre del proyecto',{exact:true})).toHaveValue('Proyecto inicial');
  await dialog.getByLabel('Nombre del proyecto',{exact:true}).fill('Proyecto renovado');
  await page.evaluate(()=>{window.failSave=true;});
  await dialog.getByRole('button',{name:'Guardar ficha'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Ya existe otro proyecto');
  await expect(page.getByRole('heading',{name:'Proyecto inicial',exact:true})).toBeVisible();
  await page.evaluate(()=>{window.failSave=false;});
  await dialog.getByRole('button',{name:'Guardar ficha'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Proyecto renovado',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.renamed)).toMatchObject({previous:'Proyecto inicial',next:'Proyecto renovado'});
  expect(await page.evaluate(()=>window.saves.at(-1))).toMatchObject({p_empresa:'TEST',p_obra:123,p_nombre_anterior:'Proyecto inicial'});
  await page.getByRole('button',{name:'Ficha del proyecto',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Nombre del proyecto',{exact:true})).toHaveValue('Proyecto renovado');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
test('profile is discoverable and saves without losing the project',async({page})=>{await verifyProjectProfile(page);});
test('mobile profile supports renaming',async({page})=>{await verifyProjectProfile(page,390);});
test('read only profiles cannot save',async({page})=>{
  await page.goto('/e2e/fixtures/project-profile.html?readonly');
  await page.getByRole('button',{name:'Ficha del proyecto',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Nombre del proyecto',{exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Guardar ficha'})).toHaveCount(0);
});
