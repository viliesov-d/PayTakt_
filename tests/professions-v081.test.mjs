import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {sectors, suggestions, allSuggestions, createSelfPreset} from '../src/lib/professions.ts'
import {presetPattern, generateMonthlyPattern, validatePattern} from '../src/lib/schedule.ts'
import {defaultPaySettings,validatePaySettings} from '../src/lib/salary.ts'

test('all work sectors have multiple editable templates and every preset id is unique',()=>{
  assert.ok(sectors.length>=15)
  assert.equal(new Set(sectors.map(s=>s.id)).size,sectors.length)
  const ids=allSuggestions.map(p=>p.id)
  assert.equal(ids.length,new Set(ids).size)
  for(const sector of sectors){
    assert.ok(suggestions[sector.id].length>=4,sector.id)
    for(const option of suggestions[sector.id]){
      assert.ok(['hourly','per_shift','monthly','per_unit'].includes(option.mode))
      const pattern=presetPattern(option.shift)
      validatePattern(pattern)
      assert.equal(generateMonthlyPattern({month:'2026-11',anchorDate:'2026-11-01',pattern}).length,30)
    }
  }
})

test('create-self keeps a valid editable first day and does not imply a wage rate',()=>{
  assert.equal(createSelfPreset.id,'create-self')
  assert.equal(createSelfPreset.shift,'custom')
  const pattern=presetPattern(createSelfPreset.shift)
  assert.equal(pattern.length,1)
  assert.equal(pattern[0].type,'work')
  validatePattern(pattern)
  assert.equal(defaultPaySettings.hourlyRate,0)
})

test('new night and duty templates use distinct valid time ranges',()=>{
  const night=presetPattern('night-2/2')
  assert.equal(night[0].start,'20:00')
  assert.equal(night[0].end,'08:00')
  const duty=presetPattern('duty-24-72')
  assert.equal(duty[0].start,duty[0].end)
  assert.equal(duty.slice(1).filter(x=>x.type==='off').length,3)
  for(const p of [night,duty])validatePattern(p)
})

test('payroll v5 requires owner and version 5, with local schema validation',()=>{
  validatePaySettings(defaultPaySettings)
  const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')
  assert.match(rules,/allow create, update: if payId == 'current'\s*&& activeWorkspace\(workspaceId\)\s*&& request\.resource\.data\.version == 5/)
  assert.match(rules,/allow read, write: if false/)
  assert.doesNotMatch(rules,/function validPaySettings\(\)/)
})
