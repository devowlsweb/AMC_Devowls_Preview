export const STORAGE_KEY = 'amc-demo-v1';
export const categories = ['Limpieza general', 'Lavandería', 'Cuidado de superficies', 'Higiene'];
export const materialCategories = ['Base', 'Activo', 'Fragancia', 'Aditivo'];
export const units = ['kg', 'g', 'L', 'mL'];
export const productStockUnits = ['L', 'kg', 'mL', 'g', 'u'];
const stockScale = 1_000_000;
const stockLimit = 1_000_000_000;
const stockSizes = {kg:1000,g:1,L:1000,mL:1};
const massUnits = new Set(['kg','g']);
const demoMaterialStocks = {m1:1000,m2:250,m3:25000,m4:25000,m5:250,m6:25000,m7:25000,m8:1000};
const demoProductStocks = {p1:120,p2:90,p3:65,p4:50,p5:30,p6:25};
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
  ].map(([id,code,name,category,unit])=>({id,code,name,category,unit,stock:defaultMaterialStock({id,unit}),active:true,updatedAt:stamp,updatedBy:'Administración demo'}));
  const exampleFormulas = [
    [['m1',80,'L'],['m2',8,'kg'],['m3',250,'mL'],['m4',150,'g']],
    [['m8',55,'L'],['m2',12.5,'kg'],['m7',200,'g']],
    [['m1',65,'L'],['m5',6,'kg'],['m6',300,'mL'],['m4',90,'g']],
    [['m8',40,'L'],['m5',14,'kg'],['m7',350,'g']]
  ];
  const products = [
    ['p1','PR-001','Limpiador multiuso','Limpieza general','green'],
    ['p2','PR-002','Detergente concentrado','Limpieza general','blue'],
    ['p3','PR-003','Suavizante floral','Lavandería','pink'],
    ['p4','PR-004','Desengrasante','Cuidado de superficies','gold'],
    ['p5','PR-005','Jabón líquido','Higiene','violet'],
    ['p6','PR-006','Limpiador de pisos','Cuidado de superficies','green']
  ].map(([id,code,name,category,color],i)=>({
    id,code,name,category,color,active:true,
    stock:defaultProductStock({id}),
    description:'Producto ficticio para explorar el sistema de gestión.',
    formula:(exampleFormulas[i]||[]).map(([materialId,quantity,unit])=>({materialId,quantity,unit})),
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
function defaultMaterialStock(material){
  return {quantity:demoMaterialStocks[material.id]??0,unit:material.unit};
}
function defaultProductStock(product){
  return Object.hasOwn(demoProductStocks,product.id)?{quantity:demoProductStocks[product.id],unit:'L'}:null;
}
export function validStockQuantity(quantity){
  return Number.isFinite(quantity)&&quantity>=0&&quantity<=stockLimit&&Math.round(quantity*stockScale)/stockScale===quantity;
}
export function planProduction(product,rows,materials,quantity,unit){
  const errors=[],consumption=[];
  const productStock=product.stock??{quantity:0,unit};
  const currentTicks=Math.round(productStock.quantity*stockScale);
  const totalTicks=currentTicks+Math.round(quantity*stockScale);
  if(!product.active)errors.push('El producto debe estar activo.');
  const quantityError=validStockQuantity(quantity)&&quantity>0?'':'Ingresá una cantidad mayor que cero, de hasta 1.000 millones y con un máximo de seis decimales.';
  if(!productStockUnits.includes(unit)||unit!==productStock.unit)errors.push('Elegí la unidad de stock del producto.');
  if(totalTicks>stockLimit*stockScale)errors.push('La existencia del producto supera el límite de la demo.');
  const formulaErrors=validateFormula(rows,materials);
  if(formulaErrors.length)return {quantityError,errors:[...errors,'Revisá la fórmula antes de registrar la producción.'],consumption};

  const totals=new Map();
  for(const row of rows){
    const material=materials.find(m=>m.id===row.materialId),stock=material.stock;
    if(!material.active||!stock||massUnits.has(row.unit)!==massUnits.has(stock.unit)){
      const message=material.active?`${material.name}: la unidad de la fórmula debe ser compatible con la de stock.`:`${material.name}: la materia prima está inactiva.`;
      if(!errors.includes(message))errors.push(message);
      continue;
    }
    const used=parseQuantity(row.quantity)*(stockSizes[row.unit]/stockSizes[stock.unit]);
    totals.set(material,(totals.get(material)??0)+used);
  }
  for(const [material,used] of totals){
    const usedTicks=Math.round(used*stockScale),availableTicks=Math.round(material.stock.quantity*stockScale);
    if(!Number.isFinite(usedTicks)||usedTicks<=0){
      errors.push(`${material.name}: el consumo está fuera de la precisión de stock.`);
      continue;
    }
    const remainingTicks=availableTicks-usedTicks;
    if(remainingTicks<0)errors.push(`${material.name}: stock insuficiente.`);
    consumption.push({material,used:usedTicks/stockScale,remaining:remainingTicks/stockScale});
  }
  return {quantityError,errors,consumption,productStock:{quantity:totalTicks/stockScale,unit}};
}
export function scaleFormula(rows,index,value) {
  const quantity=parseQuantity(value),reference=rows[index];
  if(!reference||!Number.isFinite(quantity)||quantity<=0)return null;
  if(quantity===reference.quantity)return rows.map(row=>({...row}));
  const factor=quantity/reference.quantity;
  const scaled=rows.map((row,i)=>({
    ...row,
    quantity:i===index?quantity:Number((row.quantity*factor).toPrecision(12))
  }));
  return scaled.every(row=>Number.isFinite(row.quantity)&&row.quantity>0)?scaled:null;
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
  const validStock=(stock,allowed)=>stock&&allowed.includes(stock.unit)&&validStockQuantity(stock.quantity);
  if(!state.materials.every(m=>m.stock===undefined||validStock(m.stock,units)))return false;
  if(!state.products.every(p=>p&&(p.stock==null||validStock(p.stock,productStockUnits))))return false;
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
    for(const material of state.materials)material.stock??=defaultMaterialStock(material);
    for(const product of state.products)if(product.stock===undefined)product.stock=defaultProductStock(product);
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
