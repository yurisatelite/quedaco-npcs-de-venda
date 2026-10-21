import {shop} from './trade.mjs';

/** Player interaction uses the visible token's Actor, including synthetic Actors.
 * No sheet ownership is required and the GM's normal token controls are untouched.
 * Returns a cleanup function so scene changes never accumulate listeners. */
export function bindTokenShop(canvas,user,open){
  if(user?.isGM||!canvas?.stage)return ()=>{};
  const stage=canvas.stage;
  const click=event=>{
    if(event.button!==0||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||!event.global)return;
    if(!canvas.tokens?.active)return;
    const point=stage.toLocal(event.global);
    const tokens=[...(canvas.tokens.placeables??[])].reverse().sort((a,b)=>(b.zIndex??0)-(a.zIndex??0));
    // Only the top visible token under the pointer can be interacted with.
    const token=tokens.find(t=>t.isVisible&&!t.isPreview&&!t.isDragged&&t.bounds?.contains(point.x,point.y));
    if(!token?.actor)return;
    const state=shop(token.actor);
    if(state.enabled&&state.public)open(token.actor);
  };
  stage.on('pointertap',click);
  return ()=>stage.off('pointertap',click);
}
