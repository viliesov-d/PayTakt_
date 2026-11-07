import {nativePlatform} from './nativePlatform'

type InstallPrompt=Event&{
  prompt:()=>Promise<void>
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>
}

export type InstallState='ready'|'manual'|'installed'
const listeners=new Set<()=>void>()
let pendingPrompt:InstallPrompt|null=null
let initialized=false

function standalone():boolean{
  return typeof window!=='undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator&{standalone?:boolean}).standalone===true
  )
}
export function getInstallState():InstallState{
  return standalone()?'installed':pendingPrompt?'ready':'manual'
}
export function watchInstallState(listener:()=>void):()=>void{
  listeners.add(listener)
  return ()=>{listeners.delete(listener)}
}
function announce():void{listeners.forEach(fn=>fn())}

/** Must run before React mounts so the browser install event is not missed. */
export function initWebPwa():void{
  if(initialized||typeof window==='undefined'||nativePlatform()!=='web')return
  initialized=true
  window.addEventListener('beforeinstallprompt',(event:Event)=>{
    event.preventDefault()
    pendingPrompt=event as InstallPrompt
    announce()
  })
  window.addEventListener('appinstalled',()=>{
    pendingPrompt=null
    announce()
  })
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change',announce)

  // Capacitor packages must never register the website service worker.
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return
  const register=()=>{
    const swUrl=new URL(import.meta.env.BASE_URL+'sw.js',window.location.href)
    void navigator.serviceWorker.register(swUrl.href,{updateViaCache:'none'})
      .then(reg=>{void reg.update().catch(()=>undefined)})
      .catch(()=>undefined) // Unsupported/private browser modes still work online.
  }
  if(document.readyState==='complete')register()
  else window.addEventListener('load',register,{once:true})
}

/** Only a direct tap can launch the browser-controlled install prompt. */
export async function requestWebInstall():Promise<'accepted'|'dismissed'|'unavailable'>{
  const prompt=pendingPrompt
  if(!prompt)return 'unavailable'
  pendingPrompt=null
  announce()
  try{
    await prompt.prompt()
    const result=await prompt.userChoice
    return result.outcome
  }catch{return 'unavailable'}
}
