import {test,expect} from '@playwright/test';
test('unallocated imported OC contributes net cost in statistics',async({page})=>{
  await page.goto('/e2e/fixtures/project-profile.html?budget&importedOC');
  await page.getByRole('button',{name:/Estatus de la Obra/}).click();
  await page.getByRole('button',{name:/Control Ejecutivo/}).click();
  const summary=page.getByRole('region',{name:'Costos registrados en estadísticas'});
  await expect(summary.getByText('$15.700.000',{exact:true})).toHaveCount(2);
  await page.getByRole('button',{name:/Costos & EVM/}).click();
  await expect(page.getByText('Costos de obra sin imputar a partidas: $15.700.000',{exact:true})).toBeVisible();
  await expect(summary.getByText('$18.683.000',{exact:true})).toHaveCount(0);
});
test('cost chart uses allocations and payroll without requiring overrun alerts',async({page})=>{
  await page.goto('/e2e/fixtures/project-profile.html?budget&advance&chartCosts');
  await page.getByRole('button',{name:/Estatus de la Obra/}).click();
  await page.getByRole('button',{name:/Costos & EVM/}).click();
  await expect(page.getByText(/Venta: \$90.000 \| Costo: \$800/)).toBeVisible();
  await expect(page.getByText('Costos de obra sin imputar a partidas: $400',{exact:true})).toBeVisible();
  await expect(page.getByText(/Costo: \$999.999/)).toHaveCount(0);
  const distribution=page.getByRole('region',{name:'Distribución y detalle de costos'});
  await expect(distribution.getByRole('img')).toHaveAttribute('aria-label',/Personal \$200/);
  await distribution.locator('summary').filter({hasText:'Ingeniería, suministro'}).click();
  await expect(distribution.getByRole('cell',{name:'$600',exact:true})).toBeVisible();
  await expect(distribution.getByRole('cell',{name:'$200',exact:true})).toBeVisible();
  await distribution.locator('summary').filter({hasText:'Sin imputar'}).click();
  await expect(distribution.getByRole('cell',{name:'$400',exact:true})).toBeVisible();
  await expect(distribution.getByText('$999.999',{exact:true})).toHaveCount(0);
});
