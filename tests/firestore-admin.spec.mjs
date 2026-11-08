import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {createMockUserToken} from '@firebase/util'
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing'
import {collection,doc,setDoc,updateDoc,getDoc,getDocs,getCountFromServer,serverTimestamp} from 'firebase/firestore'
const env=await initializeTestEnvironment({projectId:'demo-paytakt',firestore:{rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8'),host:'127.0.0.1',port:8080}})
try{
  await env.clearFirestore()
  const owner=env.authenticatedContext('owner',{email:'owner@example.com'}).firestore()
  const stranger=env.authenticatedContext('stranger',{email:'stranger@example.com'}).firestore()
  const admin=env.authenticatedContext('admin',{email:'admin@example.com',admin:true}).firestore()
  const anonymous=env.unauthenticatedContext().firestore()
  const profile={email:'owner@example.com',displayName:'Owner',theme:'system',createdAt:serverTimestamp()}
  await assertSucceeds(setDoc(doc(owner,'users/owner'),profile))
  await assertSucceeds(updateDoc(doc(owner,'users/owner'),{lastSeenAt:serverTimestamp(),lastPlatform:'android',lastAppVersion:'0.9.22'}))
  await assertSucceeds(updateDoc(doc(owner,'users/owner'),{theme:'dark'}))
  await assertSucceeds(getDoc(doc(owner,'users/owner')))
  for(const db of [owner,stranger,anonymous]){
    await assertFails(getDocs(collection(db,'users')))
    await assertFails(getCountFromServer(collection(db,'users')))
  }
  await assertSucceeds(getDocs(collection(admin,'users')))
  await assertSucceeds(getCountFromServer(collection(admin,'users')))
  await assertSucceeds(getDoc(doc(admin,'users/owner')))
  await assertFails(getDoc(doc(stranger,'users/owner')))
  await assertFails(updateDoc(doc(owner,'users/owner'),{admin:true}))
  await assertFails(updateDoc(doc(owner,'users/owner'),{createdAt:serverTimestamp()}))
  await assertFails(updateDoc(doc(owner,'users/owner'),{lastSeenAt:new Date('2099-01-01')}))
  await assertFails(updateDoc(doc(owner,'users/owner'),{lastPlatform:'fake',lastSeenAt:serverTimestamp()}))
  await assertFails(updateDoc(doc(stranger,'users/owner'),{lastSeenAt:serverTimestamp()}))
  await assertFails(updateDoc(doc(admin,'users/owner'),{displayName:'Changed'}))
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'workspaces/private'),{ownerUid:'owner',kind:'personal',name:'Private'})
    await setDoc(doc(ctx.firestore(),'workspaces/private/paySettings/current'),{monthlySalary:3100000})
    await setDoc(doc(ctx.firestore(),'workspaces/private/settings/performance'),{enabled:false})
    await setDoc(doc(ctx.firestore(),'workspaces/private/settings/cash'),{enabled:true})
    await setDoc(doc(ctx.firestore(),'workspaces/private/shifts/2026-11-01'),{
      date:'2026-11-01',start:'09:00',end:'17:00',breakMinutes:0,status:'worked',note:'',
    })
    await setDoc(doc(ctx.firestore(),'workspaces/private/dailyWages/2026-11-01'),{amount:250000})
    await setDoc(doc(ctx.firestore(),'workspaces/private/dailyCash/2026-11-01'),{amount:900000})
    await setDoc(doc(ctx.firestore(),'workspaces/private/monthlySales/2026-11'),{amount:900000})
    await setDoc(doc(ctx.firestore(),'workspaces/private/monthlyUnits/2026-11'),{count:5})
    await setDoc(doc(ctx.firestore(),'workspaces/private/monthlyTargets/2026-11'),{amount:1500000})
    await setDoc(doc(ctx.firestore(),'users/legacy'),{email:'legacy@example.com',displayName:'Legacy',theme:'system'})
  })
  // Admin can read individual financial documents and collections, never mutate them.
  await assertSucceeds(getDocs(collection(admin,'workspaces')))
  await assertSucceeds(getCountFromServer(collection(admin,'workspaces')))
  await assertFails(getDocs(collection(stranger,'workspaces')))
  await assertSucceeds(getDoc(doc(admin,'workspaces/private')))
  for(const name of ['paySettings/current','settings/performance','settings/cash',
    'shifts/2026-11-01','dailyWages/2026-11-01','dailyCash/2026-11-01',
    'monthlySales/2026-11','monthlyUnits/2026-11','monthlyTargets/2026-11']){
    await assertSucceeds(getDoc(doc(admin,'workspaces/private/'+name)))
    await assertFails(getDoc(doc(stranger,'workspaces/private/'+name)))
  }
  for(const name of ['shifts','dailyWages','dailyCash','monthlySales','monthlyUnits','monthlyTargets']){
    await assertSucceeds(getDocs(collection(admin,'workspaces/private/'+name)))
    await assertFails(getDocs(collection(stranger,'workspaces/private/'+name)))
  }
  await assertFails(updateDoc(doc(admin,'workspaces/private/paySettings/current'),{monthlySalary:999999}))
  await assertFails(updateDoc(doc(admin,'workspaces/private/shifts/2026-11-01'),{status:'planned'}))
  await assertFails(updateDoc(doc(admin,'workspaces/private/dailyWages/2026-11-01'),{amount:1}))
  await assertSucceeds(updateDoc(doc(owner,'workspaces/private/shifts/2026-11-01'),{status:'planned'}))
  await assertSucceeds(updateDoc(doc(env.authenticatedContext('legacy',{email:'legacy@example.com'}).firestore(),'users/legacy'),{lastSeenAt:serverTimestamp(),lastPlatform:'web',lastAppVersion:'2.0.0-beta.4'}))
  // Run the production REST query builder against the emulator as well as SDK assertions.
  await env.withSecurityRulesDisabled(async ctx=>{
    for(let i=0;i<30;i++)await setDoc(doc(ctx.firestore(),`users/test${String(i).padStart(2,'0')}`),{email:`test${i}@example.com`,displayName:`Test ${i}`,theme:'system',createdAt:new Date()})
  })
  globalThis.__restToken=createMockUserToken({sub:'admin',email:'admin@example.com',admin:true},'demo-paytakt')

  // Verify the actual REST query shape used by AdminPayroll against the emulator.
  const root='http://127.0.0.1:8080/v1/projects/demo-paytakt/databases/(default)/documents'
  const post=async(url,structuredQuery)=>{
    const response=await fetch(url,{method:'POST',headers:{
      Authorization:'Bearer '+globalThis.__restToken,'Content-Type':'application/json',
    },body:JSON.stringify({structuredQuery})})
    if(!response.ok)throw Error('Admin REST query denied: '+response.status+' '+await response.text())
    return response.json()
  }
  const workspaceRows=await post(root+':runQuery',{
    from:[{collectionId:'workspaces'}],
    where:{fieldFilter:{field:{fieldPath:'ownerUid'},op:'EQUAL',value:{stringValue:'owner'}}},
    limit:101,
  })
  if(workspaceRows.filter(row=>row.document).length!==1)
    throw Error('Admin REST workspace owner filter failed')
  const monthlyRows=await post(root+'/workspaces/private:runQuery',{
    from:[{collectionId:'shifts'}],
    orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],
    startAt:{values:[{referenceValue:'projects/demo-paytakt/databases/(default)/documents/workspaces/private/shifts/2026-11-01'}],before:true},
    endAt:{values:[{referenceValue:'projects/demo-paytakt/databases/(default)/documents/workspaces/private/shifts/2026-11-31'}],before:false},
    limit:33,
  })
  if(!monthlyRows.some(row=>row.document?.name?.endsWith('/2026-11-01')))
    throw Error('Admin REST date-range shift query failed')
  const financeResponse=await fetch(root+'/workspaces/private/paySettings/current',{
    headers:{Authorization:'Bearer '+globalThis.__restToken},
  })
  if(!financeResponse.ok)throw Error('Admin REST financial get denied: '+financeResponse.status)
  console.log('Admin REST: workspace ownership filter, month cursor and read-only financial GET passed')

  const source=readFileSync(new URL('../src/lib/adminStats.ts',import.meta.url),'utf8')
    .replace("import {auth, firebaseApp} from './firebase'",`const auth={currentUser:{getIdTokenResult:async()=>({claims:{admin:true},token:globalThis.__restToken})}};const firebaseApp={options:{projectId:'demo-paytakt'}}`)
    .replace('https://firestore.googleapis.com','http://127.0.0.1:8080')
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  const {loadAdminStats,loadAdminUsers}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
  const stats=await loadAdminStats()
  if(stats.total!==32||stats.active1!==2||stats.days.at(-1).count!==31)throw Error('REST counts mismatch: '+JSON.stringify(stats))
  const first=await loadAdminUsers(),second=await loadAdminUsers(first.next)
  if(first.users.length!==25||second.users.length!==7||new Set([...first.users,...second.users].map(u=>u.uid)).size!==32)throw Error('REST pagination mismatch')
  const found=await loadAdminUsers(undefined,'test12@example.com')
  if(found.users.length!==1||found.users[0].uid!=='test12')throw Error('REST email search mismatch')
  globalThis.__restToken=createMockUserToken({sub:'stranger',email:'stranger@example.com'},'demo-paytakt')
  let denied=false
  try{await loadAdminUsers()}catch{denied=true}
  if(!denied)throw Error('REST must enforce Security Rules')
  delete globalThis.__restToken
  console.log('Production REST: aggregate counts, seven day buckets, pagination, email search, server authorization passed')
  console.log('Admin Rules: role boundaries, aggregates, activity timestamps, legacy profiles passed')
}finally{await env.cleanup()}
