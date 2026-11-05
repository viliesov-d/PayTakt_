import test from 'node:test'
import assert from 'node:assert/strict'
import {
  savePresentation, getPresentation, formatMoney, formatDate, tr, setAccountingCurrency, getAccountingCurrency, inputCurrencyLabel,
} from '../src/lib/presentation.ts'

test('UAH remains unchanged when display settings are default', () => {
  const prior = {...getPresentation()}
  try {
    savePresentation({language:'uk',currency:'UAH',uahPerUnit:1})
    assert.match(formatMoney(12345), /123,45/)
  } finally { savePresentation(prior) }
})

test('display-only conversion does not mutate original kopeks', () => {
  const prior = {...getPresentation()}
  try {
    const stored = 425000 // 4,250.00 UAH
    savePresentation({language:'en',currency:'USD',uahPerUnit:42.5})
    assert.equal(formatMoney(stored),'≈ $100.00')
    assert.equal(stored,425000)
    assert.equal(tr('Мій календар'),'Calendar')
    assert.match(formatDate(new Date('2026-11-05T12:00:00Z')),/November/)
  } finally { savePresentation(prior) }
})

test('Russian translation and EUR formatting are supported', () => {
  const prior = {...getPresentation()}
  try {
    savePresentation({language:'ru',currency:'EUR',uahPerUnit:50})
    assert.equal(tr('Налаштування'),'Настройки')
    assert.match(formatMoney(500000),/100,00/)
  } finally { savePresentation(prior) }
})

test('invalid or absent exchange rates are rejected', () => {
  const prior = {...getPresentation()}
  try {
    assert.throws(()=>savePresentation({language:'en',currency:'USD',uahPerUnit:0}),/Exchange rate/)
    assert.throws(()=>savePresentation({language:'ru',currency:'PLN',uahPerUnit:NaN}),/Exchange rate/)
  } finally { savePresentation(prior) }
})

test('native USD workspace renders stored cents as dollars, not converted UAH',()=>{
  const prior={...getPresentation()}
  const priorNative=getAccountingCurrency()
  try {
    savePresentation({language:'en',currency:'EUR',uahPerUnit:100})
    setAccountingCurrency('USD')
    assert.equal(inputCurrencyLabel(),'USD')
    assert.equal(formatMoney(123450),'$1,234.50')
    assert.equal(formatMoney(0),'$0.00')
    assert.ok(!formatMoney(123450).startsWith('≈'))
    // Switching to a legacy workspace applies display conversion as before.
    setAccountingCurrency('UAH')
    assert.equal(formatMoney(123450),'≈ €12.35')
  }finally{
    setAccountingCurrency(priorNative)
    savePresentation(prior)
  }
})

test('invalid workspace currency cannot replace the safe UAH default',()=>{
  const before=getAccountingCurrency()
  try{
    setAccountingCurrency('UNKNOWN')
    assert.equal(getAccountingCurrency(),'UAH')
  }finally{setAccountingCurrency(before)}
})
