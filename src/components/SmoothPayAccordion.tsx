import {Children,isValidElement,useId,useState,type ReactElement,type ReactNode} from 'react'

type SummaryProps={className?:string;children?:ReactNode}
type Props={className:string;children:ReactNode;open?:boolean}

/**
 * Pay Rules accordion: an always-mounted, CSS-grid disclosure.
 *
 * Avoids native <details> switching content-visibility/display in the middle
 * of a height animation, and avoids running getBoundingClientRect + WAAPI on
 * each click. Both mechanisms caused visible snapping on mobile browsers.
 *
 * The button retains keyboard activation and accurately reflects its state.
 * Closed controls are inert and hidden from assistive technology. The grid
 * transition runs in CSS, smoothly handling quick repeated taps.
 */
export function SmoothPayAccordion({className,children,open=false}:Props){
  const [expanded,setExpanded]=useState(open)
  const panelId=useId()
  const nodes=Children.toArray(children)
  const summary=nodes.find((node):node is ReactElement<SummaryProps>=>
    isValidElement<SummaryProps>(node)&&node.type==='summary'
  )
  if(!summary)return null
  const content=nodes.filter(node=>node!==summary)
  return <section className={className+' pay-smooth-accordion'} data-expanded={expanded}>
    <button type="button"
      className={(summary.props.className??'pay-collapse-summary')+' pay-accordion-toggle'}
      aria-expanded={expanded} aria-controls={panelId}
      onClick={()=>setExpanded(value=>!value)}>
      {summary.props.children}
    </button>
    <div className="pay-accordion-track">
      <div id={panelId} className="pay-accordion-clip" aria-hidden={!expanded} inert={!expanded}>
        <div className="pay-accordion-content">{content}</div>
      </div>
    </div>
  </section>
}
