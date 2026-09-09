import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {STORAGE_KEY} from '../src/model.js';

test('complete demo journey',async t=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'http://localhost/amc-demo/#/productos',pretendToBeVisual:true});
  const w=dom.window;
  for(const key of ['window','document','location','history','localStorage','FormData'])globalThis[key]=key==='window'?w:w[key];
  w.scrollTo=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const $=selector=>w.document.querySelector(selector);
  const click=selector=>{const el=$(selector);assert.ok(el,'Expected '+selector);el.click();};
  const input=(selector,value)=>{const el=$(selector);assert.ok(el);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
  const change=(selector,value)=>{const el=$(selector);el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
  const go=async hash=>{w.location.hash=hash;await tick();};
  const submit=selector=>$(selector).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await import('../src/app.js');
  await tick();
  await t.test('catalog is usable immediately and accent-insensitive search works',()=>{
    assert.match($('h1').textContent,/Tus productos/);
    assert.equal(w.document.querySelectorAll('tbody tr').length,6);
    input('#search','jabon');assert.equal(w.document.querySelectorAll('tbody tr').length,1);
    assert.match($('tbody').textContent,/Jabón líquido/);
    input('#search','');
  });
  await t.test('invalid formula stays unsaved and errors are connected to controls',async()=>{
    await go('/productos/p1');
    input('#quantity-0','0');submit('#formula-form');
    assert.equal($('#quantity-0').getAttribute('aria-invalid'),'true');
    assert.match($('#error-quantity-0').textContent,/mayor que cero/);
    assert.equal(w.localStorage.getItem(STORAGE_KEY),null);
  });
  await t.test('decimal comma saves, updates audit and persists',()=>{
    input('#quantity-0','82,5');submit('#formula-form');
    const saved=JSON.parse(w.localStorage.getItem(STORAGE_KEY));
    assert.equal(saved.products[0].formula[0].quantity,82.5);
    assert.equal(saved.products[0].audit[0].action,'Fórmula guardada');
    assert.match($('#save-state').textContent,/Sin cambios/);
  });
  await t.test('notes are safely rendered after saving',()=>{
    input('#formula-notes','</textarea><img src=x onerror="alert(1)">');
    submit('#formula-form');
    assert.equal(w.document.querySelectorAll('img').length,0);
    assert.match($('#formula-notes').value,/<img/);
  });
  await t.test('unsaved route changes can be cancelled',async()=>{
    input('#quantity-0','99');
    await go('/materias-primas');assert.equal($('#confirm').open,true);
    click('#confirm-no');await tick();
    assert.equal(location.hash,'#/productos/p1');assert.equal($('#quantity-0').value,'99');
    click('[data-action="discard-formula"]');await tick();click('#confirm-yes');await tick();
    assert.equal($('#quantity-0').value,'82,5');
  });
  await t.test('consultation profile removes all mutation actions',async()=>{
    change('#profile','viewer');await tick();
    assert.equal($('[data-action="add-row"]'),null);
    assert.equal($('[data-action="edit-product"]'),null);
    assert.equal($('#quantity-0').readOnly,true);
    await go('/materias-primas');assert.equal($('[data-action="new-material"]'),null);
    change('#profile','admin');await tick();
  });
  await t.test('new material becomes available inside the formula editor',async()=>{
    click('[data-action="new-material"]');await tick();
    input('#name','Componente reunión');input('#code','MP-REUNION');
    change('#entity-unit','mL');submit('#entity-form');await tick();
    assert.match($('#list-results').textContent,/Componente reunión/);
    await go('/productos/p1');click('[data-action="add-row"]');
    const select=$('#material-4');
    const option=[...select.options].find(o=>o.textContent==='Componente reunión');
    assert.ok(option);change('#material-4',option.value);
    assert.equal($('#unit-4').value,'mL');
    input('#quantity-4','20');submit('#formula-form');
    assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).products[0].formula.length,5);
  });
  await t.test('duplicate codes are rejected and new product flows into its formula',async()=>{
    await go('/productos');click('[data-action="new-product"]');await tick();
    input('#name','Producto de reunión');input('#code','PR-001');submit('#entity-form');
    assert.match($('#code-error').textContent,/Ya existe/);
    input('#code','PR-REUNION');submit('#entity-form');await tick();
    assert.equal($('h1').textContent,'Producto de reunión');
    submit('#formula-form');assert.match($('#formula-summary').textContent,/al menos un componente/);
    click('[data-action="add-row"]');change('#material-0','m1');input('#quantity-0','1');submit('#formula-form');
    assert.match($('#save-state').textContent,/Sin cambios/);
  });
  await t.test('deactivation retains formulas and makes product read-only',async()=>{
    click('[data-action="edit-product"]');await tick();
    change('#entity-active','false');submit('#entity-form');await tick();
    assert.equal($('[data-action="add-row"]'),null);
    const p=JSON.parse(localStorage.getItem(STORAGE_KEY)).products.find(p=>p.code==='PR-REUNION');
    assert.equal(p.active,false);assert.equal(p.formula.length,1);
  });
  await t.test('reset restores a repeatable presentation and unknown routes are recoverable',async()=>{
    click('#reset');await tick();click('#confirm-yes');await tick();
    assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).products.length,6);
    assert.match($('h1').textContent,/Tus productos/);
    await go('/productos/no-existe');
    assert.match($('h1').textContent,/No encontramos/);
  });
  dom.window.close();
});
