import {test,expect} from '@playwright/test';
test('prefetched and stored indicators work without contacting providers or waiting for a refresh',async({page})=>{
  await page.clock.install({time:new Date('2026-10-19T15:00:00Z')});
  let reads=0,refreshes=0,providerRequests=0;
  const rows=[{moneda:'UF',fecha:'2026-10-19',valor:41183.94,fuente:'indicadores.cl'},{moneda:'USD',fecha:'2026-10-19',valor:981.65,fuente:'indicadores.cl'}];
  await page.route('https://currency-cache.example.invalid/**',async route=>{
    if(route.request().url().endsWith('/read')){reads++;await route.fulfill({json:rows});}
    else{refreshes++;await route.fulfill({status:503,json:[]});}
  });
  await page.route('https://mindicador.cl/**',r=>{providerRequests++;return r.abort();});
  await page.goto('/e2e/fixtures/partida-currency.html?prefetch');
  await expect(page.getByLabel('Valor de 1 UF en CLP')).toHaveValue('41183.94');
  await expect(page.getByText(/Valor automático guardado/)).toContainText('2026-10-19');
  await page.getByLabel('Moneda',{exact:true}).selectOption('USD');
  await expect(page.getByLabel('Valor de 1 USD en CLP')).toHaveValue('981.65');
  expect(reads).toBe(1);expect(refreshes).toBe(0);expect(providerRequests).toBe(0);
  // Abrir de nuevo con el respaldo local y servidor fuera de línea.
  await page.unroute('https://currency-cache.example.invalid/**');
  await page.route('https://currency-cache.example.invalid/**',r=>r.abort());
  await page.reload();
  await expect(page.getByLabel('Valor de 1 UF en CLP')).toHaveValue('41183.94');
  await page.goto('/e2e/fixtures/partida-currency.html?saved=39999');
  await expect(page.getByLabel('Valor de 1 UF en CLP')).toHaveValue('39999');
  await expect(page.getByText(/Conversión guardada/)).toBeVisible();
});
test('missing cache has a recoverable error; manual entries and currency changes are not overwritten',async({page})=>{
  await page.clock.install({time:new Date('2026-10-19T15:00:00Z')});
  let fail=true;
  await page.route('https://currency-cache.example.invalid/**',async route=>{
    if(route.request().url().endsWith('/read'))return route.fulfill({json:[]});
    return route.fulfill({status:fail?503:200,json:[{moneda:'UF',fecha:'2026-10-19',valor:41183.94,fuente:'indicadores.cl'}]});
  });
  await page.goto('/e2e/fixtures/partida-currency.html');
  await expect(page.getByText(/No hay un indicador guardado/)).toBeVisible();
  fail=false;await page.getByRole('button',{name:'Reintentar'}).click();
  await expect(page.getByLabel('Valor de 1 UF en CLP')).toHaveValue('41183.94');
  await page.getByLabel('Valor de 1 UF en CLP').fill('40000');
  await expect(page.getByLabel('Valor de 1 UF en CLP')).toHaveValue('40000');
  await page.getByLabel('Moneda',{exact:true}).selectOption('CLP');
  await expect(page.getByLabel(/Valor de 1/)).toHaveCount(0);
});
