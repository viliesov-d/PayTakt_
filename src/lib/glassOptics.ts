/** Rounded-rectangle displacement map for a refractive glass edge.
 * R/G encode X/Y vector offsets around neutral 128; sampled by SVG feDisplacementMap.
 * Pure math is shared with tests. No network, DOM capture or user-data access. */
export function roundedRectDistance(
  x:number,y:number,width:number,height:number,radius:number,
):number{
  const r=Math.max(0,Math.min(radius,width/2,height/2))
  const dx=Math.abs(x-width/2)-(width/2-r)
  const dy=Math.abs(y-height/2)-(height/2-r)
  return Math.hypot(Math.max(dx,0),Math.max(dy,0)) + Math.min(Math.max(dx,dy),0)-r
}

const clamp=(n:number,low:number,high:number)=>Math.min(high,Math.max(low,n))

/** Sample a convex-lens normal near the rounded rim; the center stays optically clear.
 * Output is normalized to +/-1 so a CSS/ SVG pixel scale controls strength.
 */
export function glassEdgeVector(
  x:number,y:number,width:number,height:number,radius:number,bezel=22,
):{x:number;y:number}{
  if(width<=0||height<=0||bezel<=0)return {x:0,y:0}
  const dist=roundedRectDistance(x,y,width,height,radius)
  if(dist>=1||dist<=-bezel)return {x:0,y:0}
  const delta=0.8
  const gx=roundedRectDistance(x+delta,y,width,height,radius)-
    roundedRectDistance(x-delta,y,width,height,radius)
  const gy=roundedRectDistance(x,y+delta,width,height,radius)-
    roundedRectDistance(x,y-delta,width,height,radius)
  const length=Math.hypot(gx,gy)
  if(length<1e-5)return {x:0,y:0}
  const near=clamp(1+dist/bezel,0,1)
  const intensity=near*near*(3-2*near) // smoothstep: no hard inner ring
  return {x:gx/length*intensity,y:gy/length*intensity}
}

export type GlassMap={width:number;height:number;dataUrl:string}

/** A small bounded map is stretched over the CSS-sized lens; scales on phones. */
export function makeGlassDisplacementMap(
  width:number,height:number,radius:number,
  createCanvas:()=>HTMLCanvasElement=()=>document.createElement('canvas'),
):GlassMap|null{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<15||height<15)return null
  const ratio=Math.min(1,Math.sqrt(125000/(width*height)))
  const w=Math.max(16,Math.round(width*ratio))
  const h=Math.max(16,Math.round(height*ratio))
  const canvas=createCanvas()
  canvas.width=w
  canvas.height=h
  const ctx=canvas.getContext('2d',{willReadFrequently:true})
  if(!ctx)return null
  const pixels=ctx.createImageData(w,h)
  const data=pixels.data
  const bezel=Math.min(23,Math.max(12,Math.min(width,height)*0.22))
  for(let py=0;py<h;py++){
    for(let px=0;px<w;px++){
      const {x,y}=glassEdgeVector(
        (px+.5)*width/w,(py+.5)*height/h,width,height,radius,bezel,
      )
      const idx=(py*w+px)*4
      data[idx]=Math.round(clamp(128+x*117,0,255))
      data[idx+1]=Math.round(clamp(128+y*117,0,255))
      data[idx+2]=128
      data[idx+3]=255
    }
  }
  ctx.putImageData(pixels,0,0)
  return {width,height,dataUrl:canvas.toDataURL('image/png')}
}
