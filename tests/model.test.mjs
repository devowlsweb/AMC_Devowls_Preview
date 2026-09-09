import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,validState,validateFormula,parseQuantity,filterItems,escapeHTML,readState,writeState} from '../src/model.js';

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
