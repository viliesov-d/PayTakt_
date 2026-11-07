type Bridge={isNativePlatform?:()=>boolean;getPlatform?:()=>string}
export function nativePlatform(bridge:Bridge|undefined=
  typeof window==='undefined'?undefined:(window as Window&{Capacitor?:Bridge}).Capacitor,
):'android'|'ios'|'web'{
  if(!bridge?.isNativePlatform?.())return 'web'
  const platform=bridge.getPlatform?.()
  return platform==='android'||platform==='ios'?platform:'web'
}
