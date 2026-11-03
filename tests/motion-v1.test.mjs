import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

test('month navigation keeps direction and an accessible today action', () => {
  assert.match(app, /monthDirection, setMonthDirection/)
  assert.match(app, /setMonthDirection\(n<0\?-1:1\)/)
  assert.match(app, /onClick=\{jumpToToday\}>Сьогодні/)
  assert.match(app, /aria-live="polite" aria-atomic="true"/)
})

test('calendar grid keys to month, not selected day or Firestore updates', () => {
  assert.match(app, /<div key=\{monthKey\} className=\{`cal-grid/)
  assert.match(app, /month-slide-next/)
  assert.match(app, /month-slide-prev/)
  assert.match(app, /aria-pressed=\{selected===date\}/)
})

test('optimistic day badges react to a saved status change', () => {
  assert.match(app, /setInstantDay\(next\)/)
  assert.match(app, /shift-indicator \$\{off/)
  assert.match(app, /key=\{`\$\{date\}-overtime-\$\{overtime\}`\}/)
  assert.match(css, /@keyframes day-badge-pop/)
})

test('page animations and selected calendar cell use CSS transitions', () => {
  assert.match(app, /className="page-motion" key=\{`\$\{workspace.id\}:\$\{page\}`\}/)
  assert.match(css, /@keyframes page-reveal/)
  assert.match(css, /@keyframes calendar-from-right/)
  assert.match(css, /@keyframes calendar-from-left/)
  assert.match(css, /\.cal-day\.selected\{box-shadow/)
})

test('reduced motion disables page, calendar, ambient and badge animations', () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:reduce\)/)
  assert.match(css, /\.cal-grid\.month-slide-next/)
  assert.match(css, /\.zmina-mini-calendar,\.zmina-floating-coin/)
  assert.match(css, /animation:none!important/)
})

test('Firestore owner-only payroll rule remains present', () => {
  assert.match(rules, /match \/paySettings\/\{payId\}/)
  assert.match(rules, /ownWorkspace\(workspaceId\)/)
})
