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
test('pay settings v5 default schema matches allowed fields in shipped firestore.rules',()=>{
 validatePaySettings(defaultPaySettings)
 const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')
 const body=rules.match(/function validPaySettings\(\)\s*\{([\s\S]*?)\n    \}/)?.[1]
 assert.ok(body)
 const allow=body.match(/hasOnly\(\[([\s\S]*?)\]\)/)?.[1]
 const required=body.match(/hasAll\(\[([\s\S]*?)\]\)/)?.[1]
 assert.ok(allow&&required)
 const getKeys=content=>[...content.matchAll(/'([^']+)'/g)].map(x=>x[1])
 const all=new Set(getKeys(allow))
 const keys=Object.keys(defaultPaySettings)
 assert.deepEqual(keys.filter(k=>!all.has(k)),[])
 assert.deepEqual(getKeys(required).filter(k=>!keys.includes(k)),[])
 assert.equal(getKeys(required).length,keys.length)
})
