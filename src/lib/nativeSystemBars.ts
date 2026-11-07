/** Keep Android's clock/battery and gesture-handle readable over the app.
 * SystemBars is bundled with Capacitor 8; this is a guarded bridge call so
 * the ordinary website does not need Capacitor installed at build time.
 */
type SystemBarsBridge={
  setStyle(args:{style:'DARK'|'LIGHT'}):Promise<void>
}
type CapacitorBridge={
  isNativePlatform?:()=>boolean
  getPlatform?:()=>string
  Plugins?:{SystemBars?:SystemBarsBridge}
}
export function setAndroidSystemBarContrast(
  darkBackground:boolean,
  bridge:CapacitorBridge|null|undefined=
    typeof window==='undefined'?null:
      (window as Window&{Capacitor?:CapacitorBridge}).Capacitor,
):void{
  if(!bridge?.isNativePlatform?.()||bridge.getPlatform?.()!=='android')return
  const bars=bridge.Plugins?.SystemBars
  if(!bars?.setStyle)return
  try{
    // Capacitor's DARK means light glyphs on a dark surface, and vice versa.
    void Promise.resolve(bars.setStyle({style:darkBackground?'DARK':'LIGHT'}))
      .catch(()=>undefined)
  }catch{/* Android may be starting or the plugin may be unavailable. */}
}
