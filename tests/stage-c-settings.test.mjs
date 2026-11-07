import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const hub=readFileSync(new URL('../src/components/SettingsHome.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles/settings-hub.css',import.meta.url),'utf8')
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8')

test('stage C exposes focused settings sections and direct work actions',()=>{
  for(const section of ['appearance','schedule','finance','notifications','data','account','workspaces']){
    assert.ok(hub.includes(`'${section}'`),`missing settings section: ${section}`)
  }
  assert.match(hub,/onGoRules/)
  assert.match(hub,/workspacesCount/)
  assert.match(hub,/remindersEnabled/)
})

test('existing data editors remain reachable without showing all panels on home',()=>{
  assert.match(app,/section==='home'&&<SettingsHome/)
  assert.match(app,/section==='appearance'&&<>/)
  assert.match(app,/section==='finance'&&<>/)
  assert.match(app,/section==='notifications'&&remindersPanel/)
  assert.match(app,/section==='data'&&<>/)
  assert.match(app,/section==='workspaces'&&<>/)
  assert.match(app,/section==='account'&&!session.demo/)
  assert.match(app,/settingsSection==='schedule'&&<CalendarPage scheduleOnly/)
})

test('settings navigation supports Android system Back and the on-screen back button',()=>{
  assert.match(app,/paytaktSettingsSection:next/)
  assert.match(app,/window\.history\.back\(\)/)
  assert.match(app,/isSettingsSection\(candidateSection\)/)
  assert.match(hub,/onClick=\{onBack\}/)
})

test('stage C styles are isolated from the optical dock',()=>{
  assert.match(main,/import '\.\/styles\/settings-hub\.css'/)
  assert.match(css,/\.pt-settings-quick-grid/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
  assert.match(app,/glass=\{nativeOpticalGlass\} dockTransparency=\{appearance\.dockTransparency\} onSelect=\{navigate\}/)
})
