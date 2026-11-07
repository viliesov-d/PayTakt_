import {
  useLayoutEffect,useRef,useState,
  type CSSProperties,type ReactNode,type KeyboardEvent,type PointerEvent,
} from 'react'
import {OpticalGlass} from './OpticalGlass'
import {navigationKeyIndex,navigationPosition} from '../lib/navigationSlider'
import {dockOverlayAlpha,type UIStyle} from '../lib/uiPreferences'

type Item<T extends string>={id:T;label:string;icon:ReactNode}
type Props<T extends string>={
  items:Item<T>[];activeId:T;appearanceStyle:UIStyle;dockTransparency:number;onSelect:(id:T)=>void
}
type Gesture={id:number;startX:number;dragged:boolean}

/**
 * Browser-only dock. Native MobileNavigation (including its v0.9.17 pointer
 * capture and optical treatment) must not change.
 *
 * Taps use real button click events; the container only handles a drag once
 * the movement exceeds the threshold. This keeps Safari/Chrome touch, mouse,
 * keyboard and accessibility interactions independent of pointer capture.
 */
export function WebMobileNavigation<T extends string>({
  items,activeId,appearanceStyle,dockTransparency,onSelect,
}:Props<T>){
  const host=useRef<HTMLElement>(null)
  const gesture=useRef<Gesture|null>(null)
  const suppressClickUntil=useRef(0)
  const [preview,setPreview]=useState<number|null>(null)
  const [pressed,setPressed]=useState(false)
  const [dragging,setDragging]=useState(false)
  const [geometry,setGeometry]=useState({width:0,step:0})
  const active=items.findIndex(item=>item.id===activeId)
  const position=preview??Math.max(0,active)
  const glass=appearanceStyle==='glass'

  useLayoutEffect(()=>{
    const node=host.current
    if(!node)return
    const measure=()=>{
      const buttons=node.querySelectorAll('button')
      if(!buttons.length)return
      const first=buttons[0].getBoundingClientRect()
      const second=buttons[1]?.getBoundingClientRect()
      const width=first.width
      const step=second?second.left-first.left:first.width+5
      if(width<=0||step<=0)return
      setGeometry(old=>Math.abs(old.width-width)<.25&&Math.abs(old.step-step)<.25
        ?old:{width,step})
    }
    measure()
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize',measure,{passive:true})
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure)}
  },[items.length])

  const sample=(clientX:number)=>{
    const buttons=host.current?.querySelectorAll('button')
    if(!buttons?.length)return 0
    const first=buttons[0].getBoundingClientRect()
    const last=buttons[buttons.length-1].getBoundingClientRect()
    return navigationPosition(clientX,first.left+first.width/2,
      last.left+last.width/2,items.length)
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
    setPressed(true)
    setPreview(sample(event.clientX))
    // Capture the originating BUTTON, not the nav. Capturing the parent during
    // pointermove can emit a bubbling lostpointercapture on the touched button
    // and prematurely reset the drag on Chrome/Safari. The button remains the
    // click target, so short taps still work through its normal onClick.
    const target=event.target instanceof Element?event.target.closest('button'):null
    try{(target??event.currentTarget).setPointerCapture(event.pointerId)}
    catch{/* Some browsers keep their own implicit touch capture. */}
  }
  const move=(event:PointerEvent<HTMLElement>)=>{
    const current=gesture.current
    if(!current||current.id!==event.pointerId)return
    if(!current.dragged&&Math.abs(event.clientX-current.startX)>=4){
      current.dragged=true
      setDragging(true)
    }
    // Update continuously, not just when entering a different tab.
    // CSS disables transition during drag, keeping the lens under the finger.
    setPreview(sample(event.clientX))
  }
  const up=(event:PointerEvent<HTMLElement>)=>{
    const current=gesture.current
    if(!current||current.id!==event.pointerId)return
    const target=current.dragged?items[Math.round(sample(event.clientX))]:null
    if(current.dragged)suppressClickUntil.current=Date.now()+350
    reset()
    // Browser releases pointer capture on pointerup automatically. Do not
    // transfer it to the nav: that can break subsequent taps.
    if(target)onSelect(target.id)
    // For a tap, the actual button onClick below handles navigation.
  }
  const key=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
    const next=navigationKeyIndex(event.key,index,items.length)
    if(next===null)return
    event.preventDefault()
    host.current?.querySelectorAll('button')[next]?.focus()
    onSelect(items[next].id)
  }
  const select=(id:T)=>{
    if(Date.now()<suppressClickUntil.current)return
    onSelect(id)
  }

  return <nav ref={host}
    className={`paytakt-mobile-tabs pt-slider-nav pt-web-slider ${glass?'pt-optical-host':''}`}
    aria-label="Навігація PayTakt" data-dragging={dragging} data-pressed={pressed}
    data-glass={glass}
    style={{
      '--pt-tab-count':items.length,
      '--pt-tab-position':position,
      '--pt-dock-tint-alpha':dockOverlayAlpha(dockTransparency),
      '--pt-web-thumb-width':geometry.width>0?geometry.width+'px':undefined,
      '--pt-web-thumb-offset':(geometry.step*position).toFixed(2)+'px',
    } as CSSProperties}
    onPointerDown={down} onPointerMove={move} onPointerUp={up}
    onPointerCancel={reset}
    onLostPointerCapture={event=>{
      // Lost-capture events from descendants bubble. Only reset if the NAV's
      // own capture is lost, never when a child button releases its capture.
      if(event.target===event.currentTarget&&gesture.current?.id===event.pointerId)reset()
    }}>
    {glass&&<OpticalGlass radius={27} strength={24} dock reflectiveRim/>}
    <span className="pt-nav-thumb" aria-hidden="true" hidden={active<0&&preview===null}>
      {glass&&<OpticalGlass radius={21} strength={15} dock/>}
    </span>
    {items.map((item,index)=><button type="button" key={item.id}
      className={Math.round(position)===index&&(active>=0||preview!==null)?'active':''}
      aria-current={active===index?'page':undefined}
      onKeyDown={event=>key(event,index)} onClick={()=>select(item.id)}>
      {item.icon}<span>{item.label}</span>
    </button>)}
  </nav>
}
