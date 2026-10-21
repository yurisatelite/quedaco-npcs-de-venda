import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ID,wallet,money,transact,hydrateShop} from '../src/trade.mjs';
function fixture(){let sequence=0;const merchant={uuid:'Actor.m',flags:{[ID]:{shop:{enabled:true,public:true,markup:1,buyRate:.5,stock:[{id:'a',price:10,qty:3,source:{name:'Arma',type:'weapon',system:{price:10,quantity:1}}}]}}},async update(p){this.flags[ID].shop.stock=p[`flags.${ID}.shop.stock`];}};const buyer={uuid:'Actor.b',system:{currency:wallet(100)},items:new Map(),testUserPermission:()=>true,async update(p){this.system.currency=p['system.currency'];},async createEmbeddedDocuments(_t,sources){return sources.map(s=>{const item={...s,id:s._id??String(++sequence),uuid:'Item.'+sequence,toObject(){return {...s,_id:this.id};}};this.items.set(item.id,item);return item;});},async deleteEmbeddedDocuments(_t,ids){ids.forEach(id=>this.items.delete(id));},async updateEmbeddedDocuments(_t,updates){for(const u of updates)this.items.get(u._id).system.quantity=u['system.quantity'];}};return {merchant,buyer,user:{isGM:false}};}
test('moedas e conversões',()=>{for(const n of [0,9,10,999,1000,5432])assert.equal(money(wallet(n)),n);assert.throws(()=>wallet(-1));});
test('compra debita, entrega e reduz estoque',async()=>{const f=fixture();await transact(f.merchant,f.buyer,f.user,{kind:'buy',lines:[{id:'a',qty:2}]});assert.equal(money(f.buyer.system.currency),80);assert.equal(f.buyer.items.size,1);assert.equal(f.merchant.flags[ID].shop.stock[0].qty,1);});
test('estoque insuficiente e pedido duplicado não alteram ficha',async()=>{for(const lines of [[{id:'a',qty:4}],[{id:'a',qty:1},{id:'a',qty:1}]]){const f=fixture();await assert.rejects(transact(f.merchant,f.buyer,f.user,{kind:'buy',lines}));assert.equal(money(f.buyer.system.currency),100);}});
test('falha de entrega recupera moedas',async()=>{const f=fixture();f.buyer.createEmbeddedDocuments=async()=>{throw Error('Falhou');};await assert.rejects(transact(f.merchant,f.buyer,f.user,{kind:'buy',lines:[{id:'a',qty:1}]}));assert.equal(money(f.buyer.system.currency),100);});
test('venda remove item e repõe estoque',async()=>{const f=fixture();await transact(f.merchant,f.buyer,f.user,{kind:'buy',lines:[{id:'a',qty:2}]});await transact(f.merchant,f.buyer,f.user,{kind:'sell',lines:[{id:[...f.buyer.items.keys()][0],qty:2}]});assert.equal(money(f.buyer.system.currency),90);assert.equal(f.buyer.items.size,0);assert.equal(f.merchant.flags[ID].shop.stock.length,2);});
test('não proprietário e loja fechada são recusados',async()=>{const f=fixture();f.buyer.testUserPermission=()=>false;await assert.rejects(transact(f.merchant,f.buyer,f.user,{kind:'buy',lines:[{id:'a',qty:1}]}));assert.equal(money(f.buyer.system.currency),100);});
test('falha na gravação do estoque recupera entrega e saldo',async()=>{const f=fixture();let first=true;const update=f.merchant.update;f.merchant.update=async function(p){if(first){first=false;throw Error('Falhou');}return update.call(this,p);};await assert.rejects(transact(f.merchant,f.buyer,f.user,{kind:'buy',lines:[{id:'a',qty:1}]}));assert.equal(money(f.buyer.system.currency),100);assert.equal(f.buyer.items.size,0);assert.equal(f.merchant.flags[ID].shop.stock[0].qty,3);});
test('sem saldo ou loja fechada não entrega',async()=>{for(const closed of [true,false]){const f=fixture();if(closed)f.merchant.flags[ID].shop.enabled=false;else f.buyer.system.currency=wallet(0);await assert.rejects(transact(f.merchant,f.buyer,f.user,{kind:'buy',lines:[{id:'a',qty:1}]}));assert.equal(f.buyer.items.size,0);assert.equal(f.merchant.flags[ID].shop.stock[0].qty,3);}});
test('estoque antigo do QUEDAÇO é resolvido e fica disponível na loja nova',async()=>{
  const item={type:'weapon',name:'Lança',system:{price:25,quantity:1},toObject(){return {...this,_id:'item-old'};}};
  const previous=globalThis.fromUuid;globalThis.fromUuid=async uuid=>uuid==='Compendium.skyfall.Item.lanca'?item:null;
  try{
    const actor={flags:{quedaco:{npc:{shop:{enabled:true,public:true,stock:[{uuid:'Compendium.skyfall.Item.lanca',price:30,qty:2}]}}}}};
    const result=await hydrateShop(actor);assert.equal(result.stock.length,1);assert.equal(result.stock[0].source.name,'Lança');assert.equal(result.stock[0].price,30);assert.equal(result.stock[0].qty,2);
  }finally{globalThis.fromUuid=previous;}
});

import {readFile} from 'node:fs/promises';
test('publica o descritor do protocolo QUEDAÇO v1 sem expor dados privados',async()=>{
  const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
  const manifest=JSON.parse(await readFile(new URL('../module.json',import.meta.url),'utf8'));
  assert.match(main,/family:'quedaco'/);assert.match(main,/contractVersion:1/);
  assert.match(main,/Hooks\.callAll\('quedaco:register',descriptor\)/);assert.match(main,/module\.api=descriptor/);
  assert.match(main,/getStatus:\(\)=>\(\{ready:/);
  assert.doesNotMatch(main,/getStatus:[^\n]*stock/);
  assert.equal(manifest.id,'quedaco-npcs-de-venda');assert.match(manifest.title,/^QUEDAÇO - /);
  assert.doesNotMatch(main,/DialogV2\.confirm/);
});
