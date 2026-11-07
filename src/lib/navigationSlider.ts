/** Continuous index based on actual tab centers, clamped during captured drags. */
export function navigationPosition(x:number,firstCenter:number,lastCenter:number,count:number):number{
  if(count<=1||lastCenter<=firstCenter)return 0
  return Math.max(0,Math.min(count-1,(x-firstCenter)/(lastCenter-firstCenter)*(count-1)))
}
export function navigationKeyIndex(key:string,index:number,count:number):number|null{
  if(count<1)return null
  if(key==='Home')return 0
  if(key==='End')return count-1
  if(key==='ArrowRight')return Math.min(count-1,index+1)
  if(key==='ArrowLeft')return Math.max(0,index-1)
  return null
}
