import {test,expect} from '@playwright/test';
test('work and responsible replace duplicated header and filter people by work',async({page})=>{
  const works=[{_id:'1',_display:'Obra A',nombre:'Obra A',obra_id:1,centro_gestion_id:7},{_id:'2',_display:'Obra B',nombre:'Obra B',obra_id:2,centro_gestion_id:8}];
  let saved;
  await page.route('**/functions/v1/formulario-publico',route=>{
    const body=route.request().postDataJSON();
    if(body.action==='enviar'){saved=body;return route.fulfill({json:{id:1}});}
    return route.fulfill({json:{form:{titulo:'Responsables',campos:[{id:'work',type:'data_lookup',source:'works',selectorKey:'nombre',label:'Obra',required:true},{id:'responsible',type:'data_lookup',source:'responsibles',selectorKey:'nombre',autofillKeys:['cargo'],label:'Responsable',required:true}]},centros:[{id:7,obra_id:1,obra_nombre:'Obra A'},{id:8,obra_id:2,obra_nombre:'Obra B'}],catalogos:{work:works,responsible:[{_id:'1:7',_display:'Ana · Supervisor',nombre:'Ana',cargo:'Supervisor',centro_gestion_id:7},{_id:'2:7',_display:'Luis · Supervisor',nombre:'Luis',cargo:'Supervisor',centro_gestion_id:7},{_id:'3:8',_display:'Pedro · Capataz',nombre:'Pedro',cargo:'Capataz',centro_gestion_id:8}]}}});
  });
  await page.goto('/?prevencion_form=test-responsibles');
  await expect(page.getByPlaceholder('Nombre del responsable')).toHaveCount(0);
  await expect(page.getByText('Centro de gestión *',{exact:true})).toHaveCount(0);
  await page.getByRole('combobox',{name:'Obra',exact:true}).selectOption('1');
  const responsible=page.getByRole('combobox',{name:'Responsable',exact:true});
  await expect(responsible.locator('option')).toHaveCount(3);
  await responsible.selectOption('1:7');
  await page.getByRole('combobox',{name:'Obra',exact:true}).selectOption('2');
  await expect(responsible).toHaveValue('');
  await expect(responsible.locator('option')).toHaveCount(2);
  await responsible.selectOption('3:8');
  await page.getByRole('button',{name:'Enviar',exact:true}).click();
  await expect(page.getByText('¡Inspección Enviada con Éxito!')).toBeVisible();
  expect(saved.inspector).toBe('Pedro');
  expect(saved.respuestas.responsible.cargo).toBe('Capataz');
  expect(saved.obra_id).toBe(2);
});
