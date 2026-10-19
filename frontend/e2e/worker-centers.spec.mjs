import{test,expect}from'@playwright/test';
test('multiple centers selected across searches; error is visible; existing centers are not silently replaced',async({page})=>{
  await page.goto('/e2e/fixtures/worker-centers.html');
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('Principal: Principal')).toHaveCount(2);
  await dialog.getByRole('searchbox').fill('Segunda');await dialog.getByRole('checkbox',{name:'SEG · Segunda obra',exact:true}).check();
  await dialog.getByRole('searchbox').fill('Oficina');await dialog.getByRole('checkbox',{name:'ADM · Oficina central',exact:true}).check();
  await expect(dialog.getByText(/2 centros seleccionados/)).toBeVisible();
  await page.evaluate(()=>{window.fail=true;});await dialog.getByRole('button',{name:'Agregar 2 centros',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Sin permiso');
  await page.evaluate(()=>{window.fail=false;});await dialog.getByRole('button',{name:'Agregar 2 centros',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>window.calls.at(-1))).toMatchObject({name:'gestionar_personal_centros',args:{p_empresa:'TEST',p_trabajadores:[1,2],p_centros:[20,30],p_accion:'agregar'}});
});
test('personnel filters include secondary centers without replacing principal; readonly cannot assign',async({page})=>{
  await page.goto('/e2e/fixtures/worker-bulk-assignment.html?multi');
  await page.getByRole('button',{name:/Máster Personal Personal Empresa/}).click();
  await page.getByLabel('Filtrar personal por obra').selectOption('Obra B');
  await expect(page.getByLabel('Seleccionar Ana Rojas',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Seleccionar José Álvarez',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Centros de gestión',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Principal: Obra A');
  await page.getByRole('checkbox',{name:'OF · Oficina',exact:true}).check();
  await page.getByRole('button',{name:'Agregar 1 centros',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('OF · Oficina',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.workers.find(w=>w.id===3).obra_nombre)).toBe('Obra A');
  await page.goto('/e2e/fixtures/worker-bulk-assignment.html?multi&readonly');
  await page.getByRole('button',{name:/Máster Personal Personal Empresa/}).click();
  await expect(page.getByRole('button',{name:'Centros de gestión',exact:true})).toHaveCount(0);
});
test('a secondary work member and a principal member appear once in manual attendance',async({page})=>{
  await page.goto('/e2e/fixtures/project-profile.html?centers');
  await page.getByRole('button',{name:'Asistencia',exact:true}).click();
  await page.getByRole('button',{name:'Registrar Marcaje',exact:true}).click();
  await page.getByRole('button',{name:/Registro Manual/}).click();
  await expect(page.getByRole('option',{name:/Persona secundaria/})).toHaveCount(1);
  await expect(page.getByRole('option',{name:/Persona principal/})).toHaveCount(1);
});
