import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')

test('monthly dashboard summary has a scoped heading for mobile layout',()=>{
  assert.match(app,/<div className="dashboard-summary-heading">\s*<SectionHeading eyebrow="КОРОТКИЙ ОГЛЯД" title="Підсумок місяця"/)
  assert.match(app,/\{tr\("Моя статистика"\)\} <TrendingUp size=\{17\}/)
})
test('mobile dashboard summary text and button align left with the cards',()=>{
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.dashboard-summary-heading \.section-head\{/)
  assert.match(css,/\.dashboard-summary-heading \.section-head\{[\s\S]*?align-items:flex-start/)
  assert.match(css,/\.dashboard-summary-heading \.section-head>\.btn\{\s*align-self:flex-start/)
  assert.match(css,/\.dashboard-summary-heading \.section-head \.subtitle\{[\s\S]*?overflow-wrap:anywhere/)
})

// v0.4: heading alignment retains mobile safety rules.

test('mobile headings align left everywhere',()=>{
  assert.match(css,/\.main-content \.section-head\{/)
  assert.match(css,/align-items:flex-start/)
})

test('calendar overtime label is concise',()=>{
  assert.match(app,/className="calendar-overtime" aria-label=/)
  assert.doesNotMatch(app, /год понадн\.<\/span>/)
})

test('mobile login uses the viewport and calendar has motion safeguards',()=>{
  assert.match(css,/min-height:100svh/)
  assert.match(css, /max-height:700px/)
  assert.match(app, /<h3 key=\{monthKey\} aria-live="polite"/)
  assert.match(css, /@keyframes paytakt-day-selected/)
  assert.match(css, /@keyframes paytakt-overtime-pop/)
  assert.match(css, /prefers-reduced-motion:reduce/)
})
