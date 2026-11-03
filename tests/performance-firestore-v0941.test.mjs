import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {defaultPerformanceSettings,parsePerformanceSettings,validatePerformanceSettings} from '../src/lib/performance.ts'

const document = {
  version: 1,
  enabled: true,
  manualDailyPay: true,
  metric: 'cash',
  defaultTarget: 25000000,
  tiers: [{id:'goal100',thresholdBasisPoints:10000,bonus:200000}],
  updatedAt: {seconds: 1, nanoseconds: 0},
}

test('saved Firestore performance document round-trips every required field',()=>{
  const result = parsePerformanceSettings(document)
  assert.deepEqual(result,{
    version: 1,
    enabled: true,
    manualDailyPay: true,
    metric: 'cash',
    defaultTarget: 25000000,
    tiers: [{id:'goal100',thresholdBasisPoints:10000,bonus:200000}],
  })
  assert.doesNotThrow(()=>validatePerformanceSettings(result))
})

test('false manualDailyPay stays false after reading and required goal fields preserved',()=>{
  const result = parsePerformanceSettings({...document,manualDailyPay:false,metric:'units',defaultTarget:30})
  assert.equal(result.manualDailyPay,false)
  assert.equal(result.metric,'units')
  assert.equal(result.defaultTarget,30)
})

test('older performance docs without manualDailyPay default to disabled manual pay',()=>{
  const {manualDailyPay:unused,...older} = document
  assert.equal(parsePerformanceSettings(older).manualDailyPay,false)
})

test('explicit malformed manualDailyPay is not silently coerced',()=>{
  assert.throws(()=>parsePerformanceSettings({...document,manualDailyPay:'true'}),/План і премії/)
  assert.throws(()=>parsePerformanceSettings({...document,tiers:[]}),/План і премії/)
})

test('new documents and Zmina preset use supported backend field',()=>{
  assert.equal(defaultPerformanceSettings.manualDailyPay,false)
  const rules = readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')
  assert.match(rules,/request\.resource\.data\.manualDailyPay is bool/)
  const code = readFileSync(new URL('../src/lib/data.ts',import.meta.url),'utf8')
  assert.match(code,/parsePerformanceSettings\(snapshot\.data\(\)\)/)
})
