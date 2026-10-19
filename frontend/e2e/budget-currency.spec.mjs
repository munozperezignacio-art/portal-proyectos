import {test,expect} from '@playwright/test';
export async function verifyBudgetCurrency(page){
  await page.goto('/e2e/fixtures/project-profile.html?budget&currencies');
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:'Plan y Control de Obra',exact:true})}).click();
  const table=page.getByRole('table',{name:'Partidas del presupuesto de obra'});
  await expect(table.getByText('$1.688,54',{exact:true})).toBeVisible();
  await expect(table.getByRole('spinbutton')).toHaveCount(0);
  const before=await page.evaluate(()=>window.saves.length);
  await page.getByRole('button',{name:'Moneda original',exact:true}).click();
  await expect(page.getByRole('button',{name:'Moneda original',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(table.getByText('UF 0,04',{exact:true})).toBeVisible();
  await expect(table.getByText('UF 1.257,83',{exact:true})).toBeVisible();
  const total=page.getByLabel('Total presupuesto mostrado');
  await expect(total.getByText('UF 1.257,83',{exact:true})).toBeVisible();
  await expect(total.getByText('USD 2',{exact:true})).toBeVisible();
  await expect(total.getByText('$500',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Pesos (CLP)',exact:true}).click();
  await expect(table.getByText('$1.688,54',{exact:true})).toBeVisible();
  await expect(table.getByRole('spinbutton')).toHaveCount(0);
  expect(await page.evaluate(()=>window.saves.length)).toBe(before);
  await table.locator('tbody tr').filter({hasText:'Ingeniería, suministro y montaje sistema Hidrosembrado EMIN'}).getByTitle('Editar partida',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Editar Partida de Obra',exact:true})).toBeVisible();
  expect(await page.locator('input[type="number"]').evaluateAll(inputs=>inputs.some(input=>Number(input.value)===0.041))).toBe(true);
}
test('quick switch displays original currencies and CLP without saving or mixing totals',async({page})=>{await verifyBudgetCurrency(page);});
