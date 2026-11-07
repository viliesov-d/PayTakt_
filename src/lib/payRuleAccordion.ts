/**
 * Smooth height animation for salary-rule accordions only.
 *
 * Native <details> switches its content instantly on click. A direct height
 * animation (instead of animating only child opacity/translation) prevents the
 * large vertical jumps seen on mobile while keeping keyboard-accessible
 * summary controls and native open state.
 */
type Active={animation:Animation;opening:boolean}

export function bindPayRuleAccordions(root:HTMLElement):()=>void{
  const active=new Map<HTMLDetailsElement,Active>()
  const clearInline=(details:HTMLDetailsElement)=>{
    details.style.removeProperty('height')
    details.style.removeProperty('overflow')
  }
  const onClick=(event:MouseEvent)=>{
    if(!(event.target instanceof Element))return
    const summary=event.target.closest('summary')
    if(!summary||!root.contains(summary))return
    const details=summary.parentElement
    if(!(details instanceof HTMLDetailsElement)||
      !details.matches('details.pay-collapse,details.pay-optional'))return

    event.preventDefault() // We own the toggle until its animation finishes.
    const previous=active.get(details)
    const opening=previous?!previous.opening:!details.open
    const start=details.getBoundingClientRect().height
    if(previous){
      previous.animation.cancel()
      active.delete(details)
    }

    if(!opening&&details.contains(document.activeElement)&&document.activeElement!==summary){
      // Do not leave keyboard focus in content that is about to collapse.
      (summary as HTMLElement).focus()
    }

    const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false
    if(reducedMotion||typeof details.animate!=='function'){
      details.open=opening
      clearInline(details)
      return
    }

    // Keep the panel at its currently drawn height. A rapid second tap starts
    // from the interrupted height rather than snapping back to the beginning.
    details.style.height=start+'px'
    details.style.overflow='hidden'
    if(opening)details.open=true

    let end:number
    if(opening){
      details.style.height='auto'
      end=details.getBoundingClientRect().height
    }else{
      // Measure the true collapsed summary size synchronously. Reopening
      // before the browser paints keeps its content visible during the exit.
      details.open=false
      details.style.height='auto'
      end=details.getBoundingClientRect().height
      details.open=true
    }
    details.style.height=start+'px'

    const animation=details.animate(
      [{height:start+'px'},{height:end+'px'}],
      {duration:opening?340:270,easing:'cubic-bezier(.22,.78,.2,1)'}
    )
    const item:Active={animation,opening}
    active.set(details,item)
    animation.onfinish=()=>{
      if(active.get(details)!==item)return
      active.delete(details)
      details.open=opening
      clearInline(details)
    }
  }

  root.addEventListener('click',onClick)
  return()=>{
    root.removeEventListener('click',onClick)
    for(const [details,item] of active){
      item.animation.cancel()
      clearInline(details)
    }
    active.clear()
  }
}
