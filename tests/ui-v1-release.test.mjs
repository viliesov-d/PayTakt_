import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ui = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('PayTakt 2 onboarding beta package has prerelease semver', () => {
  assert.equal(pkg.version, '2.0.0-beta.4')
})

test('site navigation is in the top header, not a fixed app sidebar', () => {
  assert.match(ui, /className="zmina-site-header"/)
  assert.match(ui, /className=\{`zmina-primary-nav/)
  assert.doesNotMatch(ui, /<aside className=\{`sidebar/)
  assert.match(ui, /aria-current=\{page===item.id\?'page':undefined\}/)
})

test('dashboard includes Zmina-style mini calendar with true weekday alignment', () => {
  assert.match(ui, /className="zmina-mini-calendar"/)
  assert.match(ui, /const offset=\(new Date\(today\.getFullYear\(\),today\.getMonth\(\),1\)\.getDay\(\)\+6\)%7/)
  assert.match(ui, /className="zmina-floating-coin coin-primary"/)
})

test('the original Zmina visual tokens are present in the new theme', () => {
  assert.match(styles, /--zmina-deep:#101c33/)
  assert.match(styles, /--zmina-lime:#c2f075/)
  assert.match(styles, /--zmina-purple:#7468c9/)
  assert.match(styles, /--page:#f4f7fa/)
  assert.match(styles, /zmina-primary-nav\.expanded/)
})

test('selected day removes fleeting green success text while keeping help and error messages clear', () => {
  assert.doesNotMatch(ui, /День збережено у Firebase|Зберігаємо зміни у Firebase|Кнопки вище одразу зберігають дані у Firebase/)
  assert.doesNotMatch(ui, /setStatus\(success\)|setMoneyNotice\(wasWorked\?/)
  assert.match(ui, /\{moneyNotice&&<p role="alert" className="form-error">/)
  assert.match(ui, /\{status&&<p className="form-error" role="alert">/)
  assert.match(ui, /День відмічено, але не всі суми збережені/)
})

test('Firebase workspace owner restriction is kept for payroll settings', () => {
  assert.match(rules, /match \/paySettings\/\{payId\}/)
  assert.match(rules, /ownWorkspace\(workspaceId\)/)
})
