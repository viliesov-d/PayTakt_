import test from 'node:test'
import assert from 'node:assert/strict'
import {
  savePresentation, getPresentation, formatMoney, formatDate, tr,
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
    assert.match(formatMoney(500000),/10,00/)
  } finally { savePresentation(prior) }
})

test('invalid or absent exchange rates are rejected', () => {
  const prior = {...getPresentation()}
  try {
    assert.throws(()=>savePresentation({language:'en',currency:'USD',uahPerUnit:0}),/Exchange rate/)
    assert.throws(()=>savePresentation({language:'ru',currency:'PLN',uahPerUnit:NaN}),/Exchange rate/)
  } finally { savePresentation(prior) }
})
