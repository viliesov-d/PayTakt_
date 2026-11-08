import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

// Load pure REST decoder + aggregate path without any Firebase credentials.
const source=readFileSync(new URL('../src/lib/adminPayroll.ts',import.meta.url),'utf8').replace(/^import .*$/gm,'')
const fixture={admin:true,calls:[]}
globalThis.__adminPayrollFixture=fixture
const injected="const auth={currentUser:{getIdTokenResult:async()=>({claims:{admin:globalThis.__adminPayrollFixture.admin},token:'test-token'})}};const firebaseApp={options:{projectId:'demo-paytakt'}};"
const js=ts.transpileModule(injected+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {loadAdminOverview,loadAdminMonthlyUsers,decodeFirestoreValue,decodeFirestoreFields,formatAdminMoney}=
  await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const actualFetch=globalThis.fetch

test('Firestore REST decoder preserves arrays, timestamps and integer money',()=>{
  const value=decodeFirestoreFields({
    amount:{integerValue:'3100000'},enabled:{booleanValue:true},
    object:{mapValue:{fields:{count:{integerValue:'5'}}}},
    tiers:{arrayValue:{values:[{mapValue:{fields:{id:{stringValue:'goal'}}}}]}},
  })
  assert.deepEqual(value,{amount:3100000,enabled:true,object:{count:5},tiers:[{id:'goal'}]})
  assert.equal(decodeFirestoreValue({nullValue:null}),null)
  assert.match(formatAdminMoney(125000,'UAH'),/1.*250/)
  assert.match(formatAdminMoney(125000,'USD'),/USD|US\$|\$/)
  assert.equal(formatAdminMoney(NaN,'UAH'),'—')
})
test('Overview counts use restricted server aggregates, not cached client scans',async()=>{
  globalThis.fetch=async(url,options)=>{
    fixture.calls.push({url,options})
    const coll=JSON.parse(options.body).structuredAggregationQuery.structuredQuery.from[0].collectionId
    return {ok:true,status:200,json:async()=>[{result:{aggregateFields:{total:{integerValue:coll==='users'?'12':'4'}}}}]}
  }
  try{
    const overview=await loadAdminOverview()
    assert.deepEqual(overview,{users:12,workspaces:4})
    assert.equal(fixture.calls.length,2)
    for(const call of fixture.calls){
      assert.equal(call.options.cache,'no-store')
      assert.equal(call.options.method,'POST')
      assert.match(call.url,/:runAggregationQuery$/)
    }
    fixture.admin=false;fixture.calls=[]
    await assert.rejects(loadAdminOverview(),/лише для адміністратора/)
    assert.equal(fixture.calls.length,0)
  }finally{globalThis.fetch=actualFetch;fixture.admin=true}
})
test('Monthly lookup filters workspaces by actual owner without writing or inventing pay',async()=>{
  fixture.calls=[]
  globalThis.fetch=async(url,options)=>{
    fixture.calls.push({url,options})
    return {ok:true,status:200,json:async()=>[]}
  }
  try{
    const rows=[]
    await loadAdminMonthlyUsers([{uid:'user-1'}],'2026-11',row=>rows.push(row))
    assert.equal(rows.length,1)
    assert.equal(rows[0].uid,'user-1')
    assert.equal(rows[0].shifts,0)
    assert.equal(rows[0].workspaces.length,0)
    assert.deepEqual(rows[0].byCurrency,{})
    assert.equal(rows[0].incomplete,false)
    assert.equal(fixture.calls.length,1)
    const call=fixture.calls[0]
    assert.equal(call.options.method,'POST')
    assert.equal(call.options.cache,'no-store')
    assert.deepEqual(JSON.parse(call.options.body).structuredQuery.where.fieldFilter,
      {field:{fieldPath:'ownerUid'},op:'EQUAL',value:{stringValue:'user-1'}})
    assert.doesNotMatch(source,/method:\s*['"](PUT|PATCH|DELETE)['"]/)
  }finally{globalThis.fetch=actualFetch;delete globalThis.__adminPayrollFixture}
})
