import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const rules=read('../src/components/SalaryPages.tsx')
const css=read('../src/styles.css')
const app=read('../src/App.tsx')

test('compact pay rule spacing is scoped to rules builder, not payroll summaries',()=>{
  assert.match(rules,/className="salary-page salary-rules-page"/)
  assert.match(rules,/export function PayPageV5[\s\S]*?return <div className="salary-page">/)
  assert.match(css,/\.salary-rules-page \.salary-form\.? ?\{gap:11px\}/)
  assert.match(css,/\.salary-rules-page \.salary-form \.pay-collapse-summary \.pay-block-heading p\{\s*margin:0;\s*line-height:1\.45;/)
  assert.match(css,/\.salary-rules-page \.salary-form \.pay-collapse-body > p\{\s*margin:4px 0 9px;/)
  assert.match(css,/\.salary-rules-page \.salary-form \.pay-collapse-body \.pay-field\{\s*gap:10px;\s*padding:10px 0;/)
  assert.match(css,/\.salary-rules-page > \.performance-editor > \.pay-collapse-body\{\s*gap:12px;/)
  assert.match(css,/@media\(max-width:700px\)\{\s*\.salary-rules-page/)
  assert.match(app,/page==='rules'/)
})

test('rules accordion headers and accessible input layout stay present',()=>{
  assert.match(rules,/details className="panel pay-collapse"/)
  assert.match(rules,/className="pay-collapse-summary"/)
  assert.match(rules,/className="pay-collapse-body"/)
  assert.match(rules,/<PaymentScheduleEditor/)
  assert.match(rules,/<PerformanceRulesEditor/)
  assert.match(css,/\.salary-form \.pay-collapse-summary:focus-visible/)
})
