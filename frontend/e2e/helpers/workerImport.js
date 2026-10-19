import {expect} from '@playwright/test';
const csv = 'Listado de Empleados\nRut,Nombre,Fecha Inicio contrato,Fecha término contrato,Causal de término,Sueldo Base,Cargo\n12.345.678-5,Existente,2026-01-01,3000-01-01,sinDefinir,1,Operador\n11111111-1,Nuevo indefinido,2026-01-01,3000-12-31,sinDefinir,650000,Operador\n22222222-2,Nuevo renuncia,2026-01-01,2026-10-07,159i2,650000,Operador\n33333333-3,Nuevo plazo,2026-01-01,2099-12-31,159i4,650000,Operador\n12345678-9,Rut inválido,2026-01-01,3000-01-01,sinDefinir,650000,Operador';
export async function checkWorkerImport(page, onPreview) {
  await page.goto('/e2e/fixtures/worker-import.html');
  await page.getByLabel('Archivo de trabajadores').setInputFiles({name:'listado.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.getByText('5 filas detectadas. Revisa la relación de columnas.')).toBeVisible();
  await page.getByRole('button',{name:'Validar datos',exact:true}).click();
  await expect(page.getByText('Siempre omitir existentes · Solo crear nuevos')).toBeVisible();
  await expect(page.getByRole('cell',{name:/No informado Ingreso: 2026-01-01 Renuncia efectiva: 2026-10-07/})).toBeVisible();
  await expect(page.getByText('Se conserva ficha actual')).toBeVisible();
  await expect(page.getByRole('button',{name:'Crear 3 trabajadores nuevos'})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await onPreview?.();
  await page.evaluate(()=>{window.failImport=true;});
  await page.getByRole('button',{name:'Crear 3 trabajadores nuevos'}).click();
  await expect(page.getByRole('alert')).toContainText('Error de prueba');
  await page.evaluate(()=>{window.failImport=false;});
  await page.getByRole('button',{name:'Crear 3 trabajadores nuevos'}).click();
  await expect(page.getByText(/2 creados · 2 existentes omitidos · 1 filas con error/)).toBeVisible();
  const calls=await page.evaluate(()=>window.importCalls);
  expect(calls[1].name).toBe('importar_personal_solo_nuevos');
  expect(calls[1].args.p_filas).toHaveLength(3);
  expect(calls[1].args.p_filas[0].tipo_contrato).toBe('Indefinido');
  expect(calls[1].args.p_filas[0].fecha_vencimiento_contrato).toBeNull();
  expect(calls[1].args.p_filas[0].afp).toBeNull();
  expect(calls[1].args.p_filas[1].causal_termino_contrato).toBe('159i2');
  expect(await page.evaluate(()=>window.refreshes)).toBe(1);
}
