export const STORAGE_KEY = 'amc-demo-v1';
export const categories = ['Limpieza general', 'Lavandería', 'Cuidado de superficies', 'Higiene'];
export const materialCategories = ['Base', 'Activo', 'Fragancia', 'Aditivo'];
export const units = ['kg', 'g', 'L', 'mL'];
const stamp = '2026-09-08T13:30:00.000Z';
export function seed() {
  const materials = [
    ['m1','MP-001','Base acuosa demo','Base','L'],
    ['m2','MP-002','Activo A demo','Activo','kg'],
    ['m3','MP-003','Fragancia cítrica demo','Fragancia','mL'],
    ['m4','MP-004','Aditivo B demo','Aditivo','g'],
    ['m5','MP-005','Activo C demo','Activo','kg'],
    ['m6','MP-006','Fragancia floral demo','Fragancia','mL'],
    ['m7','MP-007','Aditivo D demo','Aditivo','g'],
    ['m8','MP-008','Base E demo','Base','L']
  ].map(([id,code,name,category,unit])=>({id,code,name,category,unit,active:true,updatedAt:stamp,updatedBy:'Administración demo'}));
  const products = [
    ['p1','PR-001','Limpiador multiuso','Limpieza general','green'],
    ['p2','PR-002','Detergente concentrado','Limpieza general','blue'],
    ['p3','PR-003','Suavizante floral','Lavandería','pink'],
    ['p4','PR-004','Desengrasante','Cuidado de superficies','gold'],
    ['p5','PR-005','Jabón líquido','Higiene','violet'],
    ['p6','PR-006','Limpiador de pisos','Cuidado de superficies','green']
  ].map(([id,code,name,category,color],i)=>({
    id,code,name,category,color,active:true,
    description:'Producto ficticio para explorar el sistema de gestión.',
    formula:i<4 ? [
      {materialId:'m1',quantity:80,unit:'L'},
      {materialId:i===2?'m5':'m2',quantity:8,unit:'kg'},
      {materialId:i===2?'m6':'m3',quantity:250,unit:'mL'},
      {materialId:'m4',quantity:150,unit:'g'}
    ]:[],
    notes:i<4?'Ejemplo ilustrativo. No representa una receta apta para fabricación.':'',
    updatedAt:stamp,updatedBy:'Administración demo',
    audit:[{action:i<4?'Fórmula registrada':'Producto creado',at:stamp,by:'Administración demo'}]
  }));
  return {version:1,products,materials};
}
export const clone = value => JSON.parse(JSON.stringify(value));
export const normalize = value => String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseQuantity(value) {
  if(typeof value==='string' && !/^\s*\d+(?:[.,]\d+)?\s*$/.test(value)) return NaN;
  return Number(String(value).replace(',','.'));
}
export function validateFormula(rows,materials) {
  const errors = [];
  if(!rows.length) errors.push({row:-1,field:'components',message:'Agregá al menos un componente para guardar la fórmula.'});
  rows.forEach((row,index)=>{
    if(!materials.some(m=>m.id===row.materialId)) errors.push({row:index,field:'materialId',message:'Elegí una materia prima del catálogo.'});
    const n=parseQuantity(row.quantity);
    if(!Number.isFinite(n)||n<=0) errors.push({row:index,field:'quantity',message:'Ingresá una cantidad mayor que cero.'});
    if(!units.includes(row.unit)) errors.push({row:index,field:'unit',message:'Elegí una unidad válida.'});
  });
  return errors;
}
export function validState(state) {
  const text = v => typeof v==='string';
  const base = x=>x && ['id','code','name','category','updatedAt','updatedBy'].every(k=>text(x[k])) && typeof x.active==='boolean';
  if(!state || state.version!==1 || !Array.isArray(state.products) || !Array.isArray(state.materials)) return false;
  if(!state.materials.every(m=>base(m)&&units.includes(m.unit))) return false;
  if(!state.products.every(p=>base(p)&&text(p.description)&&text(p.notes)&&Array.isArray(p.formula)&&Array.isArray(p.audit)&&
    p.audit.every(a=>a&&['action','at','by'].every(k=>text(a[k])))&&
    p.formula.every(r=>r&&text(r.materialId)&&units.includes(r.unit)&&Number.isFinite(r.quantity)&&r.quantity>0&&state.materials.some(m=>m.id===r.materialId)))) return false;
  return ['products','materials'].every(k=>new Set(state[k].map(x=>x.id)).size===state[k].length);
}
export function readState(storage) {
  try{
    const raw=storage.getItem(STORAGE_KEY);
    if(!raw) return {state:seed(),warning:''};
    const state=JSON.parse(raw);
    if(!validState(state)) throw new Error('invalid');
    return {state,warning:''};
  }catch{ return {state:seed(),warning:'No se pudieron recuperar los datos locales. Se cargó el ejemplo inicial; los datos anteriores no se sobrescribirán hasta que guardes un cambio.'};}
}
export function writeState(storage,state) {
  try{storage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{return false;}
}
export function filterItems(items,{query='',category='',status='all',formula='all'}={}) {
  const q=normalize(query);
  return items.filter(x=>(!q||normalize(x.name+' '+x.code).includes(q))&&(!category||x.category===category)&&
    (status==='all'||x.active===(status==='active'))&&
    (formula==='all'||(formula==='ready'?x.formula?.length>0:!x.formula?.length)));
}
