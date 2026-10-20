import test from 'node:test';
import assert from 'node:assert/strict';
import {costSupplierFields} from './costSupplier.js';
test('normaliza RUT y nombre sin modificar monto ni imputaciones',()=>{
  const form={proveedor_nombre:' Proveedor de prueba ',proveedor_rut:'123456785',monto:800000,imputaciones:[{partida:'A',porcentaje:100}]};
  assert.deepEqual(costSupplierFields(form),{proveedor_nombre:'Proveedor de prueba',proveedor_rut:'12.345.678-5'});
  assert.equal(form.proveedor_nombre,' Proveedor de prueba ');assert.equal(form.monto,800000);
});
test('costos antiguos e internos admiten proveedor vacío',()=>{
  assert.deepEqual(costSupplierFields({}),{proveedor_rut:null,proveedor_nombre:null});
  assert.deepEqual(costSupplierFields({proveedor_rut:null,proveedor_nombre:null}),{proveedor_rut:null,proveedor_nombre:null});
});
test('factura exige razón social y RUT del emisor; gastos internos no',()=>{
  for(const asociar_factura of [true,'SI']){
    assert.throws(()=>costSupplierFields({asociar_factura}),/razón social y el RUT de su emisor/);
    assert.throws(()=>costSupplierFields({asociar_factura,proveedor_nombre:'Emisor'}),/su emisor/);
    assert.deepEqual(costSupplierFields({asociar_factura,proveedor_nombre:'Empresa emisora',proveedor_rut:'123456785'}),{proveedor_nombre:'Empresa emisora',proveedor_rut:'12.345.678-5'});
  }
  assert.deepEqual(costSupplierFields({asociar_factura:'NO'}),{proveedor_nombre:null,proveedor_rut:null});
});
test('impide guardar un RUT inválido o datos de proveedor incompletos',()=>{
  assert.throws(()=>costSupplierFields({proveedor_nombre:'Empresa'}),/Completa/);
  assert.throws(()=>costSupplierFields({proveedor_rut:'123456785'}),/Completa/);
  assert.throws(()=>costSupplierFields({proveedor_nombre:'Empresa',proveedor_rut:'123456789'}),/no es válido/);
});
