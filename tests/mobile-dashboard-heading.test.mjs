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
