import{test,expect}from'@playwright/test';
test('budget group titles use available width and all actions occupy the last column',async({page})=>{
  await page.goto('/e2e/fixtures/project-profile.html?budget');
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:'Plan y Control de Obra',exact:true})}).click();
  const table=page.getByRole('table',{name:'Partidas del presupuesto de obra'});
  await expect(table).toBeVisible();await expect(table.locator('tbody tr')).toHaveCount(4);
  const groups=table.locator('tbody tr').filter({has:page.getByTitle('Editar Título')});
  await expect(groups).toHaveCount(2);
  for(const row of await groups.all()){
    await expect(row.locator('td')).toHaveCount(3);
    await expect(row.locator('td').last().getByTitle('Editar Título')).toBeVisible();
    const title=await row.locator('td').first().locator('span').first().boundingBox();
    expect(title.height).toBeLessThan(32);
  }
  const right=await table.evaluate(t=>[...t.tBodies[0].rows].map(r=>r.lastElementChild.getBoundingClientRect().right));
  expect(Math.max(...right)-Math.min(...right)).toBeLessThan(2);
  // La edición sigue actuando sobre la fila elegida tras mover los botones.
  await groups.last().getByTitle('Editar Título').click();
  await expect(page.getByPlaceholder('Ej. Excavaciones e Instalación de Moldajes')).toHaveValue('MANTA CONTROL DE EROSIÓN TEMPORAL FIBRA DE COCO');
});
