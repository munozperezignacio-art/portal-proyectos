import { test, expect } from '@playwright/test';
test('public QR is a scoped form, conditional fields and idempotent retry', async ({ page }) => {
  const submissions=[];
  await page.route('**/functions/v1/maquinaria-publica',async route=>{
    const body=route.request().postDataJSON();
    if(body.action==='cargar')return route.fulfill({json:{operadores:[{id:'11111111-1111-4111-8111-111111111111',nombre:'Operador de prueba'}],equipo:{empresa:'Empresa QA',tipo:'Excavadora',patente:'QA-01',obra_nombre:'Obra QA',horometro_inicial:100,unidad:'h',codigo:'QA-DOC',revision:'03'}}});
    submissions.push(body);
    if(submissions.length===1)return route.fulfill({status:503,json:{error:'Prueba de reintento'}});
    return route.fulfill({json:{ok:true,id:991}});
  });
  await page.goto('/?maquinaria_token='+'a'.repeat(48));
  await expect(page.getByText('Documento QA-DOC · Revisión 03')).toBeVisible();
  await expect(page.getByRole('link')).toHaveCount(0);
  await expect(page.getByLabel('Litros cargados (L)')).toHaveCount(0);
  await page.getByLabel('Operador',{exact:true}).selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByLabel('Nombre de quien registra').fill('Supervisor de prueba');
  await page.getByLabel('Lectura final (h)').fill('108,5');
  await page.getByLabel('¿Hubo carga de combustible?').selectOption('si');
  await page.getByLabel('Litros cargados (L)').fill('75,5');
  await page.getByLabel('¿Hubo alguna falla?').selectOption('si');
  await page.getByLabel('Describe la falla').fill('Falla de prueba');
  await page.getByLabel('¿La falla detuvo el equipo?').selectOption('si');
  await page.getByLabel('Horas de paralización (h)').fill('1,5');
  await page.getByRole('button',{name:'Enviar reporte'}).click();
  await expect(page.getByRole('alert')).toContainText('Prueba de reintento');
  await page.getByRole('button',{name:'Enviar reporte'}).click();
  await expect(page.getByText('Reporte #991 recibido')).toBeVisible();
  expect(submissions[0].solicitud_id).toBe(submissions[1].solicitud_id);
  expect(submissions[1].operador_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(submissions[1].autor_declarado).toBe('Supervisor de prueba');
  expect(submissions[1].hubo_falla).toBe(true);
  expect(submissions[1].combustible_cargado).toBe('75,5');
});
test('disabled QR does not display submission inputs',async({page})=>{
  await page.route('**/functions/v1/maquinaria-publica',route=>route.fulfill({status:404,json:{error:'Enlace desactivado'}}));
  await page.goto('/?maquinaria_token='+'a'.repeat(48));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button',{name:'Enviar reporte'})).toHaveCount(0);
});
