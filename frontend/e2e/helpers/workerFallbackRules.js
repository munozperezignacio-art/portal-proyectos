import {expect} from '@playwright/test';
export async function checkWorkerFallbackRules(page,onPreview){
 await page.goto('/e2e/fixtures/worker-fallback-rules.html');
 await expect(page.getByLabel('Buscar trabajador por nombre o RUT')).toBeEnabled();
 await expect(page.getByLabel('Seleccionar José Álvarez',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Seleccionar Ana Soto',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Hora de cierre de la regla')).toHaveCount(0);
 await page.getByLabel('Buscar trabajador por nombre o RUT').fill('jose');
 await expect(page.getByLabel('Seleccionar Pedro Hernández',{exact:true})).toHaveCount(0);
 await page.getByLabel('Seleccionar José Álvarez',{exact:true}).check();
 await page.getByLabel('Buscar trabajador por nombre o RUT').fill('');
 await page.getByLabel('Seleccionar todos los trabajadores visibles').check();
 await expect(page.getByLabel('Seleccionar Pedro Hernández',{exact:true})).toBeChecked();
 await page.getByLabel('Filtrar trabajadores por regla').selectOption('todas');
 await expect(page.getByText('Otro no visible',{exact:true})).toHaveCount(0);
 await page.getByLabel('Seleccionar Ana Soto',{exact:true}).check();
 await expect(page.getByLabel('Reemplazar reglas existentes de los seleccionados')).not.toBeChecked();
 await page.getByLabel('Centro de respaldo').selectOption('20');
 await page.getByLabel('Regla vigente desde').fill('2026-10-19');
 await page.getByLabel('Modo de horas extra').selectOption('con');
 await expect(page.getByLabel('Horas extra diarias de la regla')).toHaveValue('');
 await page.getByLabel('Horas extra diarias de la regla').fill('2');
 await page.getByLabel('Sábado',{exact:true}).check();
 await onPreview?.();
 await page.evaluate(()=>{window.fail=true;});
 await page.getByRole('button',{name:'Guardar reglas para 2 trabajadores',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Error simulado de guardado');
 await page.evaluate(()=>{window.fail=false;});
 await page.getByRole('button',{name:'Guardar reglas para 2 trabajadores',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('2 reglas guardadas · 1 existentes conservadas');
 expect(await page.evaluate(()=>window.calls[1])).toEqual({name:'guardar_reglas_sin_asistencia_lote',args:{p_empresa:'Prueba',p_trabajadores:[1,2,3],p_centro:20,p_desde:'2026-10-19',p_hasta:null,p_dias:[1,2,3,4,5,6],p_horas_extra:2,p_activa:true,p_reemplazar:false}});
 expect(await page.evaluate(()=>window.rules.find(rule=>rule.trabajador_id===3).horas_extra_diarias)).toBe(1);
 await page.getByRole('button',{name:'Editar regla de José Álvarez',exact:true}).click();
 await expect(page.getByLabel('Modo de horas extra')).toHaveValue('con');
 await expect(page.getByLabel('Horas extra diarias de la regla')).toHaveValue('2');
 await page.getByLabel('Modo de horas extra').selectOption('sin');
 await expect(page.getByLabel('Horas extra diarias de la regla')).toHaveCount(0);
 await page.getByLabel('Regla activa',{exact:true}).uncheck();
 await page.getByRole('button',{name:'Guardar reglas para 1 trabajadores',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.rules.find(rule=>rule.trabajador_id===1).activa)).toBe(false);
 expect(await page.evaluate(()=>window.rules.find(rule=>rule.trabajador_id===1).horas_extra_diarias)).toBe(0);
 await page.getByLabel('Filtrar trabajadores por regla').selectOption('sin');
 await expect(page.getByText('No hay trabajadores que coincidan con la búsqueda y el filtro.')).toBeVisible();
 await page.getByLabel('Filtrar trabajadores por regla').selectOption('sin_vigente');
 await expect(page.getByLabel('Seleccionar José Álvarez',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Seleccionar Berta Rojas',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Seleccionar Ana Soto',{exact:true})).toHaveCount(0);
 await page.getByLabel('Buscar trabajador por nombre o RUT').fill('12345678');
 await page.getByLabel('Seleccionar José Álvarez',{exact:true}).check();
 await page.getByLabel('Buscar trabajador por nombre o RUT').fill('berta');
 await expect(page.getByText(/1 fuera del filtro actual/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
export async function checkWorkerFallbackReadOnly(page){
 await page.goto('/e2e/fixtures/worker-fallback-rules.html?readonly');
 await expect(page.getByLabel('Centro de respaldo')).toBeDisabled();
 await expect(page.getByLabel('Seleccionar todos los trabajadores visibles')).toBeDisabled();
 await expect(page.getByRole('button',{name:/Guardar reglas para/})).toBeDisabled();
 expect(await page.evaluate(()=>window.calls.length)).toBe(0);
}
export async function checkWorkerFallbackLoadError(page){
 await page.goto('/e2e/fixtures/worker-fallback-rules.html?loadfail');
 await expect(page.getByRole('status')).toHaveText('Error de lectura');
 await expect(page.getByLabel('Seleccionar todos los trabajadores visibles')).toBeDisabled();
 await expect(page.getByRole('button',{name:/Guardar reglas para/})).toBeDisabled();
 await expect(page.getByText('No se pudo comprobar quién tiene regla. Recarga la pantalla antes de guardar.')).toBeVisible();
}
