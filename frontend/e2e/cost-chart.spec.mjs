import {test,expect} from '@playwright/test';
test('cost chart uses allocations and payroll without requiring overrun alerts',async({page})=>{
  await page.goto('/e2e/fixtures/project-profile.html?budget&advance&chartCosts');
  await page.getByRole('button',{name:/Estatus de la Obra/}).click();
  await page.getByRole('button',{name:/Costos & EVM/}).click();
  await expect(page.getByText(/Venta: \$90.000 \| Costo: \$800/)).toBeVisible();
  await expect(page.getByText('Costos de obra sin imputar a partidas: $400',{exact:true})).toBeVisible();
  await expect(page.getByText(/Costo: \$999.999/)).toHaveCount(0);
});
