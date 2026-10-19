import {test,expect} from '@playwright/test';
test('missing UF rate loads on opening; USD, saved rates, retry and cancellation stay consistent',async({page})=>{
  let requests=0;let fail=false;let delay=0;
  await page.route('https://mindicador.cl/**',async route=>{
    requests++;const code=route.request().url().endsWith('/uf')?'uf':'dolar';
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    await route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify({codigo:code,serie:[{fecha:'2026-10-19T03:00:00Z',valor:code==='uf'?40234.56:950.25}]})});
  });
  await page.clock.install({time:new Date('2026-10-19T15:00:00Z')});
  const url='/e2e/fixtures/partida-currency.html';
  await page.goto(url);
  await expect(page.getByLabel('Valor de 1 UF en CLP')).toHaveValue('40234.56');
  await expect(page.getByText(/Valor automático/)).toContainText('2026-10-19');
  await page.getByLabel('Moneda',{exact:true}).selectOption('USD');
  await expect(page.getByLabel('Valor de 1 USD en CLP')).toHaveValue('950.25');
  const before=requests;await page.goto(url+'?saved=39999');
  await expect(page.getByLabel('Valor de 1 UF en CLP')).toHaveValue('39999');
  await expect(page.getByText(/Conversión guardada/)).toBeVisible();expect(requests).toBe(before);
  fail=true;await page.goto(url);await expect(page.getByText(/No se pudo obtener/)).toBeVisible();
  fail=false;await page.getByRole('button',{name:'Reintentar'}).click();
  await expect(page.getByLabel('Valor de 1 UF en CLP')).toHaveValue('40234.56');
  delay=350;await page.getByLabel('Moneda',{exact:true}).selectOption('USD');
  await page.getByLabel('Valor de 1 USD en CLP').fill('925');
  await page.waitForTimeout(500);await expect(page.getByLabel('Valor de 1 USD en CLP')).toHaveValue('925');
  await page.getByLabel('Moneda',{exact:true}).selectOption('UF');
  await page.getByLabel('Moneda',{exact:true}).selectOption('CLP');
  await page.waitForTimeout(500);await expect(page.getByLabel(/Valor de 1/)).toHaveCount(0);
});
