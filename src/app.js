import {STORAGE_KEY, categories, materialCategories, units, seed, clone, escapeHTML as esc, normalize, parseQuantity, validateFormula, readState, writeState, filterItems} from './model.js';
import {icon} from './icons.js';

const $ = selector => document.querySelector(selector);
const loaded = (()=>{try{return readState(localStorage);}catch{return {state:seed(),warning:'El almacenamiento local no está disponible. Los cambios durarán mientras esta página siga abierta.'};}})();
let state=loaded.state, role='admin', route='', draft=null, original='', toastTimer, modalDirty=false;
let filters={query:'',category:'',status:'active',formula:'all'};
const main=$('#main'), modal=$('#modal');
const editable=()=>role==='admin';
const currentProduct=()=>state.products.find(p=>route===`/productos/${p.id}`);
const isDirty=()=>draft!==null&&JSON.stringify(draft)!==original;
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
function persist(){
  let saved=false;
  try{saved=writeState(localStorage,state);}catch{}
  if(!saved) warn('El cambio está en esta sesión, pero no pudo guardarse en el navegador. No cierres la página si querés conservarlo.');
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
  const links=[['/productos','box','Productos',state.products.length],['/materias-primas','layers','Materias primas',state.materials.length],['/usuarios','users','Usuarios y roles','']];
  $('#navigation').innerHTML=links.map(([url,i,label,count])=>`<a class="nav-link ${route.startsWith(url)?'active':''}" href="#${url}" ${route.startsWith(url)?'aria-current="page"':''}>${icon(i)}<span>${label}</span>${count!==''?`<span class="nav-count">${count}</span>`:''}</a>`).join('');
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
function renderProducts(){
  const active=state.products.filter(p=>p.active),ready=active.filter(p=>p.formula.length);
  return heading('CATÁLOGO CENTRALIZADO','Tus productos, en orden.','Toda la información y sus fórmulas, en un mismo lugar.',editable()?`<button class="btn primary" data-action="new-product">${icon('plus')}Nuevo producto</button>`:'')+
    viewerNotice()+`<section class="stats-grid" aria-label="Resumen de productos">${stat(active.length,'Productos activos','box')}${stat(ready.length,'Con fórmula registrada','flask','teal')}${stat(active.length-ready.length,'Fórmulas por completar','clock','amber')}</section>
    <div class="catalog-layout"><section class="panel" aria-labelledby="catalog-title"><div class="panel-top"><h2 id="catalog-title">Catálogo de productos</h2><span class="text-xs text-muted">Entrega 01</span></div>${toolbar()}
    <div class="filter-tabs" aria-label="Filtrar por fórmula"><button class="filter-tab" data-formula="all" aria-pressed="${filters.formula==='all'}">Todos</button><button class="filter-tab" data-formula="ready" aria-pressed="${filters.formula==='ready'}">Con fórmula</button><button class="filter-tab" data-formula="pending" aria-pressed="${filters.formula==='pending'}">Sin fórmula</button></div><div id="list-results"></div></section>
    <aside class="catalog-aside"><div class="feature-card"><div class="feature-icon">${icon('flask')}</div><p class="feature-kicker">EL NÚCLEO DE TU PRODUCTO</p><h2>Cada fórmula.<br>Siempre a mano.</h2><p>Componentes, cantidades y unidades. Una receta clara, fácil de consultar y mantener.</p><a class="btn lime" href="#/productos/p1">Explorar una fórmula ${icon('arrow')}</a></div><div class="side-note"><h3>De la idea a la fórmula</h3><div class="step-item"><span>01</span><div><strong>Definí tu producto</strong><p>Nombre, código y categoría.</p></div></div><div class="step-item"><span>02</span><div><strong>Armá su composición</strong><p>Materias primas y cantidades.</p></div></div><div class="step-item"><span>03</span><div><strong>Guardá y compartí claridad</strong><p>La información, lista para consultar.</p></div></div></div></aside></div>`;
}
function renderMaterials(){
  return heading('BASE DE TUS FÓRMULAS','Materias primas.','Un catálogo compartido para componer cada producto.',editable()?`<button class="btn primary" data-action="new-material">${icon('plus')}Nueva materia prima</button>`:'')+
    viewerNotice()+`<section class="stats-grid" aria-label="Resumen de materias primas">${stat(state.materials.filter(m=>m.active).length,'Materias primas activas','layers')}${stat(new Set(state.materials.map(m=>m.category)).size,'Categorías','box','teal')}${stat(new Set(state.products.flatMap(p=>p.formula.map(r=>r.materialId))).size,'Utilizadas en fórmulas','flask','amber')}</section><section class="panel"><div class="panel-top"><h2>Catálogo de materias primas</h2><span class="text-xs text-muted">Datos de ejemplo</span></div>${toolbar(true)}<div id="list-results"></div></section>`;
}
function renderList(){
  const material=route==='/materias-primas',all=material?state.materials:state.products;
  const items=filterItems(all,filters),results=$('#list-results');if(!results)return;
  if(!items.length){results.innerHTML=`<div class="empty">${icon('search')}<h3>No encontramos ${material?'materias primas':'productos'}</h3><p>Probá con otro nombre o ajustá los filtros.</p><button class="btn secondary mt-5" data-action="clear-filters">Limpiar filtros</button></div>`;return;}
  results.innerHTML=`<table class="data-table"><caption class="sr-only">${material?'Materias primas':'Productos'} del catálogo</caption><colgroup>${material?'<col style="width:34%"><col style="width:18%"><col style="width:12%"><col style="width:14%"><col style="width:22%">':'<col style="width:44%"><col style="width:22%"><col style="width:20%"><col style="width:14%">'} </colgroup><thead><tr><th scope="col">${material?'Materia prima':'Producto'}</th><th scope="col">Categoría</th>${material?'<th scope="col">Unidad</th>':''}<th scope="col">${material?'Estado':'Fórmula'}</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>${items.map(x=>material?`<tr><td><strong class="product-name">${esc(x.name)}</strong><div class="product-code">${esc(x.code)}</div></td><td>${esc(x.category)}</td><td>${esc(x.unit)}</td><td>${activeBadge(x)}</td><td class="text-right">${editable()?`<button class="link-button" data-action="edit-material" data-id="${esc(x.id)}">Editar ${icon('edit')}</button>`:'<span class="text-muted text-xs">Consulta</span>'}</td></tr>`:`<tr><td><div class="product-cell">${mark(x)}<div><a class="product-name" href="#/productos/${esc(x.id)}">${esc(x.name)}</a><p class="product-code">${esc(x.code)}</p></div></div></td><td>${esc(x.category)}</td><td>${badge(x)}</td><td class="text-right"><a class="icon-button" href="#/productos/${esc(x.id)}" aria-label="Abrir ${esc(x.name)}">${icon('chevron')}</a></td></tr>`).join('')}</tbody></table><div class="table-foot"><span role="status">${items.length} de ${all.length} ${material?'materias primas':'productos'}</span><span>Información centralizada</span></div>`;
}
function rowHTML(row,index){
  const can=editable()&&currentProduct()?.active;
  const available=state.materials.filter(m=>m.active||m.id===row.materialId);
  return `<div class="formula-row" data-row="${index}"><span class="row-index">${String(index+1).padStart(2,'0')}</span><div class="field"><label for="material-${index}">Materia prima</label><select class="field-control" id="material-${index}" data-field="materialId" ${can?'':'disabled'} aria-describedby="error-materialId-${index}"><option value="">Elegí un componente</option>${available.map(m=>`<option value="${esc(m.id)}" ${m.id===row.materialId?'selected':''}>${esc(m.name)}${m.active?'':' (inactiva)'}</option>`).join('')}</select><p class="row-error" id="error-materialId-${index}"></p></div><div class="field"><label for="quantity-${index}">Cantidad</label><input class="field-control" id="quantity-${index}" inputmode="decimal" autocomplete="off" maxlength="18" data-field="quantity" value="${esc(String(row.quantity).replace('.',','))}" ${can?'':'readonly'} aria-describedby="error-quantity-${index}"><p class="row-error" id="error-quantity-${index}"></p></div><div class="field"><label for="unit-${index}">Unidad</label><select class="field-control" id="unit-${index}" data-field="unit" ${can?'':'disabled'} aria-describedby="error-unit-${index}">${options(units,row.unit,'Unidad')}</select><p class="row-error" id="error-unit-${index}"></p></div>${can?`<button type="button" class="icon-button danger" data-action="remove-row" data-index="${index}" aria-label="Quitar componente ${index+1}">${icon('trash')}</button>`:''}</div>`;
}
function renderFormula(p){
  if(!draft){draft={rows:clone(p.formula),notes:p.notes};original=JSON.stringify(draft);}
  const can=editable()&&p.active;
  return `<a class="back-link" href="#/productos">${icon('back')}Volver a productos</a><div class="page-heading"><div class="formula-identity">${mark(p)}<div><p class="eyebrow">FICHA DE PRODUCTO / ${esc(p.code)}</p><h1>${esc(p.name)}</h1><p class="formula-header-sub">${esc(p.category)} <span class="mx-2" aria-hidden="true">·</span> ${activeBadge(p)}</p></div></div>${editable()?`<button class="btn secondary" data-action="edit-product" data-id="${esc(p.id)}">${icon('edit')}Editar producto</button>`:''}</div>
    ${viewerNotice()}${!p.active?'<div class="notice warning">Este producto está inactivo. Conservamos su fórmula e historial. Reactivalo desde “Editar producto” para modificarlo.</div>':''}
    <div class="formula-layout"><section class="panel" aria-labelledby="formula-title"><div class="panel-top"><div><h2 id="formula-title">${icon('flask')} <span class="ml-2">Fórmula del producto</span></h2><p class="text-xs text-muted mt-2">Definí la composición con cantidades y unidades.</p></div><span class="badge ${p.formula.length?'':'pending'}">${p.formula.length?'Registrada':'Por completar'}</span></div>
    <form id="formula-form" novalidate><div id="formula-summary" role="alert" class="notice warning m-5" tabindex="-1" hidden></div><div class="formula-rows" id="formula-rows">${draft.rows.length?draft.rows.map(rowHTML).join(''):`<div class="empty">${icon('flask')}<h3>La fórmula empieza acá</h3><p>${can?'Agregá el primer componente de este producto.':'Este producto todavía no tiene una fórmula registrada.'}</p></div>`}</div>${can?`<div class="formula-add"><button type="button" class="btn ghost" data-action="add-row">${icon('plus')}Agregar componente</button></div>`:''}
    <div class="formula-notes field"><label for="formula-notes">Observaciones de la fórmula</label><textarea id="formula-notes" class="field-control" rows="3" maxlength="1000" placeholder="Agregá una aclaración para quien consulte esta fórmula..." ${can?'':'readonly'}>${esc(draft.notes)}</textarea></div><div class="savebar"><span class="save-state" id="save-state">${p.formula.length?'Sin cambios pendientes':'Fórmula sin registrar'}</span><div class="flex items-center gap-2">${can?`<button type="button" class="btn ghost" data-action="discard-formula">Descartar</button><button type="submit" class="btn primary">${icon('save')}Guardar fórmula</button>`:`<span class="text-xs text-muted">${icon('shield')} Solo lectura</span>`}</div></div></form></section>
    <aside class="formula-aside"><section class="panel meta-card"><h3>Información del producto</h3><p class="text-xs text-muted">${esc(p.description)||'Sin descripción adicional.'}</p><div class="meta-row"><span>Código</span><strong>${esc(p.code)}</strong></div><div class="meta-row"><span>Componentes</span><strong id="component-count">${draft.rows.length}</strong></div><div class="meta-row"><span>Actualizado</span><strong>${date(p.updatedAt)}</strong></div><div class="meta-row"><span>Responsable</span><strong>${esc(p.updatedBy)}</strong></div></section><section class="panel audit-card"><h3 class="mb-5 flex items-center gap-2">${icon('clock')}Actividad reciente</h3>${p.audit.slice(0,4).map(a=>`<div class="audit-entry"><strong>${esc(a.action)}</strong><p>${esc(a.by)}</p><p>${date(a.at)} · ${time(a.at)}</p></div>`).join('')}</section><p class="formula-side-note">${icon('info')} Composición ilustrativa con componentes ficticios. No representa una receta apta para fabricación.</p></aside></div>`;
}
function renderUsers(){
  return heading('ACCESOS DEL EQUIPO','Cada persona, su rol.','Explorá cómo cambia la experiencia según los permisos asignados.')+
  `<div class="notice">${icon('info')}Los perfiles son simulados. La autenticación y los permisos reales forman parte del sistema definitivo.</div><div class="grid md:grid-cols-2 gap-6"><section class="panel p-7"><span class="stat-icon teal inline-flex mb-5">${icon('shield')}</span><h2>Administración</h2><p class="text-sm text-muted mt-3 mb-6">Organiza el catálogo y mantiene las fórmulas actualizadas.</p><ul class="space-y-3 text-sm"><li>${icon('check')} Crear y editar productos</li><li>${icon('check')} Administrar materias primas</li><li>${icon('check')} Guardar fórmulas y componentes</li></ul><button class="btn ${editable()?'secondary':'primary'} mt-7" data-action="role-admin" ${editable()?'disabled':''}>${editable()?'Perfil actual':'Explorar como administración'}</button></section><section class="panel p-7"><span class="stat-icon inline-flex mb-5">${icon('users')}</span><h2>Solo consulta</h2><p class="text-sm text-muted mt-3 mb-6">Encuentra la información que necesita, sin modificarla.</p><ul class="space-y-3 text-sm"><li>${icon('check')} Buscar productos y materias primas</li><li>${icon('check')} Consultar la composición de productos</li><li>${icon('check')} Ver fecha y responsable de los cambios</li></ul><button class="btn ${editable()?'primary':'secondary'} mt-7" data-action="role-viewer" ${editable()?'':'disabled'}>${editable()?'Explorar como consulta':'Perfil actual'}</button></section></div>`;
}
function render(){
  renderNav();
  const p=currentProduct();
  const label=p?p.name:route==='/materias-primas'?'Materias primas':route==='/usuarios'?'Usuarios y roles':'Productos';
  $('#breadcrumb').textContent=label;document.title=label+' · AMC';
  if(route==='/productos') main.innerHTML=renderProducts();
  else if(route==='/materias-primas') main.innerHTML=renderMaterials();
  else if(route==='/usuarios') main.innerHTML=renderUsers();
  else if(p) main.innerHTML=renderFormula(p);
  else main.innerHTML=heading('CATÁLOGO','No encontramos esta página.','El enlace no corresponde a un producto de esta demo.',`<a class="btn primary" href="#/productos">Volver a productos</a>`);
  renderList();updateDirty();
}
async function onRoute(){
  const next=location.hash.slice(1)||'/productos';if(next===route)return;
  if(isDirty()&&!await confirmAction('Tenés cambios sin guardar','Si salís de esta fórmula, se descartarán tus cambios.','Salir sin guardar')){
    history.replaceState(null,'','#'+route);return;
  }
  route=next;draft=null;original='';filters={query:'',category:'',status:'active',formula:'all'};
  render();main.focus({preventScroll:true});window.scrollTo(0,0);
}
function updateDirty(){
  const label=$('#save-state');if(label){label.classList.toggle('dirty',isDirty());if(isDirty())label.textContent='Cambios sin guardar';else label.textContent=currentProduct()?.formula.length?'Sin cambios pendientes':'Fórmula sin registrar';}
  if($('#component-count'))$('#component-count').textContent=draft.rows.length;
}
function renderRows(){
  $('#formula-rows').innerHTML=draft.rows.map(rowHTML).join('')||'<div class="empty"><h3>Agregá al menos un componente</h3><p>Una fórmula necesita una materia prima y su cantidad.</p></div>';
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
async function openEntity(kind,id){
  if(!editable())return;
  if(isDirty()&&!await confirmAction('Guardá primero tu fórmula','Para editar la ficha del producto, necesitás descartar los cambios pendientes de la fórmula.','Descartar y editar'))return;
  if(isDirty()){draft=null;render();}
  const material=kind==='material',entity=(material?state.materials:state.products).find(x=>x.id===id),isNew=!entity;
  const title=material?(isNew?'Nueva materia prima':'Editar materia prima'):(isNew?'Nuevo producto':'Editar producto');
  modal.innerHTML=`<div class="dialog-body"><div class="dialog-heading"><h2 id="modal-title">${title}</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div><p class="dialog-description">${material?'Este componente estará disponible en el editor de fórmulas.':'Definí los datos del producto. Después podrás completar su fórmula.'}</p><form id="entity-form" data-kind="${kind}" data-id="${esc(id||'')}" novalidate><div id="entity-errors" class="notice warning" role="alert" tabindex="-1" hidden></div><div class="form-grid">${inputField('name','Nombre *',entity?.name,'required maxlength="80" autocomplete="off"')}${inputField('code','Código *',entity?.code,'required maxlength="24" autocomplete="off"')}<div class="field"><label for="entity-category">Categoría *</label><select class="field-control" id="entity-category" name="category">${options(material?materialCategories:categories,entity?.category||(material?materialCategories[0]:categories[0]))}</select></div>${material?`<div class="field"><label for="entity-unit">Unidad habitual *</label><select class="field-control" id="entity-unit" name="unit">${options(units,entity?.unit||'kg')}</select></div>`:''}${!isNew?`<div class="field"><label for="entity-active">Estado</label><select class="field-control" id="entity-active" name="active"><option value="true" ${entity.active?'selected':''}>Activo</option><option value="false" ${!entity.active?'selected':''}>Inactivo</option></select></div>`:''}${!material?`<div class="field full"><label for="entity-description">Descripción</label><textarea id="entity-description" name="description" class="field-control" maxlength="500" rows="3">${esc(entity?.description||'')}</textarea></div>`:''}</div>${!isNew?'<p class="text-xs text-muted mt-5">La desactivación conserva los datos y las fórmulas relacionadas.</p>':''}<div class="dialog-actions"><button type="button" class="btn secondary" data-action="close-modal">Cancelar</button><button type="submit" class="btn primary">${isNew?'Crear '+(material?'materia prima':'producto'):'Guardar cambios'}</button></div></form></div>`;
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
  const errors=[];
  form.querySelectorAll('.field-error').forEach(x=>x.textContent='');form.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));
  if(!name||name.length>80)errors.push(['name','Ingresá un nombre de hasta 80 caracteres.']);
  if(!code||code.length>24)errors.push(['code','Ingresá un código de hasta 24 caracteres.']);
  else if(list.some(x=>x.id!==form.dataset.id&&normalize(x.code)===normalize(code)))errors.push(['code','Ya existe un registro con este código.']);
  if(errors.length){
    $('#entity-errors').textContent='Revisá los campos indicados.';$('#entity-errors').hidden=false;
    errors.forEach(([id,msg])=>{$('#'+id).setAttribute('aria-invalid','true');$('#'+id+'-error').textContent=msg;});$('#entity-errors').focus();return;
  }
  let entity=list.find(x=>x.id===form.dataset.id),isNew=!entity;
  if(!entity){entity={id:(material?'m':'p')+crypto.randomUUID(),formula:[],notes:'',description:'',color:'green',audit:[]};list.push(entity);}
  const oldActive=entity.active;
  Object.assign(entity,{name,code,category:data.get('category'),active:data.get('active')!=='false',updatedAt:new Date().toISOString(),updatedBy:'Administración demo'});
  if(material)entity.unit=data.get('unit');
  else{
    entity.description=String(data.get('description')||'').trim();
    touchProduct(entity,isNew?'Producto creado':oldActive!==entity.active?(entity.active?'Producto reactivado':'Producto desactivado'):'Ficha actualizada');
  }
  const saved=persist();modalDirty=false;modal.close();draft=null;
  if(!material&&isNew){location.hash='/productos/'+entity.id;}
  else render();
  toast(saved?(material?'Materia prima guardada.':'Producto guardado.'):'Cambio guardado solo en esta sesión.');
}
async function setRole(next){
  if(isDirty()&&!await confirmAction('Tenés cambios sin guardar','Cambiar de perfil descartará los cambios de esta fórmula.','Cambiar perfil')){$('#profile').value=role;return;}
  role=next;$('#profile').value=role;$('.avatar').textContent=editable()?'AD':'CO';draft=null;render();
  toast(editable()?'Perfil de administración activado.':'Perfil de consulta activado.');
}
document.addEventListener('click',async event=>{
  const btn=event.target.closest('[data-action]');if(!btn)return;
  const action=btn.dataset.action;
  // All action buttons inside a form are non-submit except its explicit save action.
  event.preventDefault();
  if(action==='close-modal')return closeModal();
  if(action==='role-admin'||action==='role-viewer')return setRole(action==='role-admin'?'admin':'viewer');
  if(action==='clear-filters'){filters={query:'',category:'',status:'all',formula:'all'};render();return;}
  if(!editable())return;
  if(action==='new-product')return openEntity('product');
  if(action==='edit-product')return openEntity('product',btn.dataset.id);
  if(action==='new-material')return openEntity('material');
  if(action==='edit-material')return openEntity('material',btn.dataset.id);
  if(!currentProduct()?.active)return;
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
  if(!editable()||!currentProduct()?.active)return;
  if(el.id==='formula-notes'){draft.notes=el.value;updateDirty();}
  if(el.dataset.field){const row=Number(el.closest('[data-row]').dataset.row);draft.rows[row][el.dataset.field]=el.value;updateDirty();}
});
main.addEventListener('change',event=>{
  const el=event.target;
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
});
modal.addEventListener('input',()=>modalDirty=true);modal.addEventListener('change',()=>modalDirty=true);
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
$('#profile').addEventListener('change',event=>setRole(event.target.value));
$('#reset').addEventListener('click',async()=>{
  if(!await confirmAction('¿Restablecer la demo?','Se quitarán los cambios locales y volverán los productos y fórmulas de ejemplo.','Restablecer demo'))return;
  state=seed();draft=null;original='';role='admin';$('#profile').value=role;$('.avatar').textContent='AD';
  const saved=persist();route='';history.replaceState(null,'','#/productos');await onRoute();
  toast(saved?'Demo restablecida. Lista para empezar.':'Demo restablecida para esta sesión.');
});
window.addEventListener('beforeunload',event=>{if(isDirty()||modalDirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',onRoute);
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();});
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
onRoute();


