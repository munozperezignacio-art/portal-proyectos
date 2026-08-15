import { expect, test } from '@playwright/test';

test('la portada comunica la propuesta y permite llegar al acceso', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('La obra avanza');
  await expect(page.getByRole('img', { name: 'Obraxis', exact: true }).first()).toBeVisible();
  const desktopAccess = page.getByRole('button', { name: 'Iniciar sesión' });
  const mobileAccess = page.getByRole('button', { name: 'Solicitar acceso' });
  await (await desktopAccess.isVisible() ? desktopAccess : mobileAccess).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Portal de Proyectos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ingresar al Portal' })).toBeVisible();
});

test('el formulario comercial conserva sus campos y validación nativa', async ({ page }) => {
  await page.goto('/#contacto');
  const submit = page.getByRole('button', { name: 'Solicitar cotización' });
  await expect(submit).toBeVisible();
  await submit.click();
  await expect(page.getByLabel('Nombre *')).toBeFocused();
  await page.getByLabel('Nombre *').fill('Empresa de prueba');
  await page.getByLabel('Correo *').fill('contacto@ejemplo.cl');
  await page.getByLabel('¿Qué necesitas resolver? *').fill('Controlar avances y costos de obra.');
  await expect(page.getByLabel('Correo *')).toHaveValue('contacto@ejemplo.cl');
});

test('la portada móvil no genera desborde horizontal', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Control específico para viewport móvil');
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('link', { name: 'Contáctanos' })).toBeVisible();
});
