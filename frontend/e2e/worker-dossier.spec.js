import {test,expect} from '@playwright/test';

test('ficha muestra documentos, calendario real/asignado y haberes sin escribir datos',async({page},testInfo)=>{
 await page.goto('/e2e/fixtures/worker-dossier.html');
 await expect(page.getByText('contrato.pdf')).toBeVisible();
 await page.getByRole('tab',{name:'Calendario',exact:true}).click();
 await page.getByLabel('Mes de la ficha').fill('2026-10');
 await page.getByRole('button',{name:'Ver día 2026-10-05',exact:true}).click();
 const detail=page.getByRole('region',{name:'Detalle del día'});
 await expect(detail).toContainText('020 · Obra Norte');
 await expect(detail).toContainText('08:00–18:00');
 await expect(detail).toContainText('2 h');
 await expect(detail).toContainText('Sin aprobación');
 await expect(page.getByText('Obra ajena')).toHaveCount(0);
 await page.screenshot({path:testInfo.outputPath('calendario.png'),fullPage:true});
 await page.getByRole('button',{name:'Ver día 2026-10-06',exact:true}).click();
 await expect(detail).toContainText('Sin marcajes');
 await expect(detail).toContainText('020 · Obra Norte');
 await page.getByRole('button',{name:'Ver día 2026-10-07',exact:true}).click();
 await expect(detail).toContainText('Sin asignaciones');
 await page.getByRole('tab',{name:'Asignaciones y haberes'}).click();
 await expect(page.getByText('$700.000',{exact:true})).toBeVisible();
 await expect(page.getByRole('table')).toContainText('2026-10-05');
 await page.getByRole('button',{name:'Mes siguiente'}).click();
 await expect(page.getByLabel('Mes de la ficha')).toHaveValue('2026-11');
 await expect(page.getByRole('table')).toContainText('2026-11-30');
 const queries=await page.evaluate(()=>window.queries);
 expect(queries.every(q=>q.filters.some(f=>f[0]==='eq'&&f[1]==='empresa'&&f[2]==='TEST'))).toBeTruthy();
 expect(queries.some(q=>q.filters.some(f=>['insert','update','upsert','delete'].includes(f[0])))).toBeFalsy();
});

test('fallo de carga no se presenta como ausencia y permite reintentar',async({page})=>{
 await page.goto('/e2e/fixtures/worker-dossier.html');
 await page.evaluate(()=>{window.fail=true;});
 await page.getByRole('tab',{name:'Calendario',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Error de prueba');
 await expect(page.getByRole('button',{name:/Ver día/})).toHaveCount(0);
 await page.evaluate(()=>{window.fail=false;});
 await page.getByRole('button',{name:'Reintentar'}).click();
 await expect(page.getByRole('button',{name:/Ver día/}).first()).toBeVisible();
});
