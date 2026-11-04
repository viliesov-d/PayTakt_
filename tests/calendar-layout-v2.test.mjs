import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {defaultCalendarLayout,moveCalendarBlock,sanitizeCalendarLayout,readCalendarLayout,writeCalendarLayout} from '../src/lib/calendarLayout.ts'
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
test('calendar layout defaults to calendar, plan, metrics and selected day',()=>{
 assert.deepEqual(defaultCalendarLayout.order,['calendar','plan','metrics'])
 assert.equal(defaultCalendarLayout.visible.editor,true)
})
test('invalid preferences cannot inject unknown blocks',()=>{
 const v=sanitizeCalendarLayout({order:['danger','metrics','metrics'],visible:{plan:'false',editor:false}})
 assert.deepEqual(v.order,['metrics','calendar','plan'])
 assert.equal(v.visible.plan,true)
 assert.equal(v.visible.editor,false)
})
test('layout order can move blocks and respect limits',()=>{
 const ids=defaultCalendarLayout.order
 assert.deepEqual(moveCalendarBlock(ids,'metrics',-1),['calendar','metrics','plan'])
 assert.deepEqual(moveCalendarBlock(ids,'calendar',-1),ids)
})
test('workspace preferences persist without backend writes',()=>{
 const store=new Map()
 globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,v)=>store.set(key,v)}
 const next={...defaultCalendarLayout,visible:{...defaultCalendarLayout.visible,metrics:false}}
 assert.equal(writeCalendarLayout('space1',next),true)
 assert.equal(readCalendarLayout('space1').visible.metrics,false)
 assert.equal(readCalendarLayout('space2').visible.metrics,true)
 delete globalThis.localStorage
})
test('calendar schedule lives in work settings; mobile editor comes first; plan is below calendar',()=>{
 assert.match(app,/scheduleOnly&&<>[\s\S]*Графік під твої правила/)
 assert.match(app,/page==='settings'&&<CalendarPage scheduleOnly/)
 assert.match(styles,/\.calendar-day-slot\{order:-1/)
 assert.match(app,/className="panel calendar-plan-panel"/)
})
test('iOS inputs use 16px while maintaining pinch zoom',()=>{
 assert.match(styles,/font-size:16px!important/)
 assert.doesNotMatch(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/user-scalable=no/)
})
test('daily wage/cash allow real zero and blank deletion independently',()=>{
 assert.match(app,/wageDraft\.trim\(\)!==''/)
 assert.match(app,/cashDraft\.trim\(\)!==''/)
 assert.match(app,/await onSaveDailyWage\(date,wage\)/)
 assert.match(app,/await onSaveCash\(\{date,amount:cash\}\)/)
})
