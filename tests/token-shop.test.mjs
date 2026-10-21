import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTokenShop} from '../src/token-shop.mjs';
import {ID} from '../src/trade.mjs';

function fixture(){
  const actor={flags:{[ID]:{shop:{enabled:true,public:true}}}};
  const handlers=new Map(),opened=[];
  const token={actor,isVisible:true,bounds:{contains:(x,y)=>x===10&&y===20}};
  const canvas={stage:{on:(name,fn)=>handlers.set(name,fn),off:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name);},toLocal:p=>({x:p.x/2,y:p.y/2})},tokens:{active:true,placeables:[token]}};
  const click=(extra={})=>handlers.get('pointertap')?.({button:0,global:{x:20,y:40},...extra});
  return {actor,token,canvas,handlers,opened,click,bind:(user={isGM:false})=>bindTokenShop(canvas,user,a=>opened.push(a))};
}
test('player click opens public shop using token Actor without sheet ownership and converts zoom coordinates',()=>{
  const f=fixture();f.bind();f.click();assert.deepEqual(f.opened,[f.actor]);
});
test('hidden tokens, closed stores, ordinary NPCs, modifiers and inactive token layer do not open shops',()=>{
  for(const change of [f=>f.token.isVisible=false,f=>f.actor.flags[ID].shop.public=false,f=>f.actor.flags[ID].shop.enabled=false,f=>f.token.actor={flags:{}},f=>f.canvas.tokens.active=false,f=>f.token.isPreview=true,f=>f.token.isDragged=true]){
    const f=fixture();f.bind();change(f);f.click();assert.equal(f.opened.length,0);
  }
  const f=fixture();f.bind();for(const extra of [{button:2},{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{global:{x:500,y:500}}])f.click(extra);
  assert.equal(f.opened.length,0);
});
test('GM controls are untouched; cleanup removes handler; foreground non-vendor blocks shop behind it',()=>{
  const f=fixture();f.bind({isGM:true});assert.equal(f.handlers.size,0);
  const cleanup=f.bind();cleanup();f.click();assert.equal(f.opened.length,0);
  f.bind();f.canvas.tokens.placeables.push({...f.token,actor:{flags:{}},zIndex:5});f.click();assert.equal(f.opened.length,0);
});
