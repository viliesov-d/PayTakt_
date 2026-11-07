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
  x:number,y:number,width:number,height:number,radius:number,bezel=22,softEdge=false,displacementScale=0,
):{x:number;y:number}{
  if(width<=0||height<=0||bezel<=0)return {x:0,y:0}
  const dist=roundedRectDistance(x,y,width,height,radius)
  if(dist>=(softEdge?0:1)||dist<=-bezel)return {x:0,y:0}
  const delta=0.8
  const gx=roundedRectDistance(x+delta,y,width,height,radius)-
    roundedRectDistance(x-delta,y,width,height,radius)
  const gy=roundedRectDistance(x,y+delta,width,height,radius)-
    roundedRectDistance(x,y-delta,width,height,radius)
  const length=Math.hypot(gx,gy)
  if(length<1e-5)return {x:0,y:0}
  const near=clamp(1+dist/bezel,0,1)
  // A dock lens has no displacement at its silhouette, avoiding a hard refractive rim.
  let intensity=softEdge
    ? Math.sin(Math.PI*clamp(-dist/bezel,0,1))**2
    : near*near*(3-2*near) // smoothstep: no hard inner ring
  if(softEdge&&displacementScale>0){
    // Bound the actual SVG sample offset to 75% of the distance to the silhouette.
    // tanh avoids a hard kink/ring when a stronger lens meets the edge constraint.
    const limit=(-dist*.75)/(displacementScale*117/255)
    intensity=limit*Math.tanh(intensity/limit)
  }
  return {x:gx/length*intensity,y:gy/length*intensity}
}

/** Dock-only folded sampling near the inner rim.
 * The first narrow band briefly samples further INTO the panel, then returns
 * to the normal outward convex-lens profile. The sign reversal produces a
 * small mirror-like echo of moving content without taking pixels from outside
 * the rounded silhouette (which would create a pale halo).
 * All values remain normalized for the existing feDisplacementMap.
 */
export function glassReflectiveRimVector(
  x:number,y:number,width:number,height:number,radius:number,bezel:number,displacementScale:number,
):{x:number;y:number}{
  const baseline=glassEdgeVector(x,y,width,height,radius,bezel,true,displacementScale)
  const dist=roundedRectDistance(x,y,width,height,radius)
  if(dist>=0||dist<=-bezel||displacementScale<=0)return baseline
  const depth=-dist
  const delta=0.8
  const gx=roundedRectDistance(x+delta,y,width,height,radius)-
    roundedRectDistance(x-delta,y,width,height,radius)
  const gy=roundedRectDistance(x,y+delta,width,height,radius)-
    roundedRectDistance(x,y-delta,width,height,radius)
  const length=Math.hypot(gx,gy)
  if(length<1e-5)return baseline
  const nx=gx/length,ny=gy/length
  const pxPerUnit=displacementScale*117/255
  const outward=(baseline.x*nx+baseline.y*ny)*pxPerUnit
  const stripWidth=Math.min(11,bezel*.46)
  const strip=depth<stripWidth ? Math.sin(Math.PI*depth/stripWidth)**2 : 0
  // A folded backdrop sample reverses direction only inside this narrow
  // internal-reflection strip; beyond it the ordinary lens grows stronger.
  const echoed=Math.min(9,pxPerUnit*.83)*strip
  const desired=outward*1.2*(1-.88*strip)-echoed
  // Never sample beyond the silhouette. This also protects rounded corners.
  const offset=Math.max(-Math.min(9,pxPerUnit*.95),Math.min(depth*.72,desired))
  const amplitude=Math.max(-1,Math.min(1,offset/pxPerUnit))
  return {x:nx*amplitude,y:ny*amplitude}
}

export type GlassMap={width:number;height:number;dataUrl:string}

/** A small bounded map is stretched over the CSS-sized lens; scales on phones. */
export function makeGlassDisplacementMap(
  width:number,height:number,radius:number,
  createCanvas:()=>HTMLCanvasElement=()=>document.createElement('canvas'),
  softEdge=false,displacementScale=0,reflectiveRim=false,
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
  const bezel=softEdge
    ? Math.min(26,Math.max(12,Math.min(width,height)*0.32))
    : Math.min(23,Math.max(12,Math.min(width,height)*0.22))
  for(let py=0;py<h;py++){
    for(let px=0;px<w;px++){
      const sx=(px+.5)*width/w,sy=(py+.5)*height/h
      const {x,y}=reflectiveRim&&softEdge
        ? glassReflectiveRimVector(sx,sy,width,height,radius,bezel,displacementScale)
        : glassEdgeVector(sx,sy,width,height,radius,bezel,softEdge,displacementScale)
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
