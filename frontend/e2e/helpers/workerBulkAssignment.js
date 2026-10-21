import {expect} from '@playwright/test';
const open=async(page,suffix='')=>{await page.goto('/e2e/fixtures/worker-bulk-assignment.html'+suffix);await page.getByRole('button',{name:/Máster Personal Personal Empresa/}).click();};
export async function checkWorkerBulkAssignment(page,onPreview){
 await open(page);
 await page.getByLabel('Buscar personal por nombre o RUT').fill('jose');
 await page.getByLabel('Seleccionar José Álvarez',{exact:true}).check();
 await page.getByLabel('Buscar personal por nombre o RUT').fill('pedro');
 await expect(page.getByText(/1 fuera del filtro actual/)).toBeVisible();
 await page.getByLabel('Seleccionar Pedro Soto',{exact:true}).check();
 await page.getByLabel('Buscar personal por nombre o RUT').fill('');
 await page.getByLabel('Filtrar personal por obra').selectOption('Obra A');
 await page.getByLabel('Seleccionar trabajadores visibles',{exact:true}).check();
 await expect(page.getByRole('button',{name:'Asignaciones (3)',exact:true})).toBeVisible();
 await page.getByLabel('Seleccionar trabajadores visibles',{exact:true}).uncheck();
 await page.getByRole('button',{name:'Asignaciones (2)',exact:true}).click();
 await page.getByText('Cambiar la obra principal',{exact:true}).click();
 await page.getByRole('button',{name:'Cambiar obra principal',exact:true}).click();
 await page.getByLabel('Obra para los seleccionados').selectOption('20');
 await page.getByLabel('Fecha de asignación del lote').fill('2026-10-19');
 await expect(page.getByRole('dialog',{name:'Cambiar obra principal',exact:true})).toContainText('José Álvarez');
 await expect(page.getByRole('dialog',{name:'Cambiar obra principal',exact:true})).toContainText('Pedro Soto');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await onPreview?.();
 await page.evaluate(()=>{window.failAssignment=true;});
 await page.getByRole('button',{name:'Confirmar asignación',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('Error simulado de asignación');
 await page.evaluate(()=>{window.failAssignment=false;});
 await page.getByRole('button',{name:'Confirmar asignación',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('2 obras principales actualizadas');
 expect(await page.evaluate(()=>window.assignmentCalls[1])).toEqual({name:'asignar_personal_obra_lote',args:{p_empresa:'Prueba',p_trabajadores:[1,2],p_obra:20,p_fecha:'2026-10-19'}});
 await page.getByLabel('Filtrar personal por obra').selectOption('Obra B');
 await expect(page.getByLabel('Seleccionar José Álvarez',{exact:true})).toBeChecked();
 await expect(page.getByLabel('Seleccionar Pedro Soto',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Limpiar selección',exact:true}).click();
 await page.getByLabel('Filtrar personal por obra').selectOption('__sin_obra__');
 await page.getByLabel('Seleccionar Ingreso futuro',{exact:true}).check();
 await page.getByRole('button',{name:'Asignaciones (1)',exact:true}).click();
 await page.getByText('Cambiar la obra principal',{exact:true}).click();
 await page.getByRole('button',{name:'Cambiar obra principal',exact:true}).click();
 await page.getByLabel('Obra para los seleccionados').selectOption('20');
 await expect(page.getByRole('button',{name:'Confirmar asignación',exact:true})).toBeDisabled();
 await expect(page.getByRole('dialog',{name:'Cambiar obra principal',exact:true})).toContainText('fuera de vigencia contractual');
}
export async function checkWorkerAssignmentReadOnly(page){
 await open(page,'?readonly');
 await expect(page.getByLabel('Seleccionar trabajadores visibles',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Asignar obra \(/})).toHaveCount(0);
}
