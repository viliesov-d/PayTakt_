import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')

test('all non-calendar workspace pages have a calendar return in the main header',()=>{
  assert.match(app,/className="zmina-header-tools">\s*\{page!=='calendar'&&<button/)
  assert.match(app,/className="zmina-calendar-return"/)
  assert.match(app,/onClick=\{\(\)=>navigate\('calendar'\)\}/)
  assert.match(app,/aria-label="До календаря"/)
  assert.match(app,/<CalendarDays size=\{19\} aria-hidden="true"\/>/)
})

test('calendar return is accessible without expanding the mobile navigation',()=>{
  assert.match(css,/\.zmina-header-tools \.zmina-calendar-return\{/)
  assert.match(css,/@media\(max-width:880px\)/)
  assert.match(css,/\.zmina-header-tools \.zmina-calendar-return span\{display:none\}/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
})
