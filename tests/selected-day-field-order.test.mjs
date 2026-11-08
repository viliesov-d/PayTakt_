import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const original=app.indexOf('className="day-money-fields"')
const until=app.indexOf('</div>',original)
const fields=app.slice(original,until)

test('selected day shows daily cash before personal wage without changing field wiring',()=>{
  const cash=fields.indexOf('tr("Каса за день, ₴")')
  const wage=fields.indexOf('tr("Мій заробіток, ₴")')
  assert.ok(original>=0&&cash>=0&&wage>cash)
  assert.match(fields,/cashPrefs\.enabled&&<label>/)
  assert.match(fields,/performance\.manualDailyPay&&<label>/)
  assert.match(fields,/value=\{cashDraft\}/)
  assert.match(fields,/onChange=\{e=>setCashDraft\(e\.target\.value\)\}/)
  assert.match(fields,/value=\{wageDraft\}/)
  assert.match(fields,/onChange=\{e=>setWageDraft\(e\.target\.value\)\}/)
  assert.match(app,/const next=markWorkedForDailyPay/)
  assert.match(app,/await onSave\(next\)/)
  assert.match(app,/await onSaveDailyWage\(date,wage\)/)
  assert.match(app,/await onSaveCash\(\{date,amount:cash\}\)/)
})

test('selected day never shows fleeting green success banners; errors are still visible',()=>{
  assert.doesNotMatch(app,/setMoneyNotice\(wasWorked\?/)
  assert.doesNotMatch(app,/setMoneyNotice\('День відпрацьовано/)
  assert.doesNotMatch(app,/setStatus\(success\)/)
  assert.doesNotMatch(app,/setCashNotice\('Касу видалено\.'\)/)
  assert.doesNotMatch(app,/setStatus\(demo\?'Збережено/)
  assert.doesNotMatch(app,/setStatus\('Запис дня видалено\.'\)/)
  assert.match(app,/\{moneyNotice&&<p role="alert" className="form-error">/)
  assert.match(app,/\{cashNotice&&<p className="form-error" role="alert">/)
  assert.match(app,/\{status&&<p className="form-error" role="alert">/)
  assert.match(app,/setMoneyNotice\(friendlyError\(error\)\)/)
  assert.match(app,/setStatus\(friendlyError\(error\)\)/)
  assert.match(app,/day-money-worked/)
  assert.match(app,/day-save-pending/)
})

test('user interaction and payroll logic remain unchanged',()=>{
  assert.match(app,/const quickSave = async \(next:Shift\) =>/)
  assert.match(app,/const quickStatus = \(\) =>/)
  assert.match(app,/void quickSave\(next\)/)
  assert.match(app,/const saveDayMoney=async\(e:FormEvent<HTMLFormElement>\)/)
  assert.match(app,/if\(cashPrefs\.enabled&&cashDraft\.trim\(\)!==''\)cash=parseCashHryvnia\(cashDraft\)/)
  assert.match(app,/if\(performance\.manualDailyPay&&wageDraft\.trim\(\)!==''\)wage=parseCashHryvnia\(wageDraft\)/)
  assert.match(app,/if\(performance\.manualDailyPay\)\{/)
  assert.match(app,/if\(cashPrefs\.enabled\)\{/)
  assert.match(app,/onClick=\{quickStatus\}/)
  assert.match(app,/onSubmit=\{saveDayMoney\}/)
})
