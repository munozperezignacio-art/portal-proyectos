import{test,expect}from'@playwright/test';
test('selección persistente, errores de lectura y descarga mensual Excel',async({page})=>{
  await page.goto('/e2e/fixtures/monthly-worker-assignments.html');
  await page.getByLabel('Mes del reporte',{exact:true}).fill('2026-10');
  await page.getByLabel('Buscar trabajadores para reporte').fill('Ana');await page.getByRole('checkbox',{name:/Ana Rojas/}).check();
  await page.getByLabel('Buscar trabajadores para reporte').fill('Luis');await page.getByRole('checkbox',{name:/Luis Soto/}).check();
  await expect(page.getByText('2 seleccionados',{exact:true})).toBeVisible();
  await page.evaluate(()=>{window.failReport=true;});
  await page.getByRole('button',{name:'Descargar Excel mensual (2)'}).click();await expect(page.getByRole('status')).toContainText('Error simulado');
  await page.evaluate(()=>{window.failReport=false;});
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Excel mensual (2)'}).click();const file=await pending;
  expect(file.suggestedFilename()).toBe('Asignaciones_TEST_2026-10.xlsx');
  await expect(page.getByRole('status')).toContainText('62 filas diarias');
  expect(await page.evaluate(()=>window.queries.every(q=>q.filters.some(f=>f[0]==='eq'&&f[1]==='empresa'&&f[2]==='TEST')))).toBe(true);
});
test('otras horas es numérico y está separado del cálculo de HE',async({page})=>{
  await page.goto('/e2e/fixtures/project-profile.html?centers');
  await page.getByRole('button',{name:'Asistencia',exact:true}).click();await page.getByRole('button',{name:'Registrar Marcaje',exact:true}).click();
  await page.getByRole('button',{name:/Registro Manual/}).click();
  const input=page.getByRole('spinbutton',{name:'Otras horas',exact:true});
  await input.fill('2.5');await expect(input).toHaveValue('2.5');await expect(input).toHaveAttribute('step','0.01');
  await expect(page.getByText(/no modifica su cálculo ni el pago/)).toBeVisible();
});
test('editar marcaje conserva y guarda otras horas de forma independiente',async({page})=>{
  await page.goto('/e2e/fixtures/project-profile.html?centers&attendance');
  await page.getByRole('button',{name:'Asistencia',exact:true}).click();
  await page.getByRole('row').filter({hasText:'Persona principal'}).getByRole('button',{name:/Editar/}).click();
  const input=page.getByRole('spinbutton',{name:'Otras horas',exact:true});await expect(input).toHaveValue('1.25');await input.fill('4.75');
  await page.getByRole('button',{name:'Confirmar y Enviar Asistencia'}).click();
  await expect.poll(()=>page.evaluate(()=>window.attendanceSaves.length)).toBe(1);
  expect(await page.evaluate(()=>window.attendanceSaves[0])).toMatchObject({action:'update',data:{otras_horas:4.75,horas_extras_auto:1}});
});
test('las asignaciones muestran otras horas del día',async({page})=>{
  await page.goto('/e2e/fixtures/monthly-worker-assignments.html?allocations');
  await page.getByLabel('Período',{exact:true}).fill('2026-10');
  await page.getByLabel('Estado',{exact:true}).selectOption('Todas');
  await expect(page.getByText('Otras horas: 2.5 h (informativas)',{exact:true})).toBeVisible();
});
