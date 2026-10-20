import{test,expect}from'@playwright/test';
test('crea grupo con búsquedas sucesivas; asigna completo con confirmación de traslado',async({page})=>{
 await page.goto('/e2e/fixtures/equipment-groups.html');await page.getByRole('button',{name:'+ Crear grupo',exact:true}).click();
 const editor=page.getByRole('dialog');await editor.getByLabel('Nombre del grupo',{exact:true}).fill('Conjunto prueba');
 await editor.getByRole('searchbox',{name:'Buscar equipos para el grupo'}).fill('EXC');await editor.getByRole('checkbox',{name:/EXC-01/}).check();
 await editor.getByRole('searchbox',{name:'Buscar equipos para el grupo'}).fill('COM');await editor.getByRole('checkbox',{name:/COM-01/}).check();await expect(editor.getByText('2 equipos seleccionados',{exact:true})).toBeVisible();
 await editor.getByRole('button',{name:'Guardar grupo'}).click();await expect(editor).toHaveCount(0);
 expect(await page.evaluate(()=>window.equipment[0].obra_nombre)).toBe('Obra B');
 const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Conjunto prueba',exact:true})});await card.getByRole('button',{name:'Asignar grupo',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Destino del grupo',{exact:true}).selectOption('Obra A');await dialog.getByRole('checkbox',{name:/Confirmo el traslado/}).check();
 await page.evaluate(()=>{window.failGroups=true;});await dialog.getByRole('button',{name:'Confirmar asignación de 2 equipos'}).click();await expect(dialog.getByRole('alert')).toContainText('Conflicto simulado');expect(await page.evaluate(()=>window.equipment[0].obra_nombre)).toBe('Obra B');
 await page.evaluate(()=>{window.failGroups=false;});await dialog.getByRole('button',{name:'Confirmar asignación de 2 equipos'}).click();await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>window.equipment.slice(0,2).map(e=>e.obra_nombre))).toEqual(['Obra A','Obra A']);
 page.on('dialog',d=>d.accept());await card.getByRole('button',{name:'Eliminar grupo'}).click();await expect(card).toHaveCount(0);expect(await page.evaluate(()=>window.equipment.length)).toBe(3);
});
test('reservas bloquean grupo; solo lectura no permite modificaciones; acceso desde inventario',async({page})=>{
 await page.goto('/e2e/fixtures/equipment-groups.html?conflict');await page.getByRole('button',{name:'Asignar grupo',exact:true}).click();await page.getByLabel('Destino del grupo',{exact:true}).selectOption('Obra A');await expect(page.getByRole('button',{name:'Confirmar asignación de 2 equipos'})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('reservas coincidentes');
 await page.goto('/e2e/fixtures/equipment-groups.html?readonly');await expect(page.getByRole('heading',{name:'Grupo perforación',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'+ Crear grupo',exact:true})).toHaveCount(0);
 await page.goto('/e2e/fixtures/equipment-inventory.html');await page.getByText('Ver Inventario',{exact:true}).click();await page.getByRole('button',{name:'Grupos de equipos',exact:true}).click();await expect(page.getByRole('region',{name:'Grupos de equipos',exact:true})).toBeVisible();
});
