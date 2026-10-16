import {expect} from '@playwright/test';

export async function checkWorkEmailConfig(page){
  await page.goto('/e2e/fixtures/work-email-config.html');
  const type=page.getByLabel('Tipo de notificación');
  const enabled=page.getByLabel('Enviar automáticamente este tipo de registro a sus destinatarios.');
  const save=page.getByRole('button',{name:'Guardar configuración de obra',exact:true});
  await expect(type).toBeEnabled();
  await expect(type.locator('option')).toHaveCount(7);
  await expect(page.getByText('advance@example.invalid',{exact:true})).toBeVisible();
  await type.selectOption('asistencia_registrada');
  await expect(enabled).not.toBeChecked();
  await expect(page.getByText('advance@example.invalid',{exact:true})).toHaveCount(0);
  await page.getByPlaceholder('ejemplo@obraxis.cl').fill(' RRHH@example.invalid ');
  await page.getByRole('button',{name:'Agregar',exact:true}).click();
  await page.getByPlaceholder('gerencia@obraxis.cl').fill('boss@example.invalid');
  await page.getByRole('button',{name:'Agregar CC',exact:true}).click();
  await enabled.check();
  await type.selectOption('maquinaria_registrada');
  await page.getByPlaceholder('ejemplo@obraxis.cl').fill('equipment@example.invalid');
  await page.getByRole('button',{name:'Agregar',exact:true}).click();
  await enabled.check();
  await type.selectOption('asistencia_registrada');
  await expect(page.getByText('rrhh@example.invalid',{exact:true})).toBeVisible();
  await save.click();
  await expect(page.getByText('Configuración de correos guardada exitosamente.')).toBeVisible();
  expect(await page.evaluate(()=>{
    const patch=window.savedPatches[0],config=window.config;
    return !Object.hasOwn(patch,'email_notificaciones') && !Object.hasOwn(patch,'notificaciones_automaticas')
      && config.email_notificaciones==='general@example.invalid'
      && config.correos_contextuales['obra:99'].events.avance_registrado.emails[0]==='other@example.invalid'
      && !Object.hasOwn(config.correos_contextuales['obra:3'].events,'avance_registrado');
  })).toBe(true);
  expect(await page.evaluate(()=>window.notifyFixture())).toBe('');
  expect(await page.evaluate(()=>window.mails.map(mail=>({to:mail.to,cc:mail.cc,permission:mail.permissionKey})))).toEqual([{to:['rrhh@example.invalid'],cc:['boss@example.invalid'],permission:'obras.personal.enviar'}]);
  await page.getByRole('button',{name:'Cerrar configuración de correos'}).click();
  await page.getByRole('button',{name:'Abrir configuración'}).click();
  await expect(type).toBeEnabled();
  await type.selectOption('asistencia_registrada');
  await expect(enabled).toBeChecked();
  await enabled.uncheck();
  await save.click();
  await expect(page.getByText('Configuración de correos guardada exitosamente.')).toBeVisible();
  expect(await page.evaluate(()=>window.notifyFixture())).toBe('');
  expect(await page.evaluate(()=>window.mails.length)).toBe(1);
  await type.selectOption('maquinaria_registrada');
  expect(await page.evaluate(()=>window.notifyFixture('maquinaria_registrada'))).toBe('');
  expect(await page.evaluate(()=>window.mails[1].to)).toEqual(['equipment@example.invalid']);
  await page.evaluate(()=>{window.failMail=true;});
  expect(await page.evaluate(()=>window.notifyFixture('maquinaria_registrada'))).toContain('El registro quedó guardado');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
}

export async function checkWorkEmailErrors(page){
  await page.goto('/e2e/fixtures/work-email-config.html');
  const type=page.getByLabel('Tipo de notificación');
  await expect(type).toBeEnabled();
  await type.selectOption('asistencia_registrada');
  await page.getByLabel('Enviar automáticamente este tipo de registro a sus destinatarios.').check();
  await page.evaluate(()=>{window.failSave=true;});
  await page.getByRole('button',{name:'Guardar configuración de obra',exact:true}).click();
  await expect(page.getByText('Simulated save failure')).toBeVisible();
  expect(await page.evaluate(()=>window.savedPatches.length)).toBe(0);
  await page.getByRole('button',{name:'Cerrar configuración de correos'}).click();
  await page.evaluate(()=>{window.failLoad=true;});
  await page.getByRole('button',{name:'Abrir configuración'}).click();
  await expect(page.getByText('Simulated load failure')).toBeVisible();
  await expect(page.getByRole('button',{name:'Guardar configuración de obra',exact:true})).toBeDisabled();
  await expect(type).toBeDisabled();
}
