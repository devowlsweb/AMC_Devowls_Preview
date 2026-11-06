import {STORAGE_KEY, categories, materialCategories, units, productStockUnits, seed, clone, escapeHTML as esc, normalize, parseQuantity, scaleFormula, validateFormula, validStockQuantity, planProduction, readState, writeState, filterItems} from './model.js';
import {icon} from './icons.js';

const $ = selector => document.querySelector(selector);
let storageSnapshot;
const loaded = (()=>{try{storageSnapshot=localStorage.getItem(STORAGE_KEY);return readState({getItem:()=>storageSnapshot});}catch{return {state:seed(),warning:'El almacenamiento local no está disponible. Los cambios durarán mientras esta página siga abierta.'};}})();
let state=loaded.state, role='admin', route='', draft=null, original='', toastTimer, modalDirty=false;
let formulaReturn='/productos';
let calculation=null;
const calculatorPath='/formulas/calculadora';
let filters={query:'',category:'',status:'active',formula:'all'};
const main=$('#main'), modal=$('#modal');
const editable=()=>role==='admin';
const currentProduct=()=>state.products.find(p=>route===`/productos/${p.id}`);
const isDirty=()=>draft!==null&&JSON.stringify(draft)!==original;
const isCalculator=()=>route.split('?')[0]===calculatorPath;
const calculationDirty=()=>calculation&&(calculation.invalidIndex!==null||
  calculation.rows.some((row,i)=>row.quantity!==calculation.source.formula[i].quantity));
const quantityFormat=new Intl.NumberFormat('es-AR',{useGrouping:false,maximumSignificantDigits:21});
const quantityText=value=>typeof value==='number'?quantityFormat.format(value):String(value).replace('.',',');
const stockText=stock=>stock?`${quantityText(stock.quantity)} ${esc(stock.unit)}`:'Sin existencias';
const date=value=>{
  const d=new Date(value);
  return Number.isNaN(d.valueOf())?'—':new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(d);
};
const time=value=>{const d=new Date(value);return Number.isNaN(d.valueOf())?'':new Intl.DateTimeFormat('es-AR',{hour:'2-digit',minute:'2-digit'}).format(d);};
const options=(list,selected,empty='')=>(empty?`<option value="">${esc(empty)}</option>`:'')+list.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
const mark=p=>`<span class="product-mark ${['blue','pink','gold','violet'].includes(p.color)?p.color:''}">${icon('flask')}</span>`;
const badge=p=>!p.active?'<span class="badge inactive">Inactivo</span>':p.formula?.length?'<span class="badge">Con fórmula</span>':'<span class="badge pending">Sin fórmula</span>';
const activeBadge=x=>`<span class="badge ${x.active?'':'inactive'}">${x.active?'Activo':'Inactivo'}</span>`;

function warn(text){$('#storage-warning').textContent=text;$('#storage-warning').hidden=!text;}
warn(loaded.warning);
function persist(next=state){
  let saved=false;
  try{
    if(localStorage.getItem(STORAGE_KEY)!==storageSnapshot){
      warn('Los datos cambiaron en otra pestaña. Recargá la página para ver las existencias actuales.');
      return false;
    }
    saved=writeState(localStorage,next);
    if(saved)storageSnapshot=JSON.stringify(next);
  }catch{}
  if(!saved) warn(next===state?'El cambio está en esta sesión, pero no pudo guardarse en el navegador. No cierres la página si querés conservarlo.':'El navegador no pudo guardar el movimiento de stock.');
  else warn('');
  return saved;
}
function toast(text){
  window.clearTimeout(toastTimer);
  $('#toast').innerHTML=icon('check')+esc(text);
  $('#toast').hidden=false;
  toastTimer=window.setTimeout(()=>$('#toast').hidden=true,4500);
}
function confirmAction(title,message,yes='Continuar'){
  const dialog=$('#confirm');
  $('#confirm-title').textContent=title;$('#confirm-message').textContent=message;
  $('#confirm-yes').textContent=yes;
  return new Promise(resolve=>{
    const finish=value=>{dialog.close();dialog.oncancel=null;resolve(value);};
    $('#confirm-yes').onclick=()=>finish(true);
    $('#confirm-no').onclick=()=>finish(false);
    dialog.oncancel=e=>{e.preventDefault();finish(false);};
    dialog.showModal();$('#confirm-no').focus();
  });
}
function renderNav(){
  const links=[['/productos','box','Productos',state.products.length],['/formulas','flask','Fórmulas',state.products.filter(p=>p.formula.length).length],['/materias-primas','layers','Materias primas',state.materials.length],['/usuarios','users','Perfiles de demo','']];
  const section=isCalculator()?'/formulas':currentProduct()?formulaReturn:route;
  $('#navigation').innerHTML=links.map(([url,i,label,count])=>`<a class="nav-link ${section===url?'active':''}" href="#${url}" ${section===url?'aria-current="page"':''}>${icon(i)}<span>${label}</span>${count!==''?`<span class="nav-count">${count}</span>`:''}</a>`).join('');
}
function heading(kicker,title,description,button=''){
  return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="page-description">${description}</p></div>${button}</div>`;
}
function stat(number,label,i,color=''){
  return `<div class="stat"><div><p class="stat-number">${number.toString().padStart(2,'0')}</p><p class="stat-label">${label}</p></div><span class="stat-icon ${color}">${icon(i)}</span></div>`;
}
function toolbar(material=false){
  return `<div class="toolbar"><div class="search-field">${icon('search')}<label class="sr-only" for="search">Buscar ${material?'materias primas':'productos'}</label><input class="field-control" id="search" type="search" placeholder="Buscar por nombre o código..." value="${esc(filters.query)}" autocomplete="off"></div><label class="sr-only" for="category">Categoría</label><select class="field-control filter-select" id="category">${options(material?materialCategories:categories,filters.category,'Todas las categorías')}</select><label class="sr-only" for="status">Estado</label><select class="field-control filter-select" id="status"><option value="active" ${filters.status==='active'?'selected':''}>Activos</option><option value="inactive" ${filters.status==='inactive'?'selected':''}>Inactivos</option><option value="all" ${filters.status==='all'?'selected':''}>Todos los estados</option></select></div>`;
}
function viewerNotice(){return editable()?'':`<div class="notice">${icon('shield')}Perfil de consulta: podés explorar la información. La edición está deshabilitada en esta demostración.</div>`;}
function formulaTabs(){
  return `<div class="filter-tabs" aria-label="Filtrar por fórmula">${[['all','Todas'],['ready','Con fórmula'],['pending','Sin fórmula']].map(([value,label])=>`<button class="filter-tab" data-formula="${value}" aria-pressed="${filters.formula===value}">${label}</button>`).join('')}</div>`;
}
function renderProducts(){
  const active=state.products.filter(p=>p.active),ready=active.filter(p=>p.formula.length);
  const example=ready[0];
  return `<section class="catalog-hero" aria-labelledby="catalog-heading"><div class="hero-content"><p class="eyebrow hero-kicker"><span></span> Entrega 01 · Demo interactiva</p><h1 id="catalog-heading">Tus productos, en orden.</h1><p>Consultá el catálogo, armá fórmulas y encontrá las materias primas de cada producto.</p><div class="hero-actions"><a class="btn accent" href="#${example?'/productos/'+esc(example.id):'/formulas'}">${icon('flask')}${example?'Explorar una fórmula':'Ver fórmulas'} ${icon('arrow')}</a></div></div><div class="hero-art" aria-hidden="true"><div class="hero-tile hero-package">${icon('box')}</div><div class="hero-tile hero-flask">${icon('flask')}</div><div class="hero-tile hero-layers">${icon('layers')}</div></div></section>`+
    viewerNotice()+`<section class="stats-grid" aria-label="Resumen de productos">${stat(active.length,'Productos activos','box')}${stat(ready.length,'Con fórmula registrada','flask','cyan')}${stat(active.length-ready.length,'Fórmulas por completar','clock','amber')}</section>
    <div class="catalog-layout"><section class="panel" aria-labelledby="catalog-title"><div class="panel-top"><h2 id="catalog-title">Catálogo de productos</h2>${editable()?`<button class="btn primary small" data-action="new-product">${icon('plus')}Nuevo producto</button>`:''}</div>${toolbar()}
    ${formulaTabs()}<div id="list-results"></div></section>
    <aside class="catalog-aside"><section class="panel demo-guide"><span class="stat-icon">${icon('list')}</span><p class="eyebrow">Recorrido de ejemplo</p><h2>De producto a fórmula</h2><ol><li><span>1</span><div><strong>Elegí un producto</strong><p>Abrí una ficha del catálogo.</p></div></li><li><span>2</span><div><strong>Armá la composición</strong><p>Agregá materias primas con sus cantidades y unidades.</p></div></li><li><span>3</span><div><strong>Guardá y consultá</strong><p>Revisá el registro en la actividad del producto.</p></div></li></ol><a class="link-button" href="#/formulas">Ir a Fórmulas ${icon('arrow')}</a></section></aside></div>`;
}
function renderFormulas(){
  const active=state.products.filter(p=>p.active), registered=active.filter(p=>p.formula.length);
  return heading('COMPOSICIÓN DE PRODUCTOS','Fórmulas','Consultá las composiciones registradas o completá las fichas pendientes.',editable()?`<a class="btn primary" href="#${calculatorPath}">${icon('calculator')}Calculadora</a>`:'')+
    viewerNotice()+`<section class="stats-grid" aria-label="Resumen de fórmulas">${stat(registered.length,'Registradas en productos activos','flask')}${stat(active.length-registered.length,'Productos activos sin fórmula','clock','amber')}${stat(new Set(registered.flatMap(p=>p.formula.map(row=>row.materialId))).size,'Materias primas en uso','layers','cyan')}</section>
    <section class="panel" aria-labelledby="formulas-title"><div class="panel-top"><h2 id="formulas-title">Fórmulas por producto</h2></div>${toolbar()}${formulaTabs()}<div id="list-results"></div></section>`;
}
function renderMaterials(){
  return heading('BASE DE TUS FÓRMULAS','Materias primas','Consultá las unidades habituales y en qué fórmulas se usa cada componente.',editable()?`<button class="btn primary" data-action="new-material">${icon('plus')}Nueva materia prima</button>`:'')+
    viewerNotice()+`<section class="stats-grid" aria-label="Resumen de materias primas">${stat(state.materials.filter(m=>m.active).length,'Materias primas activas','layers')}${stat(new Set(state.materials.map(m=>m.category)).size,'Categorías','box','cyan')}${stat(new Set(state.products.flatMap(p=>p.formula.map(r=>r.materialId))).size,'Utilizadas en fórmulas','flask','amber')}</section><section class="panel"><div class="panel-top"><h2>Catálogo de materias primas</h2><span class="text-xs text-muted">Datos de ejemplo</span></div>${toolbar(true)}<div id="list-results"></div></section>`;
}
function renderList(){
  const material=route==='/materias-primas',formulas=route==='/formulas',all=material?state.materials:state.products;
  const items=filterItems(all,filters),results=$('#list-results');if(!results)return;
  if(!items.length){results.innerHTML=`<div class="empty">${icon('search')}<h3>No encontramos ${material?'materias primas':'productos'}</h3><p>Probá con otro nombre o ajustá los filtros.</p><button class="btn secondary mt-5" data-action="clear-filters">Limpiar filtros</button></div>`;return;}
  const columns=material?['Materia prima','Categoría','Stock','Estado']:formulas?['Producto','Categoría','Componentes','Fórmula']:['Producto','Categoría','Fórmula'];
  const widths=material?[34,18,12,14,22]:formulas?[33,21,14,18,14]:[44,22,22,12];
  results.innerHTML=`<table class="data-table"><caption class="sr-only">${material?'Materias primas':formulas?'Fórmulas por producto':'Productos del catálogo'}</caption><colgroup>${widths.map(width=>`<col style="width:${width}%">`).join('')}</colgroup><thead><tr>${columns.map(label=>`<th scope="col">${label}</th>`).join('')}<th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>${items.map(x=>material?materialRow(x):productRow(x,formulas)).join('')}</tbody></table><div class="table-foot"><span role="status">${items.length} de ${all.length} ${material?'materias primas':'productos'}</span></div>`;
}
function materialRow(m){
  return `<tr><td><button class="product-name" data-action="view-material" data-id="${esc(m.id)}">${esc(m.name)}</button><div class="product-code">${esc(m.code)}</div></td><td>${esc(m.category)}</td><td><strong>${stockText(m.stock)}</strong></td><td>${activeBadge(m)}</td><td class="text-right">${editable()?`<button class="link-button" data-action="edit-material" data-id="${esc(m.id)}" aria-label="Editar ${esc(m.name)}">Editar ${icon('edit')}</button>`:''}</td></tr>`;
}
function productRow(p,formulas){
  const url='#/productos/'+esc(p.id);
  return `<tr><td><div class="product-cell">${mark(p)}<div><a class="product-name" href="${url}">${esc(p.name)}</a><p class="product-code">${esc(p.code)} · ${p.stock?'Stock ':''}${stockText(p.stock)}</p></div></div></td><td>${esc(p.category)}</td>${formulas?`<td><span class="sm-component-label">Componentes </span>${p.formula.length}</td>`:''}<td>${badge(p)}</td><td class="text-right"><a class="icon-button" href="${url}" aria-label="Abrir ${esc(p.name)}">${icon('chevron')}</a></td></tr>`;
}
function viewMaterial(id){
  const material=state.materials.find(m=>m.id===id);
  if(!material)return;
  const usedBy=state.products.filter(p=>p.formula.some(row=>row.materialId===id));
  modal.innerHTML=`<div class="dialog-body"><div class="dialog-heading"><h2 id="modal-title">${esc(material.name)}</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div><p class="dialog-description">${esc(material.code)} · ${esc(material.category)} · ${activeBadge(material)}</p><dl class="material-meta"><div class="meta-row"><dt>Unidad habitual</dt><dd>${esc(material.unit)}</dd></div><div class="meta-row"><dt>Stock disponible</dt><dd>${stockText(material.stock)}</dd></div><div class="meta-row"><dt>Última actualización</dt><dd>${date(material.updatedAt)}</dd></div><div class="meta-row"><dt>Responsable</dt><dd>${esc(material.updatedBy)}</dd></div></dl><h3>Fórmulas que la utilizan <span class="count-label">${usedBy.length}</span></h3>${usedBy.length?`<ul class="related-list">${usedBy.map(p=>`<li><a href="#/productos/${esc(p.id)}"><span>${esc(p.name)} <small>${esc(p.code)}${p.active?'':' · Inactivo'}</small></span>${icon('chevron')}</a></li>`).join('')}</ul>`:'<p class="text-sm text-muted mt-3">Todavía no se utiliza en ninguna fórmula.</p>'}</div>`;
  modalDirty=false;
  modal.showModal();
}
function rowHTML(row,index){
  const can=editable()&&currentProduct()?.active;
  const available=state.materials.filter(m=>m.active||m.id===row.materialId);
  return `<div class="formula-row" data-row="${index}"><span class="row-index">${String(index+1).padStart(2,'0')}</span><div class="field"><label for="material-${index}">Materia prima</label><select class="field-control" id="material-${index}" data-field="materialId" ${can?'':'disabled'} aria-describedby="error-materialId-${index}"><option value="">Elegí un componente</option>${available.map(m=>`<option value="${esc(m.id)}" ${m.id===row.materialId?'selected':''}>${esc(m.name)}${m.active?'':' (inactiva)'}</option>`).join('')}</select><p class="row-error" id="error-materialId-${index}"></p></div><div class="field"><label for="quantity-${index}">Cantidad</label><input class="field-control" id="quantity-${index}" inputmode="decimal" autocomplete="off" maxlength="18" data-field="quantity" value="${esc(quantityText(row.quantity))}" ${can?'':'readonly'} aria-describedby="error-quantity-${index}"><p class="row-error" id="error-quantity-${index}"></p></div><div class="field"><label for="unit-${index}">Unidad</label><select class="field-control" id="unit-${index}" data-field="unit" ${can?'':'disabled'} aria-describedby="error-unit-${index}">${options(units,row.unit,'Unidad')}</select><p class="row-error" id="error-unit-${index}"></p></div>${can?`<button type="button" class="icon-button danger" data-action="remove-row" data-index="${index}" aria-label="Quitar componente ${index+1}">${icon('trash')}</button>`:''}</div>`;
}
function emptyFormula(){
  const can=editable()&&currentProduct()?.active;
  return `<div class="empty formula-empty"><span class="stat-icon">${icon('flask')}</span><h3>Este producto todavía no tiene componentes</h3><p>${can?'Agregá una materia prima o usá otra fórmula como punto de partida.':'La composición aún está pendiente.'}</p>${can?`<button type="button" class="btn secondary mt-5" data-action="copy-formula">${icon('copy')}Copiar componentes</button>`:''}</div>`;
}
function formulaSources(excluded=currentProduct()){
  const activeMaterials=new Set(state.materials.filter(m=>m.active).map(m=>m.id));
  return state.products.filter(p=>p!==excluded&&p.active&&p.formula.length&&p.formula.every(row=>activeMaterials.has(row.materialId)));
}
function selectCalculationSource(id){
  const source=formulaSources(null).find(p=>p.id===id);
  calculation=source?{source,rows:source.formula,invalidIndex:null}:null;
}
function renderCalculator(){
  const title=`<a class="back-link" href="#/formulas">${icon('back')}Volver a fórmulas</a>`+
    heading('COMPOSICIÓN DE PRODUCTOS','Calculadora de fórmulas','Ajustá una fórmula registrada para actualizar existencias o crear un producto.');
  if(!editable())return title+viewerNotice();
  const sources=formulaSources(null);
  return title+`<div class="calculator-layout">
    <section class="panel" aria-labelledby="calculator-title">
      <div class="panel-top"><h2 id="calculator-title">${icon('calculator')} <span class="ml-2">Ajuste proporcional</span></h2></div>
      <div class="calculator-source field">
        <label for="calc-source">Fórmula de origen</label>
        <select class="field-control" id="calc-source" ${sources.length?'':'disabled'}>
          <option value="">Elegí un producto con fórmula</option>
          ${sources.map(p=>`<option value="${esc(p.id)}" ${p===calculation?.source?'selected':''}>${esc(p.name)} · ${esc(p.code)}</option>`).join('')}
        </select>
      </div>
      <div id="calc-result">${renderCalculation()}</div>
    </section>
    <aside class="panel demo-guide">
      <span class="stat-icon">${icon('info')}</span>
      <h2>Cómo se calcula</h2>
      <p class="text-sm text-muted mt-3">Si cambiás 55 L a 110 L, cada cantidad se multiplica por dos. El resultado se expresa en la unidad de cada componente.</p>
      <p class="text-xs text-muted mt-4">Los ejemplos son ficticios. El cálculo sirve para probar el flujo de la demo.</p>
    </aside>
  </div>`;
}
function renderCalculation(){
  if(!calculation)return `<div class="empty"><h3>${formulaSources(null).length?'Elegí una fórmula de origen':'No hay fórmulas disponibles'}</h3><p>La fórmula debe pertenecer a un producto activo y usar materias primas activas.</p></div>`;
  const {source,rows}=calculation;
  return `<p class="calculator-hint" id="calc-hint">Cambiá la cantidad de cualquier componente. El resto se ajusta en la misma proporción respecto de la fórmula de origen.</p>
    <table class="calculator-table">
      <caption class="sr-only">Comparación de cantidades</caption>
      <thead><tr><th scope="col">Componente</th><th scope="col">Cantidad original</th><th scope="col">Nueva cantidad</th></tr></thead>
      <tbody>${rows.map((row,i)=>{
        const material=state.materials.find(m=>m.id===row.materialId);
        return `<tr>
          <th scope="row">${esc(material.name)}<small>${esc(material.code)} · ${esc(row.unit)}</small></th>
          <td>${quantityText(source.formula[i].quantity)}</td>
          <td>
            <label class="sr-only" for="calc-quantity-${i}">Nueva cantidad de ${esc(material.name)} en ${esc(row.unit)}, componente ${i+1}</label>
            <input class="field-control" id="calc-quantity-${i}" data-calc-index="${i}" inputmode="decimal" autocomplete="off" value="${quantityText(row.quantity)}" aria-describedby="calc-hint calc-error-${i}">
            <p class="field-error" id="calc-error-${i}" hidden></p>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    <div class="calculator-review">
      <div class="notice warning calc-notice">${icon('info')} Revisá las cantidades antes de descontarlas del stock o guardarlas como fórmula independiente.</div>
      <p class="save-state" id="calc-status" role="status">Cantidades originales</p>
    </div>
    <div class="savebar">
      <button type="button" class="btn ghost" data-action="reset-calculation" disabled>${icon('reset')}Restablecer valores</button>
      <div class="calculator-actions">
        <button type="button" class="btn secondary" data-action="create-calculated">${icon('plus')}Crear producto con fórmula</button>
        <button type="button" class="btn primary" data-action="open-production">${icon('box')}Registrar producción</button>
      </div>
    </div>`;
}
function updateCalculation(input){
  const index=Number(input.dataset.calcIndex);
  const rows=scaleFormula(calculation.source.formula,index,input.value);
  if(rows)calculation.rows=rows;
  calculation.invalidIndex=rows?null:index;
  const quantity=parseQuantity(input.value);
  const message=Number.isFinite(quantity)&&quantity>0?'El ajuste produce cantidades fuera del rango admitido.':'Ingresá una cantidad mayor que cero.';
  for(const field of main.querySelectorAll('[data-calc-index]')){
    const fieldIndex=Number(field.dataset.calcIndex),invalid=fieldIndex===calculation.invalidIndex;
    if(field!==input)field.value=quantityText(calculation.rows[fieldIndex].quantity);
    if(invalid)field.setAttribute('aria-invalid','true');
    else field.removeAttribute('aria-invalid');
    const error=$('#calc-error-'+fieldIndex);
    error.textContent=invalid?message:'';
    error.hidden=!invalid;
  }
  const status=rows?(calculationDirty()?'Cantidades recalculadas':'Cantidades originales'):'Corregí la cantidad para recalcular';
  if($('#calc-status').textContent!==status)$('#calc-status').textContent=status;
  $('[data-action="create-calculated"]').disabled=!rows;
  $('[data-action="open-production"]').disabled=!rows;
  $('[data-action="reset-calculation"]').disabled=!calculationDirty();
}
function openProduction(){
  const {source}=calculation;
  modal.innerHTML=`<div class="dialog-body">
    <div class="dialog-heading"><h2 id="modal-title">Registrar producción</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div>
    <p class="dialog-description">Sumá la cantidad obtenida de <strong>${esc(source.name)}</strong> y descontá las materias primas calculadas.</p>
    <form id="production-form" novalidate>
      <div class="form-grid">
        ${inputField('production-quantity','Cantidad obtenida','','inputmode="decimal" autocomplete="off" required')}
        <div class="field"><label for="production-unit">Unidad de stock</label><select class="field-control" id="production-unit" ${source.stock?'disabled':''}>
          ${options(source.stock?[source.stock.unit]:productStockUnits,source.stock?.unit??'L')}
        </select></div>
      </div>
      <div id="production-feedback" class="notice warning mt-4" role="alert" tabindex="-1" hidden></div>
      <div id="production-preview"></div>
      <div class="dialog-actions"><button type="button" class="btn secondary" data-action="close-modal">Cancelar</button><button type="submit" id="production-save" class="btn primary">${icon('check')}Confirmar producción</button></div>
    </form>
  </div>`;
  modalDirty=false;
  renderProductionPreview();
  modal.showModal();
  $('#production-quantity').focus();
}
function renderProductionPreview(){
  const {source,rows}=calculation;
  const input=$('#production-quantity'),unit=$('#production-unit').value;
  const plan=planProduction(source,rows,state.materials,parseQuantity(input.value),unit);
  const quantityError=input.value?plan.quantityError:'';
  $('#production-quantity-error').textContent=quantityError;
  if(quantityError)input.setAttribute('aria-invalid','true');
  else input.removeAttribute('aria-invalid');
  const feedback=$('#production-feedback');
  feedback.hidden=!plan.errors.length;
  feedback.innerHTML=plan.errors.map(message=>`<p>${esc(message)}</p>`).join('');
  $('#production-preview').innerHTML=`
    <div class="production-total"><span>Stock del producto</span><strong>${stockText(source.stock??{quantity:0,unit})} ${icon('arrow')} ${plan.quantityError?'—':stockText(plan.productStock)}</strong></div>
    <h3 class="mt-4">Consumo de materias primas</h3>
    <ul class="production-list">${plan.consumption.map(({material,used,remaining})=>{
      const {unit}=material.stock;
      return `<li><strong>${esc(material.name)}</strong><span>Disponible ${stockText(material.stock)} · Consumo ${stockText({quantity:used,unit})}</span>
        <span class="${remaining<0?'stock-shortage':''}">${remaining<0?'Faltan':'Quedan'} ${stockText({quantity:Math.abs(remaining),unit})}</span></li>`;
    }).join('')}</ul>`;
  $('#production-save').disabled=!!(plan.quantityError||plan.errors.length||$('#production-form').dataset.saving);
  return plan;
}
async function saveProduction(form){
  if(!editable()||!modal.open||!calculation||calculation.invalidIndex!==null||form.dataset.saving)return;
  form.dataset.saving='true';
  $('#production-save').disabled=true;
  const commit=()=>{
    if(!modal.open||!form.isConnected||!calculation)return;
    const plan=renderProductionPreview();
    if(plan.quantityError||plan.errors.length)return;
    const next=clone(state),product=next.products.find(p=>p.id===calculation.source.id);
    product.stock=plan.productStock;
    touchProduct(product,`Producción registrada · +${quantityText(parseQuantity($('#production-quantity').value))} ${product.stock.unit}`);
    for(const {material,remaining} of plan.consumption){
      const updated=next.materials.find(m=>m.id===material.id);
      updated.stock.quantity=remaining;
      updated.updatedAt=product.updatedAt;
      updated.updatedBy=product.updatedBy;
    }
    if(!persist(next))return $('#storage-warning').textContent;
    state=next;calculation=null;modalDirty=false;
    modal.close();
    location.hash='/productos/'+product.id;
    toast('Producción registrada. Existencias actualizadas.');
  };
  let error;
  try{
    error=window.navigator.locks?
      await window.navigator.locks.request('amc-demo-production',{ifAvailable:true},lock=>lock?commit():'Hay otro movimiento en curso. Volvé a intentarlo.'):
      commit();
  }catch{error='El navegador no pudo guardar el movimiento de stock.';}
  delete form.dataset.saving;
  if(modal.open&&form.isConnected&&calculation){
    renderProductionPreview();
    if(error){
      const feedback=$('#production-feedback');
      feedback.textContent=error;feedback.hidden=false;feedback.focus();
    }
  }
}
function openFormulaCopy(){
  const sources=formulaSources();
  modal.innerHTML=`<div class="dialog-body"><div class="dialog-heading"><h2 id="modal-title">Copiar componentes</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div>${sources.length?`<p class="dialog-description">Elegí una fórmula para copiar sus materias primas, cantidades y unidades. Después podés ajustar y guardar la composición de este producto.</p><form id="copy-form"><div class="field"><label for="copy-source">Producto de origen</label><select class="field-control" id="copy-source" required><option value="">Elegí un producto</option>${sources.map(p=>`<option value="${esc(p.id)}">${esc(p.code)} · ${esc(p.name)} (${p.formula.length} componentes)</option>`).join('')}</select></div><div class="dialog-actions"><button type="button" class="btn secondary" data-action="close-modal">Cancelar</button><button type="submit" class="btn primary">${icon('copy')}Cargar componentes</button></div></form>`:'<p class="dialog-description">No hay fórmulas de otros productos activos con todas sus materias primas activas. Podés agregar los componentes manualmente.</p>'}</div>`;
  modalDirty=false;
  modal.showModal();
  $('#copy-source')?.focus();
}
function renderFormula(p){
  if(!draft){draft={rows:clone(p.formula),notes:p.notes};original=JSON.stringify(draft);}
  const can=editable()&&p.active;
  const calculatorLink=editable()&&formulaSources(null).includes(p)?`<a class="btn secondary" href="#${calculatorPath}?origen=${encodeURIComponent(p.id)}">${icon('calculator')}Usar en calculadora</a>`:'';
  return `<a class="back-link" href="#${formulaReturn}">${icon('back')}Volver a ${formulaReturn==='/formulas'?'fórmulas':'productos'}</a><div class="page-heading"><div class="formula-identity">${mark(p)}<div><p class="eyebrow">FICHA DE PRODUCTO / ${esc(p.code)}</p><h1>${esc(p.name)}</h1><p class="formula-header-sub">${esc(p.category)} <span class="mx-2" aria-hidden="true">·</span> ${activeBadge(p)}</p></div></div>${editable()?`<div class="flex flex-wrap gap-2">${calculatorLink}<button class="btn secondary" data-action="edit-product" data-id="${esc(p.id)}">${icon('edit')}Editar producto</button></div>`:''}</div>
    ${viewerNotice()}${!p.active?'<div class="notice warning">Este producto está inactivo. Conservamos su fórmula e historial. Reactivalo desde “Editar producto” para modificarlo.</div>':''}
    <div class="formula-layout"><section class="panel" aria-labelledby="formula-title"><div class="panel-top"><div><h2 id="formula-title">${icon('flask')} <span class="ml-2">Fórmula del producto</span></h2><p class="text-xs text-muted mt-2">Definí la composición con cantidades y unidades.</p></div><span class="badge ${p.formula.length?'':'pending'}">${p.formula.length?'Registrada':'Por completar'}</span></div>
    <form id="formula-form" novalidate><div id="formula-summary" role="alert" class="notice warning m-5" tabindex="-1" hidden></div><div class="formula-rows" id="formula-rows">${draft.rows.length?draft.rows.map(rowHTML).join(''):emptyFormula()}</div>${can?`<div class="formula-add"><button type="button" class="btn ghost" data-action="add-row">${icon('plus')}Agregar componente</button></div>`:''}
    <div class="formula-notes field"><label for="formula-notes">Observaciones de la fórmula</label><textarea id="formula-notes" class="field-control" rows="3" maxlength="1000" placeholder="Agregá una aclaración para quien consulte esta fórmula..." ${can?'':'readonly'}>${esc(draft.notes)}</textarea></div><div class="savebar"><span class="save-state" id="save-state">${p.formula.length?'Sin cambios pendientes':'Fórmula sin registrar'}</span><div class="flex items-center gap-2">${can?`<button type="button" class="btn ghost" data-action="discard-formula">Descartar</button><button type="submit" class="btn primary">${icon('save')}Guardar fórmula</button>`:`<span class="text-xs text-muted">${icon('shield')} Solo lectura</span>`}</div></div></form></section>
    <aside class="formula-aside"><section class="panel meta-card"><h3>Información del producto</h3><p class="text-xs text-muted">${esc(p.description)||'Sin descripción adicional.'}</p><div class="meta-row"><span>Código</span><strong>${esc(p.code)}</strong></div><div class="meta-row"><span>Stock disponible</span><strong>${stockText(p.stock)}</strong></div><div class="meta-row"><span>Componentes</span><strong id="component-count">${draft.rows.length}</strong></div><div class="meta-row"><span>Actualizado</span><strong>${date(p.updatedAt)}</strong></div><div class="meta-row"><span>Responsable</span><strong>${esc(p.updatedBy)}</strong></div></section><section class="panel audit-card"><h3 class="mb-5 flex items-center gap-2">${icon('clock')}Actividad reciente</h3>${p.audit.slice(0,4).map(a=>`<div class="audit-entry"><strong>${esc(a.action)}</strong><p>${esc(a.by)}</p><p>${date(a.at)} · ${time(a.at)}</p></div>`).join('')}</section><p class="formula-side-note">${icon('info')} Composición ilustrativa con componentes ficticios. No representa una receta apta para fabricación.</p></aside></div>`;
}
function renderUsers(){
  return heading('ACCESOS DEL EQUIPO','Cada persona, su rol.','Explorá cómo cambia la experiencia según los permisos asignados.')+
  `<div class="notice">${icon('info')}Los perfiles son simulados. La autenticación y los permisos reales forman parte del sistema definitivo.</div><div class="grid md:grid-cols-2 gap-6"><section class="panel p-7"><span class="stat-icon cyan inline-flex mb-5">${icon('shield')}</span><h2>Administración</h2><p class="text-sm text-muted mt-3 mb-6">Organiza el catálogo y mantiene las fórmulas actualizadas.</p><ul class="space-y-3 text-sm"><li>${icon('check')} Crear y editar productos</li><li>${icon('check')} Administrar materias primas</li><li>${icon('check')} Guardar fórmulas y componentes</li></ul><button class="btn ${editable()?'secondary':'primary'} mt-7" data-action="role-admin" ${editable()?'disabled':''}>${editable()?'Perfil actual':'Explorar como administración'}</button></section><section class="panel p-7"><span class="stat-icon inline-flex mb-5">${icon('users')}</span><h2>Solo consulta</h2><p class="text-sm text-muted mt-3 mb-6">Encuentra la información que necesita, sin modificarla.</p><ul class="space-y-3 text-sm"><li>${icon('check')} Buscar productos y materias primas</li><li>${icon('check')} Consultar la composición de productos</li><li>${icon('check')} Ver fecha y responsable de los cambios</li></ul><button class="btn ${editable()?'primary':'secondary'} mt-7" data-action="role-viewer" ${editable()?'':'disabled'}>${editable()?'Explorar como consulta':'Perfil actual'}</button></section></div>`;
}
function render(){
  renderNav();
  const p=currentProduct();
  const label=p?p.name:isCalculator()?'Calculadora':route==='/formulas'?'Fórmulas':route==='/materias-primas'?'Materias primas':route==='/usuarios'?'Perfiles de demo':'Productos';
  $('#breadcrumb').textContent=label;document.title=label+' · AMC';
  if(route==='/productos') main.innerHTML=renderProducts();
  else if(route==='/formulas') main.innerHTML=renderFormulas();
  else if(isCalculator()) main.innerHTML=renderCalculator();
  else if(route==='/materias-primas') main.innerHTML=renderMaterials();
  else if(route==='/usuarios') main.innerHTML=renderUsers();
  else if(p) main.innerHTML=renderFormula(p);
  else main.innerHTML=heading('CATÁLOGO','No encontramos esta página.','El enlace no corresponde a un producto de esta demo.',`<a class="btn primary" href="#/productos">Volver a productos</a>`);
  renderList();updateDirty();
}
async function onRoute(){
  const next=location.hash.slice(1)||'/productos';if(next===route)return;
  if((isDirty()||modalDirty||calculationDirty())&&!await confirmAction('Tenés cambios sin guardar','Si salís de esta página, se descartarán tus cambios.','Salir sin guardar')){
    history.replaceState(null,'','#'+route);return;
  }
  if(modal.open)modal.close();
  modalDirty=false;
  formulaReturn=route==='/formulas'||isCalculator()?'/formulas':'/productos';
  route=next;draft=null;original='';calculation=null;filters={query:'',category:'',status:'active',formula:'all'};
  if(isCalculator()&&editable())selectCalculationSource(new URLSearchParams(route.split('?')[1]).get('origen'));
  render();main.focus({preventScroll:true});window.scrollTo(0,0);
}
function updateDirty(){
  const label=$('#save-state');if(label){label.classList.toggle('dirty',isDirty());if(isDirty())label.textContent='Cambios sin guardar';else label.textContent=currentProduct()?.formula.length?'Sin cambios pendientes':'Fórmula sin registrar';}
  if($('#component-count'))$('#component-count').textContent=draft.rows.length;
}
function renderRows(){
  $('#formula-rows').innerHTML=draft.rows.map(rowHTML).join('')||emptyFormula();
  $('#formula-summary').hidden=true;updateDirty();
}
function touchProduct(p,action){
  p.updatedAt=new Date().toISOString();p.updatedBy='Administración demo';
  p.audit.unshift({action,at:p.updatedAt,by:p.updatedBy});
}
function saveFormula(){
  const p=currentProduct();if(!editable()||!p?.active)return;
  document.querySelectorAll('.row-error').forEach(el=>el.textContent='');
  document.querySelectorAll('[data-field]').forEach(el=>el.removeAttribute('aria-invalid'));
  const errors=validateFormula(draft.rows,state.materials),summary=$('#formula-summary');
  summary.hidden=!errors.length;
  if(errors.length){
    summary.textContent=errors.length===1?errors[0].message:'Revisá los campos indicados antes de guardar la fórmula.';
    for(const err of errors){
      if(err.row<0)continue;
      const control=$('#'+(err.field==='materialId'?'material':err.field)+'-'+err.row);
      control.setAttribute('aria-invalid','true');
      $('#error-'+err.field+'-'+err.row).textContent=err.message;
    }
    summary.focus();return;
  }
  if(!isDirty()){toast('La fórmula ya está actualizada.');return;}
  p.formula=draft.rows.map(r=>({...r,quantity:parseQuantity(r.quantity)}));p.notes=draft.notes.trim();
  touchProduct(p,'Fórmula guardada');draft=null;original='';
  const saved=persist();render();toast(saved?'Fórmula guardada en este navegador.':'Fórmula actualizada para esta sesión.');
}
function inputField(id,label,value='',extra=''){
  return `<div class="field"><label for="${id}">${label}</label><input class="field-control" id="${id}" name="${id}" value="${esc(value)}" ${extra} aria-describedby="${id}-error"><p class="field-error" id="${id}-error"></p></div>`;
}
async function openEntity(kind,id,fromCalculator=false){
  if(!editable())return;
  if(isDirty()&&!await confirmAction('Guardá primero tu fórmula','Para editar la ficha del producto, necesitás descartar los cambios pendientes de la fórmula.','Descartar y editar'))return;
  if(isDirty()){draft=null;render();}
  const material=kind==='material',entity=(material?state.materials:state.products).find(x=>x.id===id),isNew=!entity;
  const source=fromCalculator?calculation.source:null;
  const title=material?(isNew?'Nueva materia prima':'Editar materia prima'):(isNew?'Nuevo producto':'Editar producto');
  const description=source?`El producto se creará con los ${calculation.rows.length} componentes calculados a partir de ${esc(source.name)}.`:
    material?'Este componente estará disponible en el editor de fórmulas.':'Definí los datos del producto. Después podrás completar su fórmula.';
  modal.innerHTML=`<div class="dialog-body"><div class="dialog-heading"><h2 id="modal-title">${title}</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div><p class="dialog-description">${description}</p><form id="entity-form" data-kind="${kind}" data-id="${esc(id||'')}" data-calculated="${fromCalculator}" novalidate><div id="entity-errors" class="notice warning" role="alert" tabindex="-1" hidden></div><div class="form-grid">${inputField('name','Nombre *',entity?.name,'required maxlength="80" autocomplete="off"')}${inputField('code','Código *',entity?.code,'required maxlength="24" autocomplete="off"')}<div class="field"><label for="entity-category">Categoría *</label><select class="field-control" id="entity-category" name="category">${options(material?materialCategories:categories,entity?.category||source?.category||(material?materialCategories[0]:categories[0]))}</select></div>${material?`<div class="field"><label for="entity-unit">Unidad habitual *</label><select class="field-control" id="entity-unit" name="unit">${options(units,entity?.unit||'kg')}</select></div>${inputField('material-stock',entity?`Stock disponible (${esc(entity.stock.unit)})`:'Stock inicial (en la unidad habitual)',quantityText(entity?.stock.quantity??0),'inputmode="decimal" autocomplete="off" required')}`:''}${!isNew?`<div class="field"><label for="entity-active">Estado</label><select class="field-control" id="entity-active" name="active"><option value="true" ${entity.active?'selected':''}>Activo</option><option value="false" ${!entity.active?'selected':''}>Inactivo</option></select></div>`:''}${!material?`<div class="field full"><label for="entity-description">Descripción</label><textarea id="entity-description" name="description" class="field-control" maxlength="500" rows="3">${esc(entity?.description||'')}</textarea></div>`:''}</div>${!isNew?'<p class="text-xs text-muted mt-5">La desactivación conserva los datos y las fórmulas relacionadas.</p>':''}<div class="dialog-actions"><button type="button" class="btn secondary" data-action="close-modal">Cancelar</button><button type="submit" class="btn primary">${fromCalculator?'Crear producto con fórmula':isNew?'Crear '+(material?'materia prima':'producto'):'Guardar cambios'}</button></div></form></div>`;
  modalDirty=false;modal.showModal();$('#name').focus();
}
async function closeModal(){
  if(modalDirty&&!await confirmAction('¿Descartar los cambios?','Los datos que ingresaste en este formulario no se guardarán.','Descartar'))return;
  modalDirty=false;modal.close();
}
function saveEntity(form){
  if(!editable())return;
  const kind=form.dataset.kind,material=kind==='material',list=material?state.materials:state.products;
  const data=new FormData(form),name=String(data.get('name')||'').trim(),code=String(data.get('code')||'').trim();
  const materialStock=material?parseQuantity(data.get('material-stock')):null;
  const errors=[];
  form.querySelectorAll('.field-error').forEach(x=>x.textContent='');form.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));
  if(!name||name.length>80)errors.push(['name','Ingresá un nombre de hasta 80 caracteres.']);
  if(!code||code.length>24)errors.push(['code','Ingresá un código de hasta 24 caracteres.']);
  else if(list.some(x=>x.id!==form.dataset.id&&normalize(x.code)===normalize(code)))errors.push(['code','Ya existe un registro con este código.']);
  if(material&&!validStockQuantity(materialStock))errors.push(['material-stock','Ingresá un stock entre 0 y 1.000 millones, con un máximo de seis decimales.']);
  if(errors.length){
    $('#entity-errors').textContent='Revisá los campos indicados.';$('#entity-errors').hidden=false;
    errors.forEach(([id,msg])=>{$('#'+id).setAttribute('aria-invalid','true');$('#'+id+'-error').textContent=msg;});$('#entity-errors').focus();return;
  }
  const calculated=form.dataset.calculated==='true';
  if(calculated&&(!calculation||calculation.invalidIndex!==null||!formulaSources(null).includes(calculation.source)||
    validateFormula(calculation.rows,state.materials).length)){
    const summary=$('#entity-errors');
    summary.textContent='Revisá las cantidades y la fórmula de origen antes de crear el producto.';
    summary.hidden=false;summary.focus();return;
  }
  let entity=list.find(x=>x.id===form.dataset.id),isNew=!entity;
  if(!entity){entity={id:(material?'m':'p')+crypto.randomUUID(),formula:[],notes:'',description:'',color:'green',audit:[],stock:null};list.push(entity);}
  const oldActive=entity.active;
  Object.assign(entity,{name,code,category:data.get('category'),active:data.get('active')!=='false',updatedAt:new Date().toISOString(),updatedBy:'Administración demo'});
  if(material){
    entity.unit=data.get('unit');
    entity.stock={quantity:materialStock,unit:entity.stock?.unit??entity.unit};
  }
  else{
    entity.description=String(data.get('description')||'').trim();
    if(calculated){
      entity.formula=clone(calculation.rows);
      touchProduct(entity,`Producto creado con fórmula de ${calculation.source.code}`);
      calculation=null;
    }else touchProduct(entity,isNew?'Producto creado':oldActive!==entity.active?(entity.active?'Producto reactivado':'Producto desactivado'):'Ficha actualizada');
  }
  const saved=persist();modalDirty=false;modal.close();draft=null;
  if(!material&&isNew){location.hash='/productos/'+entity.id;}
  else render();
  toast(saved?(calculated?'Producto y fórmula guardados.':material?'Materia prima guardada.':'Producto guardado.'):'Cambio guardado solo en esta sesión.');
}
async function setRole(next){
  if((isDirty()||calculationDirty())&&!await confirmAction('Tenés cambios sin guardar','Cambiar de perfil descartará los cambios de esta fórmula.','Cambiar perfil')){$('#profile').value=role;return;}
  role=next;$('#profile').value=role;$('.avatar').textContent=editable()?'AD':'CO';draft=null;calculation=null;render();
  toast(editable()?'Perfil de administración activado.':'Perfil de consulta activado.');
}
document.addEventListener('click',async event=>{
  const btn=event.target.closest('[data-action]');if(!btn)return;
  const action=btn.dataset.action;
  // All action buttons inside a form are non-submit except its explicit save action.
  event.preventDefault();
  if(action==='close-modal')return closeModal();
  if(action==='view-material')return viewMaterial(btn.dataset.id);
  if(action==='reset-demo')return resetDemo();
  if(action==='role-admin'||action==='role-viewer')return setRole(action==='role-admin'?'admin':'viewer');
  if(action==='clear-filters'){filters={query:'',category:'',status:'all',formula:'all'};render();return;}
  if(!editable())return;
  if(action==='open-production'&&calculation&&calculation.invalidIndex===null)return openProduction();
  if(action==='create-calculated'&&calculation&&calculation.invalidIndex===null)return openEntity('product',undefined,true);
  if(action==='reset-calculation'&&calculation){
    selectCalculationSource(calculation.source.id);
    $('#calc-result').innerHTML=renderCalculation();
    $('#calc-quantity-0').focus();
    return;
  }
  if(action==='new-product')return openEntity('product');
  if(action==='edit-product')return openEntity('product',btn.dataset.id);
  if(action==='new-material')return openEntity('material');
  if(action==='edit-material')return openEntity('material',btn.dataset.id);
  if(!currentProduct()?.active)return;
  if(action==='copy-formula'&&!draft.rows.length)return openFormulaCopy();
  if(action==='add-row'){
    draft.rows.push({materialId:'',quantity:'',unit:'kg'});renderRows();
    $('#material-'+(draft.rows.length-1)).focus();
  }
  if(action==='remove-row'){
    const index=Number(btn.dataset.index);draft.rows.splice(index,1);renderRows();
    const target=$('#material-'+Math.min(index,draft.rows.length-1))||$('[data-action="add-row"]');target?.focus();
  }
  if(action==='discard-formula'){
    if(isDirty()&&!await confirmAction('¿Descartar los cambios?','Volverás a la última fórmula guardada.','Descartar'))return;
    draft=null;render();
  }
});
main.addEventListener('click',event=>{
  const tab=event.target.closest('[data-formula]');if(!tab)return;
  filters.formula=tab.dataset.formula;
  document.querySelectorAll('[data-formula]').forEach(el=>el.setAttribute('aria-pressed',String(el===tab)));
  renderList();
});
main.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='search'){filters.query=el.value;renderList();return;}
  if(el.hasAttribute('data-calc-index')&&editable()&&calculation){updateCalculation(el);return;}
  if(!editable()||!currentProduct()?.active)return;
  if(el.id==='formula-notes'){draft.notes=el.value;updateDirty();}
  if(el.dataset.field){const row=Number(el.closest('[data-row]').dataset.row);draft.rows[row][el.dataset.field]=el.value;updateDirty();}
});
main.addEventListener('change',async event=>{
  const el=event.target;
  if(el.id==='calc-source'&&editable()){
    const next=el.value;
    if(calculationDirty()&&!await confirmAction('¿Cambiar la fórmula de origen?','Las cantidades ajustadas se descartarán.','Cambiar fórmula')){
      el.value=calculation.source.id;return;
    }
    selectCalculationSource(next);
    route=calculatorPath+(calculation?'?origen='+encodeURIComponent(calculation.source.id):'');
    history.replaceState(null,'','#'+route);
    $('#calc-result').innerHTML=renderCalculation();
    return;
  }
  if(el.id==='category'||el.id==='status'){filters[el.id]=el.value;renderList();return;}
  if(el.dataset.field&&editable()&&currentProduct()?.active){
    const index=Number(el.closest('[data-row]').dataset.row);draft.rows[index][el.dataset.field]=el.value;
    if(el.dataset.field==='materialId'){const m=state.materials.find(x=>x.id===el.value);if(m){draft.rows[index].unit=m.unit;$('#unit-'+index).value=m.unit;}}
    updateDirty();
  }
});
document.addEventListener('submit',event=>{
  if(event.target.id==='formula-form'){event.preventDefault();saveFormula();}
  if(event.target.id==='entity-form'){event.preventDefault();saveEntity(event.target);}
  if(event.target.id==='production-form'){event.preventDefault();saveProduction(event.target);}
  if(event.target.id==='copy-form'){
    event.preventDefault();
    if(!editable()||!currentProduct()?.active||draft.rows.length)return;
    const source=formulaSources().find(p=>p.id===$('#copy-source').value);
    if(!source)return;
    draft.rows=clone(source.formula);
    modalDirty=false;
    modal.close();
    renderRows();
    $('#material-0').focus();
    toast('Componentes cargados. Revisá y guardá la fórmula.');
  }
});
function trackModalInput(event){
  const id=event.target.form?.id;
  if(id==='entity-form'||id==='production-form')modalDirty=true;
  if(id==='production-form')renderProductionPreview();
}
modal.addEventListener('input',trackModalInput);
modal.addEventListener('change',trackModalInput);
modal.addEventListener('click',event=>{if(event.target.closest('.related-list a'))modal.close();});
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
$('#profile').addEventListener('change',event=>setRole(event.target.value));
async function resetDemo(){
  if(!await confirmAction('¿Restablecer la demo?','Se quitarán los cambios locales y volverán los productos y fórmulas de ejemplo.','Restablecer demo'))return;
  state=seed();draft=null;original='';calculation=null;role='admin';$('#profile').value=role;$('.avatar').textContent='AD';
  const saved=persist();route='';history.replaceState(null,'','#/productos');await onRoute();
  toast(saved?'Demo restablecida. Lista para empezar.':'Demo restablecida para esta sesión.');
}
window.addEventListener('beforeunload',event=>{if(isDirty()||modalDirty||calculationDirty()){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',onRoute);
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();});
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
onRoute();


