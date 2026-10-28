import { test, expect } from '@playwright/test';

test('designer reorders whole fields with drag handle and accessible arrows', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.goto('/');
  await page.evaluate(async () => {
    const reactModule = await import('/node_modules/.vite/deps/react.js');
    const React = reactModule.default || reactModule;
    const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = domModule.default || domModule;
    const { default: Designer } = await import('/src/components/FormulariosCapacitaciones.jsx');
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    createRoot(host).render(React.createElement(Designer, { user: { empresa: 'DEMO', rol: 'Administrador' }, onBack: () => {} }));
  });
  await page.getByText('Crear Nuevo', { exact: true }).click();
  await page.getByRole('button', { name: '+ Fecha', exact: true }).click();
  await page.getByRole('button', { name: '+ Hora', exact: true }).click();
  const cards = page.locator('[data-field-id]');
  const labels = () => cards.locator('input[type=text]').evaluateAll(inputs => inputs.map(input => input.value));
  expect(await labels()).toEqual(['Nombre o Título', 'Nuevo campo (date)', 'Nuevo campo (time)']);
  await page.getByRole('button', { name: 'Arrastrar Nuevo campo (time)', exact: true }).dragTo(cards.first());
  expect(await labels()).toEqual(['Nuevo campo (time)', 'Nombre o Título', 'Nuevo campo (date)']);
  await page.getByRole('button', { name: 'Bajar Nuevo campo (time)', exact: true }).click();
  expect(await labels()).toEqual(['Nombre o Título', 'Nuevo campo (time)', 'Nuevo campo (date)']);
  await expect(page.getByRole('button', { name: 'Subir Nombre o Título', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Bajar Nuevo campo (date)', exact: true })).toBeDisabled();
});
