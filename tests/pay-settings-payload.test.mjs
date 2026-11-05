import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {defaultPaySettings, validatePaySettings} from '../src/lib/salary.ts'
import {preparePaySettingsWrite} from '../src/lib/paySettingsPayload.ts'

const clone=()=>structuredClone(defaultPaySettings)

// The previous serializer cleaned the top-level object but kept arbitrary
// nested fields from older Firestore documents. Firestore Rules denies those.
test('removes extraneous fields from nested payment and band rules',()=>{
  const record=clone()
  record.bands[0].legacyLabel='legacy tier'
  record.paymentRules[0].legacyCode='old'
  record.customRules=[{id:'bonus1',title:'Тест',trigger:'hours_at_least',threshold:60,bonus:10000,uiColor:'mint'}]
  validatePaySettings(record)
  const saved=preparePaySettingsWrite(record)
  assert.ok(!('legacyLabel' in saved.bands[0]))
  assert.ok(!('legacyCode' in saved.paymentRules[0]))
  assert.ok(!('uiColor' in saved.customRules[0]))
  assert.ok('legacyLabel' in record.bands[0], 'do not mutate current state')
  assert.deepEqual(Object.keys(saved.paymentRules[0]).sort(),['id','title','source','method','amount','day','monthOffset','enabled'].sort())
  assert.deepEqual(Object.keys(saved.bands[0]).sort(),['id','afterMinutes','multiplierBasisPoints'].sort())
  assert.deepEqual(Object.keys(saved.customRules[0]).sort(),['id','title','trigger','threshold','bonus'].sort())
})

test('deep sanitizer retains all required v5 keys and default payment allocations',()=>{
  const saved=preparePaySettingsWrite(clone())
  assert.deepEqual(Object.keys(saved).sort(),Object.keys(defaultPaySettings).sort())
  assert.equal(saved.version,5)
  assert.deepEqual(saved.paymentRules,defaultPaySettings.paymentRules)
})

test('client keeps strict v5 payload even when server avoids unused monolithic validator',()=>{
  const rules=fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')
  const saved=preparePaySettingsWrite(clone())
  assert.deepEqual(Object.keys(saved).sort(),Object.keys(defaultPaySettings).sort())
  assert.doesNotMatch(rules,/function validPaySettings\(\)/)
  assert.match(rules,/allow create, update: if payId == 'current'[\s\S]*?activeWorkspace\(workspaceId\)[\s\S]*?request\.resource\.data\.version == 5/)
})
