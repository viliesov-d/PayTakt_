import {doc,serverTimestamp,updateDoc} from 'firebase/firestore'
import {auth,db} from './firebase'
import {nativePlatform} from './nativePlatform'
import mobile from '../../mobile-version.json' with {type:'json'}
import ios from '../../ios-version.json'
import pkg from '../../package.json'

export function trackUserActivity(uid:string):()=>void{
  let stopped=false,pending=false,lastAttempt=0
  const record=async()=>{
    if(stopped||pending||!db||auth?.currentUser?.uid!==uid||document.visibilityState!=='visible'||!navigator.onLine||Date.now()-lastAttempt<300000)return
    pending=true;lastAttempt=Date.now()
    const platform=nativePlatform()
    try{await updateDoc(doc(db,'users',uid),{lastSeenAt:serverTimestamp(),lastPlatform:platform,lastAppVersion:platform==='android'?mobile.version:platform==='ios'?ios.version:pkg.version})}
    catch{/* Telemetry must never block salary data or login; retry at the next interval. */}
    finally{pending=false}
  }
  void record()
  const timer=window.setInterval(()=>void record(),300000)
  const resume=()=>void record()
  document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume)
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume)}
}
