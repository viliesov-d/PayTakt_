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


test('mobile pay-rule fields do not inherit a 180px vertical flex basis',()=>{
  // Desktop: 180px flex basis still allows horizontal label/input layout.
  assert.match(css,/\.salary-form \.pay-field>span\{min-width:0;flex:1 1 180px\}/)
  // Mobile: that 180px must not become the height of the label above input.
  assert.match(css,/@media\(max-width:900px\)\{\s*\.salary-rules-page \.salary-form \.pay-field\{\s*justify-content:flex-start;/)
  assert.match(css,/\.salary-rules-page \.salary-form \.pay-field > span:first-child\{\s*flex:0 0 auto;\s*width:100%;\s*min-height:0;/)
  // Only rules section; never change the floating glass dock selectors.
  assert.doesNotMatch(css.slice(css.lastIndexOf('/* Mobile pay rules:')),/pt-slider-nav|pt-dock-glass/)
})


test('all pay-rule accordion panels use a single smooth height animation',()=>{
  const motion=read('../src/lib/payRuleAccordion.ts')
  assert.match(rules,/ref=\{rulesRoot\} className="salary-page salary-rules-page"/)
  assert.match(rules,/bindPayRuleAccordions\(rulesRoot.current\)/)
  assert.match(motion,/root.addEventListener\('click',onClick\)/)
  assert.match(motion,/details.matches\('details.pay-collapse,details.pay-optional'\)/)
  assert.match(motion,/event.preventDefault\(\)/)
  assert.match(motion,/const opening=previous\?!previous.opening:!details.open/)
  assert.match(motion,/const start=details.getBoundingClientRect\(\).height/)
  assert.match(motion,/details.animate\(/)
  assert.match(motion,/duration:opening\?340:270/)
  assert.match(motion,/previous.animation.cancel\(\)/)
  assert.match(motion,/prefers-reduced-motion: reduce/)
  assert.match(motion,/details.open=opening/)
  assert.match(motion,/root.removeEventListener\('click',onClick\)/)
  assert.match(css,/\.salary-rules-page details:is\(\.pay-collapse,\.pay-optional\)\[open\] > :not\(summary\)/)
  assert.match(css,/\.salary-rules-page details:is\(\.pay-collapse,\.pay-optional\)::details-content\{/)
  assert.doesNotMatch(motion,/setPointerCapture|pt-web-slider|backdrop-filter/)
})
