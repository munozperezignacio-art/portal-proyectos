import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const fields = [
  {id:'work',type:'data_lookup',source:'works',label:'Obra',selectorKey:'nombre',autofillKeys:['admin_contrato','ubicacion'],sourceColumns:[{key:'nombre',label:'Obra'},{key:'admin_contrato',label:'Administrador'},{key:'ubicacion',label:'Ubicación'}],required:true},
  {id:'choice',type:'select',label:'Lista de prueba',options:['Primera','Segunda'],required:true},
  {id:'day',type:'date',label:'Fecha',required:true},
  {id:'hour',type:'time',label:'Hora',required:true},
  {id:'checks',type:'checkbox',label:'Controles',options:['Seguro','Revisado'],required:true},
  {id:'sign1',type:'signature',label:'Firma uno'},
  {id:'sign2',type:'signature',label:'Firma dos'},
  {id:'group',type:'repeater',label:'Detalle',subFields:[{id:'date',type:'date',label:'Fecha detalle'},{id:'time',type:'time',label:'Hora detalle'}]}
];
test('public work selector, native controls, validation, independent signatures and PDF', async ({page}, testInfo) => {
  let submitted;
  await page.route('**/functions/v1/formulario-publico', async route => {
    const body = route.request().postDataJSON();
    if(body.action==='enviar') { submitted=body; return route.fulfill({json:{id:1}}); }
    return route.fulfill({json:{form:{id:1,titulo:'Formulario de prueba',empresa:'EMPRESA DEMO',campos:fields},centros:[{id:7,codigo:'007',nombre:'Obra demo',obra_id:1,obra_nombre:'Obra demo'}],catalogos:{work:[{_id:'1',_display:'Obra demo',nombre:'Obra demo',obra_id:1,centro_gestion_id:7,admin_contrato:'Administrador demo',ubicacion:'Santiago'}]}}});
  });
  await page.goto('/?prevencion_form=test-token-123');
  await page.getByPlaceholder('Nombre del responsable').fill('Persona de prueba');
  await page.getByRole('combobox',{name:'Obra',exact:true}).selectOption('1');
  await expect(page.getByText('Administrador demo',{exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Lista de prueba'}).selectOption('Segunda');
  await page.locator('input[type=date]').first().fill('2026-10-28');
  await page.locator('input[type=time]').first().fill('08:30');
  await expect(page.getByLabel('Fecha detalle')).toHaveAttribute('type','date');
  await expect(page.getByLabel('Hora detalle')).toHaveAttribute('type','time');
  await page.getByRole('button',{name:'Enviar',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Controles: es obligatorio');
  await page.getByLabel('Seguro',{exact:true}).check();
  const canvases=page.locator('canvas');
  for(let i=0;i<2;i++) {
    await canvases.nth(i).scrollIntoViewIfNeeded();
    const box=await canvases.nth(i).boundingBox();
    await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+80+i*25,box.y+50,{steps:4});await page.mouse.up();
  }
  await page.getByRole('button',{name:'Enviar',exact:true}).click();
  await expect(page.getByText('¡Inspección Enviada con Éxito!')).toBeVisible();
  expect(submitted.obra_id).toBe(1);
  expect(submitted.respuestas.sign1).toMatch(/^data:image/);
  expect(submitted.respuestas.sign2).not.toBe(submitted.respuestas.sign1);
  const base64=await page.evaluate(async ({fields,answers})=>{
    const {generateFormPdf}=await import('/src/utils/pdfGenerator.js');
    return generateFormPdf({form:{titulo:'Reporte de inspección de obra',empresa:'EMPRESA DEMO',campos:fields,codigo:'FOR-01',revision:'01'},metadata:{proyecto_nombre:'Obra demo',inspector:'Persona de prueba'},answers});
  },{fields,answers:submitted.respuestas});
  expect(base64.startsWith('JVBER')).toBeTruthy();
  await mkdir('test-results/form-pdf',{recursive:true});
  await writeFile(`test-results/form-pdf/${testInfo.project.name}.pdf`,Buffer.from(base64,'base64'));
});
