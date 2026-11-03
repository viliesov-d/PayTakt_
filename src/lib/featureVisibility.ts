/** UI visibility only. Never delete stored entries merely because a feature is hidden. */
import type {Sector} from './professions.ts'
import type {PaySettings} from './salary.ts'
import type {PerformanceSettings} from './performance.ts'
import type {CashPreferences} from './dailyCash.ts'

const CASH_SUGGESTED:readonly Sector[]=['retail','hospitality','beauty']
export const isCashRelevantSector=(sector:Sector):boolean=>CASH_SUGGESTED.includes(sector)
export function calendarFeatures(settings:PaySettings|null,prefs:CashPreferences,performance:PerformanceSettings){
  const sector=(settings?.sector??'other') as Sector
  return {
    cashToggle:prefs.enabled||isCashRelevantSector(sector),
    cashEntry:prefs.enabled,
    overtimeButton:settings?.overtimeEnabled===true&&settings.overtimeEntryMode==='marked',
    overtimeSettings:settings?.overtimeEnabled===true,
    manualPay:performance.manualDailyPay,
    plan:performance.enabled&&performance.defaultTarget>0,
  }
}
