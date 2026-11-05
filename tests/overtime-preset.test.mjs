import test from 'node:test'
import assert from 'node:assert/strict'
import {validateOvertimePreset,defaultOvertimePreset} from '../src/lib/calendar.ts'
import {planPatternApplication,generateMonthlyPattern,presetPattern} from '../src/lib/schedule.ts'
import {defaultPaySettings,validatePaySettings} from '../src/lib/salary.ts'
import {readFileSync} from 'node:fs'

test('one-click overtime template validates and rejects zero duration and invalid %',()=>{
 assert.doesNotThrow(()=>validateOvertimePreset(defaultOvertimePreset))
 assert.throws(()=>validateOvertimePreset({...defaultOvertimePreset,start:'20:00',end:'20:00'}),/Перевір час/)
 assert.throws(()=>validateOvertimePreset({...defaultOvertimePreset,basisPoints:9999}),/Перевір час/)
 assert.throws(()=>validateOvertimePreset({...defaultOvertimePreset,breakMinutes:800}),/Перевір час/)
})
test('calendar bulk update protects day with one-click overtime even if planned',()=>{
 const days=generateMonthlyPattern({month:'2026-11',anchorDate:'2026-11-02',pattern:presetPattern('5/2')})
 const planned=days.find(d=>d.dayType==='work')
 const edited={...planned,overtimeExtra:{...defaultOvertimePreset,status:'planned'}}
 const result=planPatternApplication(days,[edited],'update-planned')
 assert.equal(result.summary.protected,1)
 assert.equal(result.write.some(x=>x.date===planned.date),false)
})
test('pay settings v5 keep local validation and owner-only Firestore access',()=>{
 validatePaySettings(defaultPaySettings)
 const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')
 assert.match(rules,/match \/paySettings\/\{payId\}/)
 assert.match(rules,/allow create, update: if payId == 'current'[\s\S]*?activeWorkspace\(workspaceId\)[\s\S]*?request\.resource\.data\.version == 5/)
 assert.doesNotMatch(rules,/function validPaySettings\(\)/)
})
