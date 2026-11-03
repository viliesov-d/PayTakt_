/**
 * Canonical Firestore serialization for PaySettings (version 5).
 *
 * Firestore Security Rules validates not only top-level keys but also keys of
 * every nested payment, tier and bonus rule. Normalizing a legacy record with
 * {...defaults, ...record} preserves unknown nested fields. This strict
 * allowlist intentionally strips them before an owner-authorized write.
 *
 * No Firebase imports: can be unit-tested without credentials or network.
 */
import {
  defaultPaySettings,
  validatePaySettings,
  type PaySettings,
  type PaymentRule,
  type HourBand,
  type CustomRule,
} from './salary.ts'

const paymentKeys = [
  'id', 'title', 'source', 'method', 'amount', 'day', 'monthOffset', 'enabled',
] as const satisfies readonly (keyof PaymentRule)[]

const bandKeys = [
  'id', 'afterMinutes', 'multiplierBasisPoints',
] as const satisfies readonly (keyof HourBand)[]

const customKeys = [
  'id', 'title', 'trigger', 'threshold', 'bonus',
] as const satisfies readonly (keyof CustomRule)[]

const topLevelKeys = Object.keys(defaultPaySettings) as (keyof PaySettings)[]

function pick<T extends object, K extends keyof T>(item:T, keys:readonly K[]):Pick<T,K> {
  const output = {} as Pick<T,K>
  for (const key of keys) output[key]=item[key]
  return output
}

/** Returns only schema-v5 fields. Caller adds updatedAt: serverTimestamp(). */
export function preparePaySettingsWrite(settings:PaySettings):PaySettings {
  // Confirm known field types and arithmetic boundaries before sanitizing.
  validatePaySettings(settings)
  const flat = pick(settings, topLevelKeys)
  const result:PaySettings = {
    ...flat,
    paymentRules: settings.paymentRules.map(rule => pick(rule, paymentKeys)),
    bands: settings.bands.map(band => pick(band, bandKeys)),
    customRules: settings.customRules.map(rule => pick(rule, customKeys)),
  }
  validatePaySettings(result)
  return result
}
