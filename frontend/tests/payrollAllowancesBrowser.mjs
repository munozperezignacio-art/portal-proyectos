import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:4181/e2e/fixtures/payroll-allowance-modes.html');
 const emit=()=>page.getByRole('button',{name:'Liquidación',exact:true}).click();
 await emit();assert.equal(JSON.parse(await page.getByTestId('liquidation').textContent())[0].amount,200000);
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByText('Borrador mensual guardado.',{exact:true}).waitFor();
 await page.reload();await emit();assert.equal(JSON.parse(await page.getByTestId('liquidation').textContent())[0].amount,200000);
 await page.getByRole('button',{name:'Cerrar nómina mensual',exact:true}).click();await page.getByText('Nómina cerrada y conciliada:',{exact:false}).waitFor();
 await page.evaluate(()=>localStorage.setItem('test-no-marks','true'));await page.reload();await emit();
 assert.equal(JSON.parse(await page.getByTestId('liquidation').textContent())[0].amount,200000);
 assert.ok(await page.getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled());
 await page.evaluate(()=>{localStorage.removeItem('test-payroll-header');localStorage.removeItem('test-payroll-items');});await page.reload();
 await page.getByRole('alert').waitFor();assert.ok(await page.getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled());assert.ok(await page.getByRole('button',{name:'Liquidación',exact:true}).isDisabled());
 console.log('PASS: full monthly amount, draft save/reopen, closed snapshot preserved after changed marks, no-marks draft blocked');
}finally{await browser.close();}
