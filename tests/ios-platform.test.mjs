import test from 'node:test'
import assert from 'node:assert/strict'
import {nativePlatform} from '../src/lib/nativePlatform.ts'
import {setAndroidSystemBarContrast} from '../src/lib/nativeSystemBars.ts'
import {defaultReminders,reminderId} from '../src/lib/reminderPlan.ts'
import {reconcileReminders} from '../src/lib/nativeReminders.ts'

test('native detection does not treat the iPhone website as a native application',()=>{
  assert.equal(nativePlatform({getPlatform:()=> 'ios',isNativePlatform:()=>false}),'web')
  assert.equal(nativePlatform({getPlatform:()=> 'ios',isNativePlatform:()=>true}),'ios')
  assert.equal(nativePlatform({getPlatform:()=> 'android',isNativePlatform:()=>true}),'android')
  assert.equal(nativePlatform({getPlatform:()=> 'unknown',isNativePlatform:()=>true}),'web')
})

test('iOS status bar glyphs follow the selected application theme',()=>{
  const values=[]
  const bridge={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{SystemBars:{setStyle:async x=>{values.push(x.style)}}}}
  setAndroidSystemBarContrast(true,bridge)
  setAndroidSystemBarContrast(false,bridge)
  assert.deepEqual(values,['DARK','LIGHT'])
})

test('iOS reconciliation schedules without Android alarms/channels and preserves unrelated reminders',async()=>{
  const previous=globalThis.window
  const scheduled=[],cancelled=[]
  const owned=reminderId('ios-test')
  let channels=0,permissionRequests=0
  globalThis.window={Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{LocalNotifications:{
    checkPermissions:async()=>({display:'granted'}),
    requestPermissions:async()=>{permissionRequests++;return {display:'granted'}},
    getPending:async()=>({notifications:[{id:owned},{id:1}]}),
    cancel:async x=>cancelled.push(...x.notifications),
    createChannel:async()=>{channels++},
    schedule:async x=>scheduled.push(...x.notifications),
  }}}}
  try{
    const count=await reconcileReminders({uid:'a',workspaceId:'w',workspaceName:'Робота',
      shifts:[{id:'2026-11-08',date:'2026-11-08',start:'09:00',end:'18:00',breakMinutes:60,status:'planned',dayType:'work',note:''}],
      pay:null,prefs:{...defaultReminders,enabled:true,payday:false},now:new Date(2026,10,7,12)})
    assert.equal(count,2)
    assert.deepEqual(cancelled,[{id:owned}])
    assert.equal(channels,0)
    assert.equal(permissionRequests,0)
    assert.ok(scheduled.every(n=>!('isExactNotification' in n)&&!('allowWhileIdle' in n.schedule)))
  }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous}
})
