import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {kyivToday,parseNbuResponse,refreshNbuRates,readNbuRates,nbuRate,rateCacheIsCurrent} from '../src/lib/nbuRates.ts'

const payload=()=>[
  {cc:'USD',rate:42.50,exchangedate:'05.11.2026'},
  {cc:'EUR',rate:49.10,exchangedate:'05.11.2026'},
  {cc:'PLN',rate:11.55,exchangedate:'05.11.2026'},
  {cc:'GBP',rate:56.30,exchangedate:'05.11.2026'},
]

test('NBU response parsing rejects missing, invalid or hostile rates',()=>{
  const parsed=parseNbuResponse(payload(),'2026-11-05')
  assert.equal(parsed.rates.USD,42.50)
  assert.equal(parsed.exchangeDate,'05.11.2026')
  assert.equal(nbuRate(parsed,'PLN'),11.55)
  assert.equal(nbuRate(parsed,'UAH'),1)
  assert.equal(nbuRate(parsed,'AUD'),null)
  assert.throws(()=>parseNbuResponse(payload().slice(1),'2026-11-05'),/курси/)
  assert.throws(()=>parseNbuResponse([...payload().slice(1),{cc:'USD',rate:-45,exchangedate:'05.11.2026'}],'2026-11-05'),/курси/)
})

test('Kyiv calendar date is independent from viewer timezone',()=>{
  assert.equal(kyivToday(new Date('2026-11-04T23:30:00Z')),'2026-11-05')
  assert.equal(kyivToday(new Date('2026-07-04T21:30:00Z')),'2026-07-05')
})

test('official API is fetched at most once per Kyiv day and cached for offline reuse',async()=>{
  const previous=globalThis.localStorage
  const map=new Map()
  globalThis.localStorage={
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key),
  }
  let calls=0
  const fakeFetch=async()=>{calls++;return {ok:true,json:async()=>payload()}}
  try{
    const day=new Date('2026-11-05T12:00:00Z')
    const first=await refreshNbuRates({force:true,fetcher:fakeFetch,now:day})
    assert.equal(calls,1)
    assert.equal(first.rates.GBP,56.30)
    assert.deepEqual(readNbuRates(),first)
    assert.equal(rateCacheIsCurrent(first,day),true)
    const cached=await refreshNbuRates({fetcher:fakeFetch,now:day})
    assert.deepEqual(cached,first)
    assert.equal(calls,1)
    assert.equal(rateCacheIsCurrent(cached,new Date('2026-11-06T12:00:00Z')),false)
  }finally{
    if(previous===undefined)delete globalThis.localStorage
    else globalThis.localStorage=previous
  }
})

test('workspace deletion targets server data in all known PayTakt subcollections',()=>{
  const data=readFileSync(new URL('../src/lib/data.ts',import.meta.url),'utf8')
  const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')
  for(const name of ['shifts','scheduleTemplates','dailyCash','dailyWages','monthlyTargets','monthlySales','monthlyUnits']){
    assert.ok(data.includes("'"+name+"'"),name)
  }
  for(const name of ['overtime','cash','performance','current'])assert.ok(data.includes("'"+name+"'"),name)
  assert.match(data,/getDocsFromServer/)
  assert.match(data,/getDocFromServer/)
  assert.match(data,/updateDoc\(root,\{deleting:true\}\)/)
  assert.match(rules,/function activeWorkspace\(workspaceId\)/)
  assert.match(rules,/!existsAfter\(/)
})
