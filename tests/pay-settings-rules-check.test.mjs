import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPaySettings,normalizePaySettings} from '../src/lib/salary.ts'
import {preparePaySettingsWrite} from '../src/lib/paySettingsPayload.ts'
import {verifyPaySettingsFirestoreShape} from '../src/lib/paySettingsRulesCheck.ts'

const fresh=()=>structuredClone(defaultPaySettings)
test('default v5 payload passes local Firestore checks',()=>{
  assert.deepEqual(verifyPaySettingsFirestoreShape(preparePaySettingsWrite(fresh())),[])
})
test('v1 migration of real salary values passes v5 schema checks',()=>{
  const old={version:1,mode:'monthly',monthlySalary:3100000,monthlyNormDays:21,hourlyRate:0,shiftRate:0,workdayBonus:0,extraShiftBonus:0,monthlyBonus:0}
  const migrated=preparePaySettingsWrite(normalizePaySettings(old))
  assert.equal(migrated.version,5)
  assert.deepEqual(verifyPaySettingsFirestoreShape(migrated),[])
})
test('reports the exact invalid nested payment field',()=>{
  const v=fresh();v.paymentRules[0].amount=11000;v.paymentRules[0].method='percent'
  const issues=verifyPaySettingsFirestoreShape(v)
  assert.ok(issues.some(x=>x.includes('paymentRules[0].amount')))
})
test('reports unexpected nested keys before writing',()=>{
  const v=fresh();v.bands[0].unexpected='no'
  const issues=verifyPaySettingsFirestoreShape(v)
  assert.ok(issues.some(x=>x.includes('bands[0]')))
})
