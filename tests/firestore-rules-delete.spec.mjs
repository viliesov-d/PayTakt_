// Run only against the local Firestore emulator:
// npx firebase-tools emulators:exec --only firestore 'node tests/firestore-rules-delete.spec.mjs'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing'
import {doc,setDoc,deleteDoc,updateDoc,writeBatch,getDoc} from 'firebase/firestore'

const env=await initializeTestEnvironment({
  projectId:'demo-paytakt',
  firestore:{rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8'),host:'127.0.0.1',port:8080},
})

try{
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore()
    await setDoc(doc(db,'users','alice'),{email:'alice@test.example',displayName:'Alice',theme:'light'})
    await setDoc(doc(db,'workspaces','w1'),{name:'Workspace',kind:'personal',ownerUid:'alice',createdAt:new Date()})
    await setDoc(doc(db,'users','alice','workspaces','w1'),{name:'Workspace',kind:'personal',role:'owner',createdAt:new Date()})
    await setDoc(doc(db,'workspaces','w1','dailyCash','2026-11-05'),{amount:50000})
    await setDoc(doc(db,'workspaces','w1','paySettings','current'),{version:5})
    await setDoc(doc(db,'workspaces','w1','settings','cash'),{enabled:true,useForSales:false})
    await setDoc(doc(db,'workspaces','other'),{name:'Other',kind:'personal',ownerUid:'bob',createdAt:new Date()})
  })

  const alice=env.authenticatedContext('alice')
  const bob=env.authenticatedContext('bob')
  const aliceDb=alice.firestore()
  const root=doc(aliceDb,'workspaces','w1')
  const membership=doc(aliceDb,'users','alice','workspaces','w1')
  const cash=doc(aliceDb,'workspaces','w1','dailyCash','2026-11-05')
  const pay=doc(aliceDb,'workspaces','w1','paySettings','current')
  const settings=doc(aliceDb,'workspaces','w1','settings','cash')

  // Neither a stranger nor even the owner can bypass the deletion handshake.
  await assertFails(deleteDoc(doc(bob.firestore(),'workspaces','w1')))
  await assertFails(deleteDoc(root))
  await assertFails(deleteDoc(membership))
  await assertSucceeds(updateDoc(root,{deleting:true}))
  // A deleting workspace cannot accept any new writes or modified payroll.
  await assertFails(setDoc(doc(aliceDb,'workspaces','w1','dailyCash','2026-11-06'),{amount:100}))
  await assertFails(setDoc(pay,{version:5,monthlySalary:100}))
  // But the legitimate owner can delete every supported record.
  await assertSucceeds(deleteDoc(cash))
  await assertSucceeds(deleteDoc(pay))
  await assertSucceeds(deleteDoc(settings))
  await assertFails(deleteDoc(membership)) // must be bundled with parent deletion
  const batch=writeBatch(aliceDb)
  batch.delete(membership)
  batch.delete(root)
  await assertSucceeds(batch.commit())
  await env.withSecurityRulesDisabled(async context=>{
    assert.equal((await getDoc(doc(context.firestore(),'workspaces','w1'))).exists(),false)
    assert.equal((await getDoc(doc(context.firestore(),'users','alice','workspaces','w1'))).exists(),false)
    assert.equal((await getDoc(doc(context.firestore(),'workspaces','other'))).exists(),true)
  })
  console.log('Workspace deletion rules: owner-only, writes locked, final atomic cleanup OK')
}finally{
  await env.cleanup()
}
