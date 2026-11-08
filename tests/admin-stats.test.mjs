import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
// Exercise the real REST query builder with a deterministic authenticated transport.
const fixture={admin:true,calls:[],reply:[]}
globalThis.__adminFixture=fixture
const source=readFileSync(new URL('../src/lib/adminStats.ts',import.meta.url),'utf8').replace("import {auth, firebaseApp} from './firebase'",`const auth={currentUser:{getIdTokenResult:async(force)=>{if(!force)throw Error('Token must refresh');return {claims:{admin:globalThis.__adminFixture.admin},token:'test-token'}}}};const firebaseApp={options:{projectId:'demo-paytakt'}}`)
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {loadAdminStats,loadAdminUsers}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const realFetch=globalThis.fetch
test('admin REST statistics and paging',async t=>{
  globalThis.fetch=async(url,options)=>{fixture.calls.push({url,options,body:JSON.parse(options.body)});return {ok:true,json:async()=>fixture.reply}}
  try{
    await t.test('denies missing admin claim before any data request',async()=>{
      fixture.admin=false;fixture.calls=[];await assert.rejects(loadAdminUsers(),/лише для адміністратора/);assert.equal(fixture.calls.length,0);fixture.admin=true
    })
    await t.test('paginates at 25 without losing the 26th record and supports missing timestamps',async()=>{
      fixture.reply=Array.from({length:26},(_,i)=>({document:{name:`projects/demo-paytakt/databases/(default)/documents/users/u${String(i).padStart(2,'0')}`,fields:{displayName:{stringValue:'Name'},email:{stringValue:'a@example.com'}}}}))
      const page=await loadAdminUsers();assert.equal(page.users.length,25);assert.equal(page.next,'u24');assert.equal(page.users[0].createdAt,null)
      await loadAdminUsers(page.next)
      const call=fixture.calls.at(-1);assert.equal(call.body.structuredQuery.startAt.before,false);assert.match(call.body.structuredQuery.startAt.values[0].referenceValue,/users\/u24$/);assert.equal(call.options.cache,'no-store')
    })
    await t.test('search applies an exact server-side email filter',async()=>{
      fixture.reply=[];const page=await loadAdminUsers(undefined,' person@example.com ')
      assert.equal(page.users.length,0);assert.equal(page.next,undefined)
      assert.deepEqual(fixture.calls.at(-1).body.structuredQuery.where.fieldFilter,{field:{fieldPath:'email'},op:'EQUAL',value:{stringValue:'person@example.com'}})
    })
    await t.test('aggregates are numeric and include seven independent date buckets',async()=>{
      fixture.calls=[];fixture.reply=[{result:{aggregateFields:{total:{integerValue:'12'}}}}]
      const stats=await loadAdminStats();assert.equal(stats.total,12);assert.equal(stats.active30,12);assert.equal(stats.days.length,7);assert.equal(fixture.calls.length,16)
      for(const call of fixture.calls)assert.match(call.url,/:runAggregationQuery$/)
      const days=fixture.calls.map(c=>c.body.structuredAggregationQuery.structuredQuery.where).filter(w=>w?.compositeFilter)
      for(let i=1;i<days.length;i++)assert.equal(days[i-1].compositeFilter.filters[1].fieldFilter.value.timestampValue,days[i].compositeFilter.filters[0].fieldFilter.value.timestampValue)
    })
    await t.test('server denial and missing aggregate never become a misleading zero',async()=>{
      fixture.reply=[];await assert.rejects(loadAdminStats(),/не повернув/)
      globalThis.fetch=async()=>({ok:false,status:403});await assert.rejects(loadAdminUsers(),/Немає доступу/)
    })
  }finally{globalThis.fetch=realFetch;delete globalThis.__adminFixture}
})
