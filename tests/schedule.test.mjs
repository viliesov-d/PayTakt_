import test from 'node:test'
import assert from 'node:assert/strict'
import {generateMonthlyCycle} from '../src/lib/schedule.ts'

const params = {month:'2026-11',anchorDate:'2026-11-01',workDays:2,restDays:2,start:'09:00',end:'18:00',breakMinutes:60}
test('2/2 schedule continues correctly through month',()=>{
  const days=generateMonthlyCycle(params).map(x=>x.date)
  assert.deepEqual(days.slice(0,6),['2026-11-01','2026-11-02','2026-11-05','2026-11-06','2026-11-09','2026-11-10'])
  assert.equal(days.length,16)
})
test('existing dates are not overwritten',()=>{
  const list=generateMonthlyCycle(params,new Set(['2026-11-01','2026-11-05']))
  assert.equal(list.length,14)
  assert.equal(list.some(x=>['2026-11-01','2026-11-05'].includes(x.date)),false)
})
test('work/rest cycle continues backwards from anchor and across February leap day',()=>{
  const shifts=generateMonthlyCycle({...params,month:'2028-02',anchorDate:'2028-03-01'})
  assert.equal(shifts.length>0,true)
  const onLeapDate=generateMonthlyCycle({...params,month:'2028-02',anchorDate:'2028-02-29'})
  assert.equal(onLeapDate.some(s=>s.date==='2028-02-29'),true)
  const next=generateMonthlyCycle({...params,month:'2028-03',anchorDate:'2028-03-01'})
  assert.equal(next[0].date,'2028-03-01')
})
test('break longer than a shift is rejected',()=>{
  assert.throws(()=>generateMonthlyCycle({...params,start:'08:00',end:'09:00',breakMinutes:60}),/Перерва/)
})
test('invalid dates and cycles are rejected',()=>{
  assert.throws(()=>generateMonthlyCycle({...params,anchorDate:'2026-02-30'}),/дата/)
  assert.throws(()=>generateMonthlyCycle({...params,workDays:0}),/циклі/)
})
