import {ID,shop,goods,integer,price,money,assertAccess,transact} from './trade.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const channel=`module.${ID}`;let queue=Promise.resolve();const processed=new Set();
const gm=()=>game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0];
const notifyError=e=>ui.notifications.error(e.message??String(e));
function dialog(title,content,buttons,bind){
  const d=new foundry.applications.api.DialogV2({window:{title},position:{width:640},content:`<div class="qnv">${content}</div>`,buttons});
  d.addEventListener('render',()=>bind?.(d.element));d.render({force:true});return d;
}
async function configure(actor){
  if(!game.user.isGM)return;const s=shop(actor);
  dialog(`${actor.name} · Comerciante`,`
    <label><input name="enabled" type="checkbox" ${s.enabled?'checked':''}> Ativar modo comerciante</label>
    <label><input name="public" type="checkbox" ${s.public?'checked':''}> Liberar loja para jogadores</label>
    <label>Preço de venda × <input name="markup" type="number" min="0" max="100" step="0.05" value="${esc(s.markup)}"></label>
    <label>Revenda × <input name="buyRate" type="number" min="0" max="100" step="0.05" value="${esc(s.buyRate)}"></label>
    <small>1 = preço de tabela. 0,5 = metade. Os multiplicadores são configuráveis.</small>
    <label>Apresentação <input name="note" value="${esc(s.note)}"></label>
    <small>Estoque independente do inventário pessoal. Configure os itens na loja depois de salvar.</small>`,[
    {action:'save',label:'Salvar',default:true,callback:async(_event,_button,d)=>{try{const root=d.element;const data={...s,enabled:root.querySelector('[name=enabled]').checked,public:root.querySelector('[name=public]').checked,markup:Number(root.querySelector('[name=markup]').value),buyRate:Number(root.querySelector('[name=buyRate]').value),note:root.querySelector('[name=note]').value};price(1,data.markup);price(1,data.buyRate);await actor.setFlag(ID,'shop',data);if(data.enabled)openShop(actor);}catch(e){notifyError(e);}}},
    {action:'cancel',label:'Fechar'}]);
}
function buyerList(merchant){return game.actors.filter(a=>a.uuid!==merchant.uuid&&a.system?.currency&&a.testUserPermission(game.user,'OWNER'));}
export function openShop(actor,mode='buy',buyerId=''){
  const s=shop(actor);if(!s.enabled||(!s.public&&!game.user.isGM))return ui.notifications.warn('Loja fechada.');
  const buyers=buyerList(actor),buyer=buyers.find(a=>a.id===buyerId)??buyers[0];
  const entries=mode==='buy'?s.stock:buyer?.items.filter(goods).map(i=>({id:i.id,source:i.toObject(),price:i.system.price,qty:i.system.quantity}))??[];
  const rows=entries.map(e=>`<div class="qnv-row"><img src="${esc(e.source.img)}"><span>${esc(e.source.name)}<br><small>Estoque: ${e.qty===null?'ilimitado':esc(e.qty)}</small></span><span>T$ ${price(e.price,mode==='buy'?s.markup:s.buyRate)}</span><input data-line="${esc(e.id)}" aria-label="Quantidade de ${esc(e.source.name)}" type="number" min="0" step="1" value="0"></div>`).join('');
  let d;d=dialog(`${actor.name} · Loja`,`${s.note?`<p>${esc(s.note)}</p>`:''}
    <label>Personagem <select name="buyer">${buyers.map(a=>`<option value="${a.id}" ${a===buyer?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
    <small>Saldo: T$ ${buyer?money(buyer.system.currency):0} · ${mode==='buy'?'Comprando da loja':'Vendendo para a loja'}</small>
    ${game.user.isGM?'<div class="qnv-drop">Arraste itens aqui para adicionar ao estoque.</div>':''}
    ${rows||'<p>Nenhum item disponível.</p>'}
    <strong data-total>Total: T$ 0</strong>
    ${game.user.isGM?'<small>Para editar o estoque, use o botão Estoque.</small>':'<small>A Mestra confirma cada pedido. Ela precisa estar conectada.</small>'}`,[
      {action:'checkout',label:mode==='buy'?'Comprar selecionados':'Vender selecionados',default:true,callback:async(_e,_b,app)=>{try{const lines=[...app.element.querySelectorAll('[data-line]')].map(el=>({id:el.dataset.line,qty:integer(el.value)})).filter(l=>l.qty);if(!lines.length)throw Error('Selecione uma quantidade.');await requestTrade(actor,buyer,{kind:mode,lines});}catch(e){notifyError(e);}}},
      {action:'switch',label:mode==='buy'?'Vender meus itens':'Comprar',callback:()=>openShop(actor,mode==='buy'?'sell':'buy',buyer?.id)},
      ...(game.user.isGM?[{action:'stock',label:'Estoque',callback:()=>editStock(actor)},{action:'settings',label:'Configurar',callback:()=>configure(actor)}]:[]),
      {action:'close',label:'Fechar'}],root=>{
        root.querySelector('[name=buyer]')?.addEventListener('change',e=>{d.close();openShop(actor,mode,e.target.value);});
        root.addEventListener('input',()=>{try{let total=0;for(const el of root.querySelectorAll('[data-line]')){const e=entries.find(e=>e.id===el.dataset.line);total+=integer(el.value)*price(e.price,mode==='buy'?s.markup:s.buyRate);}root.querySelector('[data-total]').textContent=`Total: T$ ${total}`;}catch{root.querySelector('[data-total]').textContent='Quantidade inválida';}});
        if(game.user.isGM){root.addEventListener('dragover',e=>e.preventDefault());root.addEventListener('drop',async e=>{e.preventDefault();try{const data=JSON.parse(e.dataTransfer.getData('text/plain'));if(data.type!=='Item')throw Error('Arraste um item.');const item=await Item.fromDropData(data);if(!goods(item))throw Error('Este tipo de item não é mercadoria.');const source=item.toObject();delete source._id;source.system.quantity=1;const current=shop(actor);current.stock.push({id:foundry.utils.randomID(),origin:item.uuid,source,price:integer(item.system.price??0),qty:1});await actor.setFlag(ID,'shop',current);d.close();openShop(actor,mode,buyer?.id);}catch(err){notifyError(err);}});}
      });return d;
}
function editStock(actor){
  if(!game.user.isGM)return;const s=shop(actor);
  dialog(`${actor.name} · Estoque`,s.stock.map(e=>`<div class="qnv-row"><input data-remove="${e.id}" type="checkbox" title="Remover"><span>${esc(e.source.name)}</span><label>T$ <input data-price="${e.id}" type="number" min="0" value="${e.price}"></label><input data-qty="${e.id}" type="number" min="-1" value="${e.qty===null?-1:e.qty}" title="-1 = ilimitado"></div>`).join('')+'<small>Marque para remover. Quantidade -1 significa estoque ilimitado.</small>',[
    {action:'save',label:'Salvar',default:true,callback:async(_e,_b,d)=>{try{s.stock=s.stock.filter(e=>!d.element.querySelector(`[data-remove="${e.id}"]`).checked).map(e=>{const qty=integer(d.element.querySelector(`[data-qty="${e.id}"]`).value,-1);return {...e,price:integer(d.element.querySelector(`[data-price="${e.id}"]`).value),qty:qty===-1?null:qty};});await actor.setFlag(ID,'shop',s);openShop(actor);}catch(e){notifyError(e);}}},{action:'cancel',label:'Fechar'}]);
}
async function requestTrade(merchant,buyer,request){
  if(!buyer)throw Error('Escolha um personagem.');if(!gm())throw Error('A Mestra precisa estar conectada.');
  const payload={...request,id:foundry.utils.randomID(),merchant:merchant.uuid,buyer:buyer.uuid,user:game.user.id};
  if(game.user.isGM)await handle(payload);else {game.socket.emit(channel,payload);ui.notifications.info('Pedido enviado à Mestra.');}
}
async function handle(p){
  if(gm()?.id!==game.user.id||!p?.id||processed.has(p.id))return;
  processed.add(p.id);if(processed.size>2000)processed.delete(processed.values().next().value);
  queue=queue.then(async()=>{try{
    const merchant=await fromUuid(p.merchant),buyer=await fromUuid(p.buyer),user=game.users.get(p.user);if(!user)throw Error('Usuário não encontrado.');const s=assertAccess(merchant,buyer,user);
    if(!Array.isArray(p.lines)||!p.lines.length||p.lines.length>100)throw Error('Pedido inválido.');
    const details=p.lines.map(l=>{const entry=p.kind==='buy'?s.stock.find(e=>e.id===l.id):buyer.items.get(l.id);if(!entry)throw Error('Item indisponível.');return `${esc(entry.source?.name??entry.name)} × ${integer(l.qty,1)} — T$ ${price(entry.price??entry.system?.price,p.kind==='buy'?s.markup:s.buyRate)*l.qty}`;}).join('<br>');
    if(!user.isGM){const approved=await foundry.applications.api.DialogV2.confirm({window:{title:'Confirmar negociação'},content:`<p>${esc(user.name)} solicita ${p.kind==='buy'?'compra':'venda'} com ${esc(merchant.name)} usando ${esc(buyer.name)}.</p><p>${details}</p>`});if(!approved)return;}
    const result=await transact(merchant,buyer,user,p);
    await ChatMessage.create({content:`<p>${esc(buyer.name)} ${p.kind==='buy'?'comprou de':'vendeu para'} ${esc(merchant.name)}.</p><p>${details}</p><p>Total: T$ ${result.total}</p>`,whisper:[...new Set([user.id,...game.users.filter(u=>u.isGM).map(u=>u.id)])]});
    ui.notifications.info('Negociação concluída.');
  }catch(e){notifyError(e);}});await queue;
}
function sheetButton(app,html){
  if(game.system.id!=='skyfall')return;const actor=app.actor??app.document;if(!actor)return;const s=shop(actor);if(!game.user.isGM&&(!s.enabled||!s.public))return;
  const root=html instanceof HTMLElement?html:html?.[0]??app.element;const header=app.element?.querySelector?.('.window-header')??root?.querySelector('.window-header');if(!header||header.querySelector('.qnv-open'))return;
  const b=document.createElement('button');b.type='button';b.className='qnv-open header-control';b.title=s.enabled?'Abrir loja':'Configurar comerciante';b.setAttribute('aria-label',b.title);b.innerHTML='<i class="fa-solid fa-store"></i>';b.addEventListener('click',()=>{try{s.enabled?openShop(actor):configure(actor);}catch(e){notifyError(e);}});header.append(b);
}
Hooks.on('renderActorSheetV2',sheetButton);Hooks.on('renderActorSheet',sheetButton);
Hooks.once('ready',()=>{if(game.system.id!=='skyfall')return;game.socket.on(channel,p=>{if(game.user.isGM)void handle(p);});const module=game.modules.get(ID);
  // Protocolo de Integração QUEDAÇO v1. `open()` abre a loja do NPC (argumento) ou do token selecionado.
  const open=target=>{
    const actor=typeof target==='string'?game.actors.get(target):target?.documentName==='Actor'?target:canvas?.tokens?.controlled?.[0]?.actor;
    if(!actor)return ui.notifications.info('Selecione um token de comerciante (ou use o botão da loja na ficha).');
    return openShop(actor);
  };
  const descriptor=Object.freeze({family:'quedaco',contractVersion:1,id:module.id,title:module.title,version:module.version,
    capabilities:Object.freeze({merchantMode:true,shopInterface:true,tradeApproval:true}),
    open,openShop,configure,
    getStatus:()=>({ready:game.system.id==='skyfall',...(game.user.isGM?{merchants:game.actors.filter(a=>shop(a).enabled).length}:{})})});
  module.api=descriptor;Hooks.callAll('quedaco:register',descriptor);});
