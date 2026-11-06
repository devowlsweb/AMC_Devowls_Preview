import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,validState,validateFormula,parseQuantity,scaleFormula,planProduction,filterItems,escapeHTML,readState,writeState} from '../src/model.js';

test('seed has valid references and consistent records',()=>{
  const s=seed();assert.ok(validState(s));
  for(const p of s.products.filter(p=>p.formula.length))assert.deepEqual(validateFormula(p.formula,s.materials),[]);
});
test('quantities accept decimal comma and reject invalid, negative, zero and non-finite values',()=>{
  assert.equal(parseQuantity(' 1,25 '),1.25);assert.equal(parseQuantity('0.125'),.125);
  for(const q of ['',0,'-1','Infinity','1e10','1.2.3','NaN']){
    assert.ok(validateFormula([{materialId:'m1',quantity:q,unit:'L'}],seed().materials).some(e=>e.field==='quantity'));
  }
});
test('formula requires a component, existing reference and valid unit',()=>{
  assert.ok(validateFormula([],seed().materials).length);
  const errs=validateFormula([{materialId:'missing',quantity:1,unit:'ton'}],seed().materials);
  assert.deepEqual(errs.map(x=>x.field),['materialId','unit']);
});
test('scaling uses the original reference and preserves the materials and units',()=>{
  const original=seed().products[1].formula;
  const doubled=scaleFormula(original,0,'110');
  assert.deepEqual(doubled.map(r=>r.quantity),[110,25,400]);
  assert.deepEqual(scaleFormula(original,1,'6,25').map(r=>r.quantity),[27.5,6.25,100]);
  assert.deepEqual(doubled.map(({materialId,unit})=>[materialId,unit]),[['m8','L'],['m2','kg'],['m7','g']]);
  assert.equal(original[1].quantity,12.5);
  assert.equal(scaleFormula(original,0,0),null);
  assert.equal(scaleFormula(original,3,110),null);
  assert.equal(scaleFormula(original,1,1e308),null);
});
test('production groups repeated materials, converts matching units and checks stock',()=>{
  const {products,materials}=seed();
  const rows=[{materialId:'m2',quantity:249.5,unit:'kg'},{materialId:'m2',quantity:500,unit:'g'}];
  const planned=planProduction(products[1],rows,materials,10.5,'L');
  assert.equal(planned.quantityError,'');
  assert.deepEqual(planned.errors,[]);
  assert.deepEqual(planned.productStock,{quantity:100.5,unit:'L'});
  assert.deepEqual(planned.consumption.map(({used,remaining})=>[used,remaining]),[[250,0]]);
  rows[1].quantity=501;
  assert.match(planProduction(products[1],rows,materials,10.5,'L').errors[0],/stock insuficiente/);
  rows[1].unit='mL';
  assert.match(planProduction(products[1],rows,materials,10.5,'L').errors[0],/unidad de la fórmula/);
  assert.equal(materials[1].stock.quantity,250);
});
test('saved catalogs from before stock retain their formulas and receive demo balances',()=>{
  const old=seed();
  for(const record of [...old.products,...old.materials])delete record.stock;
  old.products[0].formula[0].quantity=85;
  const {state,warning}=readState({getItem:()=>JSON.stringify(old)});
  assert.equal(warning,'');
  assert.equal(state.products[0].formula[0].quantity,85);
  assert.deepEqual(state.products[0].stock,{quantity:120,unit:'L'});
  assert.deepEqual(state.materials[0].stock,{quantity:1000,unit:'L'});
});
test('mixed units remain independent and inactive references remain valid',()=>{
  const s=seed();s.materials[0].active=false;
  assert.deepEqual(validateFormula(s.products[0].formula,s.materials),[]);
  assert.ok(validState(s));
});
test('search normalizes accents and applies category, activity and formula filters',()=>{
  const s=seed();
  assert.equal(filterItems(s.products,{query:'jabon'})[0].id,'p5');
  assert.equal(filterItems(s.products,{query:'PR-001'})[0].name,'Limpiador multiuso');
  assert.equal(filterItems(s.products,{formula:'pending'}).length,2);
  assert.equal(filterItems(s.products,{category:'Lavandería'}).length,1);
});
test('storage failures do not crash or overwrite corrupt data during reads',()=>{
  let calls=0;const broken={getItem(){return '{"bad":true}';},setItem(){calls++;throw new Error('quota');}};
  assert.ok(readState(broken).warning);assert.equal(calls,0);
  assert.equal(writeState(broken,seed()),false);assert.equal(calls,1);
  const s=seed();s.products[0].formula[0].materialId='missing';assert.equal(validState(s),false);
});
test('user supplied text is escaped for HTML output',()=>{
  assert.equal(escapeHTML('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
