import {useRef,useState,type CSSProperties,type ReactNode,type PointerEvent,type KeyboardEvent} from 'react'
import {OpticalGlass} from './OpticalGlass'
import {navigationPosition,navigationKeyIndex} from '../lib/navigationSlider'
import {dockOverlayAlpha} from '../lib/uiPreferences'

type Item<T extends string>={id:T;label:string;icon:ReactNode}
type Props<T extends string>={items:Item<T>[];activeId:T;glass:boolean;dockTransparency:number;onSelect:(id:T)=>void}

/** One moving selection capsule; semantic controls preserve keyboard and screen-reader access. */
export function MobileNavigation<T extends string>({items,activeId,glass,dockTransparency,onSelect}:Props<T>){
  const host=useRef<HTMLElement>(null)
  const gesture=useRef<{id:number;startX:number;dragged:boolean}|null>(null)
  const [preview,setPreview]=useState<number|null>(null)
  const [pressed,setPressed]=useState(false)
  const [dragging,setDragging]=useState(false)
  const active=items.findIndex(item=>item.id===activeId)
  const position=preview??Math.max(0,active)
  const sample=(clientX:number)=>{
    const buttons=host.current?.querySelectorAll('button')
    if(!buttons?.length)return 0
    const first=buttons[0].getBoundingClientRect()
    const last=buttons[buttons.length-1].getBoundingClientRect()
    return navigationPosition(clientX,first.left+first.width/2,last.left+last.width/2,items.length)
  }
  const reset=()=>{
    gesture.current=null
    setPreview(null)
    setPressed(false)
    setDragging(false)
  }
  const down=(event:PointerEvent<HTMLElement>)=>{
    if(!event.isPrimary||event.button!==0||gesture.current)return
    gesture.current={id:event.pointerId,startX:event.clientX,dragged:false}
    event.currentTarget.setPointerCapture(event.pointerId)
    // Expand immediately under the finger. Keep the position continuous,
    // including between all three tab centers, until the pointer is released.
    setPressed(true)
    setPreview(sample(event.clientX))
  }
  const move=(event:PointerEvent<HTMLElement>)=>{
    const current=gesture.current
    if(!current||current.id!==event.pointerId)return
    if(!current.dragged&&Math.abs(event.clientX-current.startX)>4){
      current.dragged=true
      setDragging(true)
    }
    setPreview(sample(event.clientX))
  }
  const up=(event:PointerEvent<HTMLElement>)=>{
    const current=gesture.current
    if(!current||current.id!==event.pointerId)return
    const index=Math.round(sample(event.clientX))
    reset()
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
    if(items[index])onSelect(items[index].id)
  }
  const key=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
    const next=navigationKeyIndex(event.key,index,items.length)
    if(next===null)return
    event.preventDefault()
    host.current?.querySelectorAll('button')[next]?.focus()
    onSelect(items[next].id)
  }
  return <nav ref={host} className={`paytakt-mobile-tabs pt-slider-nav ${glass?'pt-optical-host':''}`}
    aria-label="Навігація PayTakt Mobile" data-dragging={dragging} data-pressed={pressed}
    style={{'--pt-tab-count':items.length,'--pt-tab-position':position,
      '--pt-dock-tint-alpha':dockOverlayAlpha(dockTransparency)} as CSSProperties}
    onPointerDown={down} onPointerMove={move} onPointerUp={up}
    onPointerCancel={reset} onLostPointerCapture={reset}>
    {glass&&<OpticalGlass radius={27} strength={24} dock reflectiveRim/>}
    <span className="pt-nav-thumb" aria-hidden="true" hidden={active<0&&preview===null}>
      {glass&&<OpticalGlass radius={21} strength={15} dock/>}
    </span>
    {items.map((item,index)=><button type="button" key={item.id}
      className={Math.round(position)===index&&(active>=0||preview!==null)?'active':''}
      aria-current={active===index?'page':undefined}
      onKeyDown={event=>key(event,index)}
      onClick={event=>{if(event.detail===0)onSelect(item.id)}}>
      {item.icon}<span>{item.label}</span>
    </button>)}
  </nav>
}
