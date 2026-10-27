import{test,expect}from'@playwright/test';
test('operator from HR has equipment history independent of reporter and deactivation preserves it',async({page})=>{
 await page.goto('/e2e/fixtures/machinery-operators.html');
 await page.getByLabel('Persona de Recursos Humanos').selectOption('7');
 await page.getByRole('button',{name:'Habilitar operador'}).click();
 await page.getByRole('button',{name:'Ver ficha e historial'}).click();
 await expect(page.getByText('Ficha de Operador QA')).toBeVisible();
 await expect(page.getByRole('cell',{name:'Supervisor distinto'})).toBeVisible();
 await page.getByRole('button',{name:'Desactivar',exact:true}).click();
 await expect(page.getByText('Inactivo',{exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'Supervisor distinto'})).toBeVisible();
});
test('read only cannot enable operators',async({page})=>{await page.goto('/e2e/fixtures/machinery-operators.html?readonly');await expect(page.getByText('Todavía no hay operadores habilitados.')).toBeVisible();await expect(page.getByRole('button',{name:'Habilitar operador'})).toHaveCount(0);});
