import test from 'node:test'
import assert from 'node:assert/strict'
import {buildReminderPlan,defaultReminders,reminderId,isPayTaktReminderId,
  readReminderSettings,saveReminderSettings} from '../src/lib/reminderPlan.ts'
import {defaultPaySettings} from '../src/lib/salary.ts'

const day=(date,start='09:00',status='planned',dayType='work')=>({
  id:date,date,start,end:'18:00',breakMinutes:60,note:'',status,dayType,
})

test('all reminders are opt-in, even when future work exists',()=>{
  const events=buildReminderPlan('alice','work','Store',[day('2026-11-06')],
    defaultPaySettings,defaultReminders,new Date(2026,10,5,12))
  assert.deepEqual(events,[])
})

test('tomorrow, shift start and configured payday schedule locally',()=>{
  const prefs={...defaultReminders,enabled:true}
  const plan=buildReminderPlan('alice','work','Мій графік',
    [day('2026-11-06')],defaultPaySettings,prefs,new Date(2026,10,5,12))
  const times=plan.map(x=>[x.title,x.at.getDate(),x.at.getHours(),x.at.getMinutes()])
  assert.ok(times.some(x=>x[0]==='Завтра робочий день'&&x[1]===5&&x[2]===19))
  assert.ok(times.some(x=>x[0]==='Незабаром робоча зміна'&&x[1]===6&&x[2]===8))
  assert.ok(times.some(x=>x[0]==='Запланована виплата'&&x[1]===25&&x[2]===9))
  assert.equal(new Set(plan.map(x=>x.id)).size,plan.length)
  assert.ok(plan.every(x=>isPayTaktReminderId(x.id)))
})

test('off days, worked days and days beyond the 28-day window do not notify',()=>{
  const prefs={...defaultReminders,enabled:true,payday:false}
  const items=[day('2026-11-07','09:00','worked'),day('2026-11-08','09:00','planned','off'),day('2027-01-12')]
  assert.deepEqual(buildReminderPlan('a','w','Work',items,null,prefs,new Date(2026,10,5,12)),[])
})

test('paydays are taken from edited payment rules and capped at month end',()=>{
  const pay={...defaultPaySettings,paymentRules:[
    {...defaultPaySettings.paymentRules[0],day:31,monthOffset:0},
    {...defaultPaySettings.paymentRules[1],enabled:false},
    {...defaultPaySettings.paymentRules[2],enabled:false},
  ]}
  const plan=buildReminderPlan('a','w','Work',[],pay,
    {...defaultReminders,enabled:true,shiftStart:false,tomorrow:false},new Date(2026,10,5,12))
  assert.equal(plan.length,1)
  assert.equal(plan[0].at.getDate(),30) // November has 30 days
})

test('IDs are stable across restarts and differ for workspaces, days and event types',()=>{
  const key='user:workspace:start:2026-11-06'
  assert.equal(reminderId(key),reminderId(key))
  assert.notEqual(reminderId(key),reminderId('user:other:start:2026-11-06'))
  assert.notEqual(reminderId(key),reminderId('user:workspace:tomorrow:2026-11-06'))
})

test('reminder preferences are local to account and workspace and disabled by default',()=>{
  const old=globalThis.localStorage
  const store=new Map()
  globalThis.localStorage={
    getItem:k=>store.get(k)??null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k),
  }
  try{
    assert.equal(readReminderSettings('alice','a').enabled,false)
    saveReminderSettings('alice','a',{...defaultReminders,enabled:true,leadMinutes:30})
    assert.equal(readReminderSettings('alice','a').leadMinutes,30)
    assert.equal(readReminderSettings('alice','b').enabled,false)
    assert.equal(readReminderSettings('bob','a').enabled,false)
  }finally{
    if(old===undefined)delete globalThis.localStorage
    else globalThis.localStorage=old
  }
})

test('native plugin is not accessed from web test runtime',async()=>{
  const {androidNotifications,cancelPayTaktReminders,reconcileReminders}=await import('../src/lib/nativeReminders.ts')
  assert.equal(androidNotifications(),null)
  await assert.doesNotReject(cancelPayTaktReminders())
  assert.equal(await reconcileReminders({uid:'a',workspaceId:'w',workspaceName:'test',
    shifts:[],pay:null,prefs:{...defaultReminders,enabled:true}}),0)
})
