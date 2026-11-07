import {useEffect,useId,useRef,useState} from 'react'
import {makeGlassDisplacementMap,type GlassMap} from '../lib/glassOptics'

type Props={radius:number;strength?:number}

/** A purely visual material layer: buttons and form inputs stay normal DOM controls.
 * Chromium's SVG backdrop filter refracts live content; other engines use frosted CSS.
 * ResizeObserver rebuilds the displacement map only when the surface changes shape.
 */
export function OpticalGlass({radius,strength=30}:Props){
  const id='pt-lens-'+useId().replace(/[^a-zA-Z0-9_-]/g,'')
  const surface=useRef<HTMLSpanElement|null>(null)
  const [map,setMap]=useState<GlassMap|null>(null)

  useEffect(()=>{
    const node=surface.current
    const host=node?.parentElement
    if(!node||!host||typeof window==='undefined')return
    const ua=window.navigator.userAgent
    const chromium=/(?:Chrome|Chromium|Edg|OPR)\//.test(ua)&&
      !/(?:Firefox|FxiOS|CriOS)\//.test(ua)
    const backdrop=typeof CSS!=='undefined'&&
      (CSS.supports('backdrop-filter','blur(3px)')||
       CSS.supports('-webkit-backdrop-filter','blur(3px)'))
    if(!chromium||!backdrop)return

    let frame=0
    let alive=true
    let measuredW=0,measuredH=0
    const update=()=>{
      frame=0
      if(!alive)return
      const box=host.getBoundingClientRect()
      const width=Math.round(box.width),height=Math.round(box.height)
      if(width===measuredW&&height===measuredH)return
      measuredW=width;measuredH=height
      try{setMap(makeGlassDisplacementMap(width,height,radius))}
      catch{setMap(null)} // The frosted fallback still works on weak WebViews.
    }
    const schedule=()=>{
      if(frame)cancelAnimationFrame(frame)
      frame=requestAnimationFrame(update)
    }
    schedule()
    const observer=typeof ResizeObserver!=='undefined'?
      new ResizeObserver(schedule):null
    observer?.observe(host)
    window.addEventListener('resize',schedule,{passive:true})
    const pointer=(event:PointerEvent)=>{
      const box=host.getBoundingClientRect()
      if(!box.width||!box.height)return
      node.style.setProperty('--pt-glint-x',`${Math.round((event.clientX-box.left)/box.width*100)}%`)
      node.style.setProperty('--pt-glint-y',`${Math.round((event.clientY-box.top)/box.height*100)}%`)
    }
    const reset=()=>{
      node.style.setProperty('--pt-glint-x','38%')
      node.style.setProperty('--pt-glint-y','0%')
    }
    host.addEventListener('pointermove',pointer,{passive:true})
    host.addEventListener('pointerleave',reset,{passive:true})
    return()=>{
      alive=false
      if(frame)cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize',schedule)
      host.removeEventListener('pointermove',pointer)
      host.removeEventListener('pointerleave',reset)
    }
  },[radius])

  const svgFilter=map?`url("#${id}") blur(3px) saturate(1.3)`:null
  return <>
    {map&&<svg className="pt-optical-defs" width="0" height="0" focusable="false" aria-hidden="true">
      <defs>
        <filter id={id} x="-12%" y="-12%" width="124%" height="124%"
          colorInterpolationFilters="sRGB">
          <feImage href={map.dataUrl} x="0" y="0" width={map.width}
            height={map.height} preserveAspectRatio="none" result="optical-map"/>
          <feDisplacementMap in="SourceGraphic" in2="optical-map"
            scale={strength} xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>}
    <span ref={surface}
      className={`pt-optical-glass ${map?'pt-optical-glass-ready':''}`}
      style={svgFilter?{backdropFilter:svgFilter,WebkitBackdropFilter:svgFilter}:undefined}
      aria-hidden="true"/>
  </>
}
