import { test, expect } from '@playwright/test';
test('published form QR opens and downloads the public link image', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: route.request().url().includes('/prevencion_formularios?') ? [{id:9,titulo:'HCR de prueba',publico_token:'FORM_TEST_QR',campos:[]}] : [] }));
  await page.goto('/');
  await page.evaluate(async () => {
    const reactModule=await import('/node_modules/.vite/deps/react.js');
    const React=reactModule.default||reactModule;
    const domModule=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {createRoot}=domModule.default||domModule;
    const {default:Designer}=await import('/src/components/FormulariosCapacitaciones.jsx');
    const host=document.createElement('div');document.body.replaceChildren(host);
    createRoot(host).render(React.createElement(Designer,{user:{empresa:'DEMO',rol:'Administrador'},onBack:()=>{}}));
  });
  await page.getByText('Ver Listado',{exact:true}).click();
  await page.getByRole('button',{name:'Ver / descargar QR',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Código QR del formulario'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link',{name:'Abrir formulario'})).toHaveAttribute('href','http://127.0.0.1:4173/?prevencion_form=FORM_TEST_QR');
  await expect(dialog.getByRole('img')).toHaveAttribute('src',/^data:image\/png;base64,/);
  expect(await dialog.getByRole('img').evaluate(image=>image.naturalWidth)).toBe(900);
  const downloadPromise=page.waitForEvent('download');
  await dialog.getByRole('link',{name:'Descargar QR (PNG)'}).click();
  expect((await downloadPromise).suggestedFilename()).toBe('QR-formulario-9.png');
  await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
  await expect(dialog).toHaveCount(0);
});
