import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enqueueOffline,readOfflineQueue,replaceOfflineEntry,finalizeOfflineEdit,
  overlayShifts,overlayWages,overlayAmounts,offlineSummary,
  discardOffline,acceptOverwrite,retryOfflineErrors,
} from '../src/lib/offlineQueue.ts'

function withStorage(fn){
  const original=globalThis.localStorage
  const store=new Map()
  globalThis.localStorage={
    getItem:k=>store.get(k)??null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k),
  }
  try{return fn(store)}finally{
    if(original===undefined)delete globalThis.localStorage
    else globalThis.localStorage=original
  }
}
const shift=(date,status='planned')=>({
  id:date,date,start:'09:00',end:'18:00',breakMinutes:60,
  status,note:'',dayType:'work',kind:'regular',
  additionalShifts:[],overtimeMinutes:0,plannedWorkday:true,plannedMinutes:480,
})

test('offline edits are durable and scoped to signed-in UID and workspace',()=>withStorage(()=>{
  const data=enqueueOffline('user-1','work-1','shifts','2026-11-05',null,shift('2026-11-05'))
  assert.equal(data.length,1)
  assert.equal(readOfflineQueue('user-1').length,1)
  assert.equal(readOfflineQueue('user-2').length,0)
  assert.equal(overlayShifts([],data,'work-1')[0].status,'planned')
  assert.deepEqual(overlayShifts([],data,'work-2'),[])
  assert.equal(offlineSummary(data).pending,1)
}))

test('editing a queued day preserves original server version for conflict checking',()=>withStorage(()=>{
  const before=shift('2026-11-05')
  enqueueOffline('u','w','shifts',before.date,before,{...before,status:'worked'})
  const list=enqueueOffline('u','w','shifts',before.date,{...before,status:'worked'},{...before,status:'planned',note:'new note'})
  assert.equal(list.length,1)
  assert.deepEqual(list[0].before,before)
  assert.equal(list[0].next.note,'new note')
  assert.equal(list[0].revision,2)
}))

test('while a write syncs, completing it cannot erase a newer local version',()=>withStorage(()=>{
  let items=enqueueOffline('u','w','dailyWages','2026-11-05',100,150)
  const first=items[0]
  items=enqueueOffline('u','w','dailyWages','2026-11-05',100,200)
  items=finalizeOfflineEdit('u',first)
  assert.equal(items.length,1)
  assert.equal(items[0].before,150)
  assert.equal(items[0].next,200)
  assert.equal(items[0].state,'pending')
}))

test('cash and wages overlay with durable deletions and never touch another workspace',()=>withStorage(()=>{
  let items=enqueueOffline('u','a','dailyCash','2026-11-05',100,null)
  items=enqueueOffline('u','a','dailyWages','2026-11-05',null,450)
  assert.deepEqual(overlayAmounts([{date:'2026-11-05',amount:100}],items,'a','dailyCash'),[])
  assert.deepEqual(overlayWages({},items,'a'),{'2026-11-05':450})
  assert.deepEqual(overlayWages({},items,'b'),{})
}))

test('remote conflict requires explicit resolution or discard',()=>withStorage(()=>{
  let items=enqueueOffline('u','a','dailyWages','2026-11-05',100,200)
  items=replaceOfflineEntry('u',items[0].id,items[0].revision,e=>({...e,state:'conflict',server:300,error:'changed'}))
  assert.equal(offlineSummary(items).conflicts,1)
  items=acceptOverwrite('u',items[0].id)
  assert.equal(items[0].before,300)
  assert.equal(items[0].next,200)
  assert.equal(items[0].state,'pending')
  items=discardOffline('u',items[0].id)
  assert.equal(items.length,0)
}))

test('storage failure never falsely reports an offline save',()=>withStorage(()=>{
  globalThis.localStorage.setItem=()=>{throw Error('QuotaExceededError')}
  assert.throws(()=>enqueueOffline('u','w','dailyWages','2026-11-05',null,1),/Запис не збережено/)
}))

test('failed writes can be retried without losing their original baseline',()=>withStorage(()=>{
  let items=enqueueOffline('u','w','dailyCash','2026-11-05',500,600)
  items=replaceOfflineEntry('u',items[0].id,items[0].revision,e=>({...e,state:'error',error:'network'}))
  items=retryOfflineErrors('u')
  assert.equal(items[0].state,'pending')
  assert.equal(items[0].before,500)
  assert.equal(items[0].next,600)
}))
