import { test, expect } from '@playwright/test';

// Monta el componente real sin requerir credenciales ni modificar datos de la empresa.
test.beforeEach(async ({ page }) => {
  await page.route('**/__impact-manual-test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/@vite/client');
    await import('/src/index.css');
    const reactModule = await import('/node_modules/.vite/deps/react.js');
    const React = reactModule.default || reactModule;
    const client = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot = client.createRoot || client.default.createRoot;
    const { default: Manual } = await import('/src/components/ImpactManual.jsx');
    createRoot(document.getElementById('root')).render(React.createElement(Manual));
    </script></body></html>` }));
  await page.goto('/__impact-manual-test');
});

test('permite recorrer los 20 pasos, ampliar fotos y consultar los controles', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Abrir paso a paso' }).click();
  await expect(page.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
  await expect(page.getByText('El documento no incluye una fotografía específica de esta acción.')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.getByRole('button', { name: 'Ampliar fotografía:' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveJSProperty('naturalWidth', 874);
  await page.getByRole('button', { name: 'Cerrar fotografía' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Ir al paso', { exact: true }).selectOption('11');
  await page.getByText('Detalle técnico y controles', { exact: true }).click();
  await expect(page.getByText(/Torque indicado: 850 lb·ft/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('manual-impact.png'), fullPage: true });
  for (let position = 0; position < 20; position++) {
    await page.getByLabel('Ir al paso', { exact: true }).selectOption(String(position));
    await expect(page.getByText(`Paso ${position + 1} de 20`, { exact: true })).toBeVisible();
    const image = page.locator('article img');
    if (await image.count()) await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled();
  await expect(page.getByText(/La lectura no reemplaza/)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar manual', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir paso a paso' })).toBeFocused();
});
