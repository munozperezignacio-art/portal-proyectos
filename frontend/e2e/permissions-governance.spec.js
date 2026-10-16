import {test,expect} from '@playwright/test';
test('saves and reloads whole-module denials without crashing and refreshes runtime access',async({page})=>{
 await page.goto('/e2e/fixtures/permissions-governance.html');
 await expect(page.getByRole('button',{name:'Desactivar módulo Obras',exact:true})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Desactivar módulo Facturación',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Desactivar módulo Formularios y Capacitaciones',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Desactivar módulo Obras',exact:true}).click();
 await page.getByRole('button',{name:'Guardar permisos',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Permisos guardados');
 await expect(page.getByTestId('live-menu')).toHaveText('Obras oculto');
 const saved=await page.evaluate(()=>window.savedPermissions[0]);
 expect(saved.filters).toEqual({empresa:'EMINSG',id:11});
 expect(Object.entries(saved.payload.permisos).filter(([k])=>k.startsWith('obras.')).every(([,v])=>v===false)).toBe(true);
 expect(saved.payload.permisos['facturacion.documentos.ver']).toBe(true);
 await page.getByRole('button',{name:'Volver a cargar matriz'}).click();
 await expect(page.getByRole('button',{name:'Guardar permisos',exact:true})).toBeEnabled();
 const section=page.locator('section').filter({has:page.getByRole('button',{name:'Desactivar módulo Obras',exact:true})});
 await expect(section.locator('input:checked')).toHaveCount(0);
 await page.getByRole('button',{name:'Permitir todo el módulo Obras',exact:true}).click();
 await page.getByRole('button',{name:'Guardar permisos',exact:true}).click();
 await expect(page.getByTestId('live-menu')).toHaveText('Obras visible');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('save failures remain visible and do not report successful changes',async({page})=>{
 await page.goto('/e2e/fixtures/permissions-governance.html?scenario=save-error');
 await page.getByRole('button',{name:'Desactivar módulo Obras',exact:true}).click();
 await page.getByRole('button',{name:'Guardar permisos',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Guardado rechazado de prueba');
 await expect(page.getByRole('button',{name:'Guardar permisos',exact:true})).toBeEnabled();
 await expect(page.getByTestId('live-menu')).toHaveText('Obras visible');
});
test('missing company configuration fails closed instead of showing the complete catalog',async({page})=>{
 await page.goto('/e2e/fixtures/permissions-governance.html?scenario=load-error');
 await expect(page.getByRole('alert')).toContainText('No fue posible leer la empresa');
 await expect(page.getByRole('button',{name:'Guardar permisos',exact:true})).toBeDisabled();
 await expect(page.locator('section')).toHaveCount(0);
});
