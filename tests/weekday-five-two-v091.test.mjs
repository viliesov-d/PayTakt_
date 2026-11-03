import test from 'node:test'
import assert from 'node:assert/strict'
import {presetPattern, mondayOfWeek, generateMonthlyPattern, planPatternApplication, validatePattern} from '../src/lib/schedule.ts'
import {suggestions} from '../src/lib/professions.ts'

const pattern = presetPattern('5/2-weekdays')
const month = (yyyyMM, anchor) => generateMonthlyPattern({month:yyyyMM, anchorDate:anchor, pattern})
const isWeekday = date => { const wd=new Date(`${date}T12:00:00Z`).getUTCDay();return wd!==0&&wd!==6 }

test('ready-made 5/2 weekdays contains Monday-Friday and weekend off', () => {
  validatePattern(pattern)
  assert.equal(pattern.length, 7)
  assert.deepEqual(pattern.map(d=>d.type), ['work','work','work','work','work','off','off'])
  assert.deepEqual(pattern.slice(0,5).map(d=>d.breakMinutes), [60,60,60,60,60])
})

test('anchor automatically aligns Sunday November 1 2026 to Monday October 26', () => {
  assert.equal(mondayOfWeek('2026-11-01'), '2026-10-26')
  assert.equal(mondayOfWeek('2026-11-02'), '2026-11-02')
  const days=month('2026-11',mondayOfWeek('2026-11-01'))
  assert.equal(days.length,30)
  assert.equal(days.find(d=>d.date==='2026-11-01').dayType,'off')
  assert.equal(days.find(d=>d.date==='2026-11-02').dayType,'work')
  assert.equal(days.find(d=>d.date==='2026-11-07').dayType,'off')
  assert.equal(days.find(d=>d.date==='2026-11-08').dayType,'off')
  assert.equal(days.filter(d=>d.dayType==='work').length,21)
})

test('weekday mapping is independent of first-of-month weekday, leap year, DST and year boundaries', () => {
  for(const yyyyMM of ['2026-11','2026-12','2027-01','2027-05','2028-02','2028-03','2028-10','2029-01']) {
    const anchor=mondayOfWeek('2026-11-01')
    const days=month(yyyyMM,anchor)
    for(const day of days) {
      assert.equal(day.dayType==='work',isWeekday(day.date),day.date)
      assert.equal(day.plannedWorkday,isWeekday(day.date),day.date)
      assert.equal(day.plannedMinutes,isWeekday(day.date)?480:0,day.date)
    }
  }
})

test('weekday 5/2 and rotating 5/2 remain separate selectable templates', () => {
  const rotating=presetPattern('5/2')
  assert.equal(rotating.length,7)
  const novRotating=generateMonthlyPattern({month:'2026-11',anchorDate:'2026-11-01',pattern:rotating})
  assert.equal(novRotating[0].dayType,'work')
  const fixed=month('2026-11',mondayOfWeek('2026-11-01'))
  assert.equal(fixed[0].dayType,'off')
})

test('previously worked dates are never overwritten by weekday template', () => {
  const generated=month('2026-11',mondayOfWeek('2026-11-01'))
  const existing=[{
    ...generated.find(d=>d.date==='2026-11-02'),status:'worked',note:'Підтверджена зміна'
  }]
  const applied=planPatternApplication(generated,existing,'update-planned')
  assert.equal(applied.summary.protected,1)
  assert.equal(applied.write.some(d=>d.date==='2026-11-02'),false)
})

test('all profession weekday 5/2 suggestions use stable Monday anchor',()=>{
  const options=Object.values(suggestions).flat().filter(p=>p.name.startsWith('5/2 '))
  assert.ok(options.length>20)
  assert.ok(options.every(p=>p.shift==='5/2-weekdays'))
})
