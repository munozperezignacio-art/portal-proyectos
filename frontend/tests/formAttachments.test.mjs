import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFormAnswers,removeHiddenAnswers} from '../../supabase/functions/_shared/formFields.mjs';
const image={name:'inspeccion.png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII='};
const fields=[{id:'hallazgo',type:'radio',options:['Sí','No'],required:true},{id:'evidencia',type:'attachments',required:true,maxFiles:2,showWhen:{fieldId:'hallazgo',equals:'Sí'}}];
test('la condición no exige ni guarda imágenes ocultas',()=>{const a={hallazgo:'No',evidencia:[image]};removeHiddenAnswers(fields,a);assert.deepEqual(a,{hallazgo:'No'});assert.deepEqual(validateFormAnswers(fields,a),[])});
test('al activar la condición se conservan dos adjuntos y se respeta el límite',()=>{const a={hallazgo:'Sí',evidencia:[image,{...image,name:'otra.png'}]};assert.deepEqual(validateFormAnswers(fields,JSON.parse(JSON.stringify(a))),[]);for(const evidencia of [[],[image,image,image],[{...image,data:'texto'}]])assert.ok(validateFormAnswers(fields,{...a,evidencia}).length)});
