import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('performance settings use the same salary accordion heading and chevron', () => {
  const component = read('src/components/PerformanceRulesEditor.tsx')
  assert.match(component, /className="panel pay-collapse performance-editor"/)
  assert.match(component, /className="pay-collapse-summary"/)
  assert.match(component, /className="pay-collapse-chevron"/)
})

test('performance settings have responsive labels and inputs', () => {
  const css = read('src/styles.css')
  assert.match(css, /\.salary-page\s*>\s*\.performance-editor\s*>\s*\.pay-collapse-summary/)
  assert.match(css, /\.performance-editor\s+\.performance-fields\s*>\s*\.pay-field\s*>\s*select/)
  assert.match(css, /\.performance-editor\s+\.performance-tier-row/)
  assert.match(css, /@media\(max-width:390px\)/)
})

test('favicon is a path-based graphic with a cache-busted HTML reference', () => {
  const html = read('index.html')
  const icon = read('public/favicon.svg')
  assert.match(html, /favicon\.svg\?v=2/)
  assert.match(icon, /<svg\b/)
  assert.match(icon, /<path\b/)
  assert.doesNotMatch(icon, /<text\b/)
})
