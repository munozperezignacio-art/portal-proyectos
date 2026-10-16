import {expect} from '@playwright/test';

export async function checkAutomaticUserPassword(page, failEmail = false) {
  await page.goto('/e2e/fixtures/create-user-role-access.html');
  await page.evaluate(fail => {window.failEmail = fail;}, failEmail);
  await page.getByRole('button',{name:'Gestión de Usuarios',exact:true}).click();
  await page.getByRole('button',{name:'Agregar Usuario',exact:true}).click();
  await expect(page.getByText('Contraseña inicial automática',{exact:true})).toBeVisible();
  await expect(page.getByPlaceholder('Contraseña inicial',{exact:true})).toHaveCount(0);
  await page.getByPlaceholder('ej: Juan Pérez').fill('<b>Usuario de prueba</b>');
  await page.getByPlaceholder('ej: juan@empresa.cl').fill('prueba@example.invalid');
  await page.getByPlaceholder('ej: Supervisor de Obra').fill('Supervisor');
  await page.getByPlaceholder('ej: jperez').fill('fixture_user');
  await page.getByRole('button',{name:'Guardar Usuario',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.savedUsers.length)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.mockEmails)).toBe(1);
  expect(await page.evaluate(()=>{
    const user=window.savedUsers[0], mail=window.emailBodies[0];
    return user.contrasena.length===20 && mail.htmlContent.includes(user.contrasena)
      && mail.htmlContent.includes('&lt;b&gt;Usuario de prueba&lt;/b&gt;')
      && !mail.htmlContent.includes('<b>Usuario de prueba</b>')
      && mail.to.includes(user.correo) && mail.permissionKey==='admin.usuarios.enviar'
      && !document.body.textContent.includes(user.contrasena);
  })).toBe(true);
  await expect(page.getByRole('button',{name:'Guardar Usuario',exact:true})).toHaveCount(0);
  if (failEmail) {
    await expect(page.getByText('No se pudo enviar el correo de bienvenida.',{exact:false})).toBeVisible();
    await page.evaluate(()=>{window.failEmail=false;});
    await page.getByRole('button',{name:'Reintentar envío del correo'}).click();
    await expect.poll(()=>page.evaluate(()=>window.mockEmails)).toBe(2);
    expect(await page.evaluate(()=>window.savedUsers.length===1 && window.emailBodies[0].htmlContent===window.emailBodies[1].htmlContent)).toBe(true);
  }
  await expect(page.getByText('Usuario creado. Correo de bienvenida enviado a prueba@example.invalid.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Reintentar envío del correo'})).toHaveCount(0);
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('button',{name:'Agregar Usuario',exact:true}).click();
  await expect(page.getByRole('button',{name:'Guardar Usuario',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cerrar usuario',exact:true}).click();
  await page.getByRole('button',{name:'Editar usuario',exact:true}).click();
  await expect(page.getByPlaceholder('Dejar vacío para conservarla')).toHaveValue('');
  await page.getByRole('button',{name:'Guardar Usuario',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.savedUpdates.length)).toBe(1);
  expect(await page.evaluate(()=>!Object.hasOwn(window.savedUpdates[0],'contrasena'))).toBe(true);
  expect(await page.evaluate(()=>window.mockEmails)).toBe(failEmail?2:1);
}
