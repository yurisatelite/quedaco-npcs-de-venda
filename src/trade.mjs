export const ID='quedaco-npcs-de-venda';
export const GOODS=new Set(['weapon','armor','clothing','equipment','consumable','loot']);
export function integer(value,min=0){const n=Number(value);if(!Number.isSafeInteger(n)||n<min)throw Error('Número inválido.');return n;}
export function money(currency={}){return integer(currency.k??0)*1000+integer(currency.p??0)*10+integer(currency.t??0);}
export function wallet(total){integer(total);return {k:Math.floor(total/1000),p:Math.floor(total%1000/10),t:total%10};}
function resolveItem(uuid){
  try{return globalThis.fromUuidSync?.(uuid)??globalThis.game?.items?.get?.(String(uuid).split('.').pop())??null;}catch{return null;}
}
async function resolveItemAsync(uuid){
  try{return await globalThis.fromUuid?.(uuid)??resolveItem(uuid);}catch{return resolveItem(uuid);}
}
function legacyStock(actor){
  const old=actor?.flags?.quedaco?.npc?.shop;
  if(!old||!Array.isArray(old.stock))return [];
  return old.stock.flatMap(entry=>{
    const uuid=String(entry?.uuid??'');if(!uuid)return [];
    const document=resolveItem(uuid),source=document?.toObject?.();
    if(!source||!goods(source))return [];
    delete source._id;
    return [{id:`legacy:${uuid}`,origin:uuid,source,price:entry.price==null?integer(source.system?.price??0):integer(entry.price),qty:entry.qty==null?null:integer(entry.qty),qtyMax:entry.qtyMax==null?null:integer(entry.qtyMax),note:String(entry.note??'')}];
  });
}
export function shop(actor){
  const current=actor?.flags?.[ID]?.shop??{},old=actor?.flags?.quedaco?.npc?.shop??{},stock=Array.isArray(current.stock)?current.stock:[];
  const known=new Set(stock.map(entry=>entry.origin??entry.id));
  const merged=[...stock,...legacyStock(actor).filter(entry=>!known.has(entry.origin))];
  return {enabled:false,public:false,markup:1,buyRate:.5,...old,...current,stock:merged};
}
export async function hydrateShop(actor){
  const current=shop(actor),old=actor?.flags?.quedaco?.npc?.shop;
  if(!old||!Array.isArray(old.stock))return current;
  const known=new Set(current.stock.map(entry=>entry.origin??entry.id));
  const additions=[];
  for(const entry of old.stock){
    const uuid=String(entry?.uuid??'');if(!uuid||known.has(uuid))continue;
    const document=await resolveItemAsync(uuid),source=document?.toObject?.();
    if(!source||!goods(source))continue;
    delete source._id;
    additions.push({id:`legacy:${uuid}`,origin:uuid,source,price:entry.price==null?integer(source.system?.price??0):integer(entry.price),qty:entry.qty==null?null:integer(entry.qty),qtyMax:entry.qtyMax==null?null:integer(entry.qtyMax),note:String(entry.note??'')});
  }
  return additions.length?{...current,stock:[...current.stock,...additions]}:current;
}
export function price(base,rate){integer(base);rate=Number(rate);if(!Number.isFinite(rate)||rate<0||rate>100)throw Error('Multiplicador inválido.');return integer(Math.round(base*rate));}
export function quantity(item){return integer(item.system?.quantity??1);}
export function goods(item){return GOODS.has(item?.type);}
export function assertAccess(merchant,buyer,user){const s=shop(merchant);if(!s.enabled||(!s.public&&!user.isGM))throw Error('Loja fechada.');if(!buyer||buyer.uuid===merchant.uuid||!buyer.system?.currency||!buyer.testUserPermission(user,'OWNER'))throw Error('Escolha uma ficha sua com moedas.');return s;}
/** Chamado apenas pela Mestra; operações serializadas na camada de transporte. */
export async function transact(merchant,buyer,user,request){
  const access=assertAccess(merchant,buyer,user),s=request.stock?{...access,stock:request.stock}:access,before=money(buyer.system.currency);
  const lines=request.lines;if(!Array.isArray(lines)||!lines.length||lines.length>100)throw Error('Pedido inválido.');
  const seen=new Set(),sources=[],updates=[],deletes=[];let total=0;
  const stock=structuredClone(s.stock);
  for(const line of lines){
    const qty=integer(line.qty,1),id=String(line.id);if(seen.has(id))throw Error('Item repetido.');seen.add(id);
    if(request.kind==='buy'){
      const entry=stock.find(e=>e.id===id);if(!entry||!goods(entry.source))throw Error('Item indisponível.');
      if(entry.qty!==null&&integer(entry.qty)<qty)throw Error('Estoque insuficiente.');
      total+=price(entry.price,s.markup)*qty;
      const source=structuredClone(entry.source);delete source._id;source.system.quantity=qty;sources.push(source);
      if(entry.qty!==null)entry.qty-=qty;
    }else if(request.kind==='sell'){
      const item=buyer.items.get(id);if(!goods(item)||quantity(item)<qty)throw Error('Item ou quantidade indisponível.');
      total+=price(item.system.price,s.buyRate)*qty;
      const source=structuredClone(item.toObject());delete source._id;source.system.quantity=1;
      const existing=stock.find(e=>e.origin===item.uuid);
      if(existing&&existing.qty!==null)existing.qty+=qty;
      else stock.push({id:globalThis.foundry?.utils?.randomID?.()??crypto.randomUUID(),origin:item.uuid,source,price:integer(item.system.price),qty});
      if(quantity(item)===qty)deletes.push(item.toObject());else updates.push({_id:item.id,'system.quantity':quantity(item)-qty});
    }else throw Error('Operação inválida.');
  }
  integer(total);const after=request.kind==='buy'?before-total:before+total;integer(after);
  const originals=updates.map(u=>({_id:u._id,'system.quantity':quantity(buyer.items.get(u._id))}));
  let created=[];
  try{
    await buyer.update({'system.currency':wallet(after)});
    if(sources.length){created=await buyer.createEmbeddedDocuments('Item',sources);if(created.length!==sources.length)throw Error('Entrega incompleta.');}
    if(updates.length)await buyer.updateEmbeddedDocuments('Item',updates);
    if(deletes.length)await buyer.deleteEmbeddedDocuments('Item',deletes.map(d=>d._id));
    await merchant.update({[`flags.${ID}.shop.stock`]:stock});
  }catch(error){
    const repairs=[()=>buyer.update({'system.currency':wallet(before)}),()=>merchant.update({[`flags.${ID}.shop.stock`]:s.stock})];
    if(created.length)repairs.push(()=>buyer.deleteEmbeddedDocuments('Item',created.map(d=>d.id)));
    if(originals.length)repairs.push(()=>buyer.updateEmbeddedDocuments('Item',originals));
    const missing=deletes.filter(d=>!buyer.items.get(d._id));if(missing.length)repairs.push(()=>buyer.createEmbeddedDocuments('Item',missing,{keepId:true}));
    const failures=[];for(const repair of repairs)try{await repair();}catch(e){failures.push(e);}
    if(failures.length){console.error(ID,'Falha na recuperação',failures);throw Error('Falha na transação e na recuperação. Confira moedas e inventários com a Mestra.');}
    throw error;
  }
  return {total,after};
}
