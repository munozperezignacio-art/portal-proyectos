import {test,expect} from '@playwright/test';
test('commercial forecast needs no manual cost budget and exposes estimates',async({page})=>{
 await page.goto('/e2e/fixtures/target-commercial.html');
 const card=label=>page.getByText(label,{exact:true}).locator('..');
 await expect(card('Venta al término (100%)')).toContainText('1.000.000');
 await expect(card('Costo final estimado')).toContainText('1.100.000');
 await expect(card('Resultado estimado (venta − costo)')).toContainText('$-100.000');
 await expect(card('Margen estimado')).toContainText('-10%');
 await expect(page.getByLabel('Presupuesto de costo Pilotes')).not.toBeVisible();
 await page.getByText('Desglose del costo estimado',{exact:true}).click();
 await expect(card('Estimación residual de personal y otros')).toContainText('400.000');
 await page.getByLabel('Avance objetivo Pilotes').fill('60');
 await expect(card('Venta del avance objetivo')).toContainText('600.000');
 await expect(card('Costo estimado a fecha objetivo')).toContainText('800.000');
 await page.getByLabel('Fecha objetivo del escenario').fill('2027-01-04');
 await expect(card('Costo estimado a fecha objetivo')).toContainText('Falta información');
 await expect(page.getByText(/excede el horizonte/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
