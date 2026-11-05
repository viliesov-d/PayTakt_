/** Conflict-aware Firestore replay. Transactions read the current server
 * value before writing; no queued change silently overwrites a remote edit.
 */
import {doc,runTransaction,serverTimestamp} from 'firebase/firestore'
import {auth,db} from './firebase.ts'
import {comparableShift,dayPayload,decodeShift} from './data.ts'
import {
 readOfflineQueue,replaceOfflineEntry,finalizeOfflineEdit,type OfflineEdit,
 type OfflineValue,
} from './offlineQueue.ts'
import type {Shift} from './calendar.ts'

function matches(kind:OfflineEdit['kind'],a:OfflineValue,b:OfflineValue):boolean{
  if(kind==='shifts')return comparableShift(a as Shift|null)===comparableShift(b as Shift|null)
  return a===b
}
function documentValue(edit:OfflineEdit,data:Record<string,unknown>|null):OfflineValue{
  if(!data)return null
  if(edit.kind==='shifts')return decodeShift(edit.date,data)
  const amount=data.amount
  if(typeof amount!=='number'||!Number.isSafeInteger(amount)||amount<0)
    throw Error('Некоректна сума на сервері. Потрібна ручна перевірка.')
  return amount
}
type Result={state:'saved'}|{state:'conflict';server:OfflineValue}
async function syncOne(uid:string,edit:OfflineEdit):Promise<Result>{
  if(!db||!auth?.currentUser||auth.currentUser.uid!==uid)
    throw Error('Сесія змінилася. Увійди під тим самим акаунтом.')
  const firestore=db
  const ref=doc(firestore,'workspaces',edit.workspaceId,edit.kind,edit.date)
  return runTransaction(firestore,async tx=>{
    const snap=await tx.get(ref)
    const server=documentValue(edit,snap.exists()?snap.data():null)
    // If a previous commit succeeded but the app closed before clearing
    // localStorage, replay is idempotent.
    if(matches(edit.kind,server,edit.next))return {state:'saved'} as const
    if(!matches(edit.kind,server,edit.before))
      return {state:'conflict',server} as const
    if(edit.next===null)tx.delete(ref)
    else if(edit.kind==='shifts')tx.set(ref,dayPayload(edit.next as Shift))
    else tx.set(ref,{amount:edit.next,updatedAt:serverTimestamp()})
    return {state:'saved'} as const
  })
}
export async function flushOfflineQueue(uid:string,onChange?:()=>void):Promise<void>{
  if(!uid||!db||!auth?.currentUser||auth.currentUser.uid!==uid)return
  if(typeof navigator!=='undefined'&&!navigator.onLine)return
  const pending=readOfflineQueue(uid).filter(e=>e.state==='pending')
  for(const edit of pending){
    // A second UI action can supersede one queued operation while awaiting a
    // transaction. The reconciliation in finalizeOfflineEdit preserves it.
    try {
      const result=await syncOne(uid,edit)
      if(result.state==='saved')finalizeOfflineEdit(uid,edit)
      else replaceOfflineEntry(uid,edit.id,edit.revision,item=>({
        ...item,state:'conflict',server:result.server,
        error:'Цей запис змінився на іншому пристрої. Обери, яку версію залишити.',
      }))
    }catch(error){
      const message=error instanceof Error?error.message:'Не вдалося синхронізувати запис.'
      // Keep the durable payload even when network or permissions fail.
      replaceOfflineEntry(uid,edit.id,edit.revision,item=>({
        ...item,state:'error',error:message,
      }))
    }
    onChange?.()
    if(typeof navigator!=='undefined'&&!navigator.onLine)break
    if(auth?.currentUser?.uid!==uid)break
  }
}
