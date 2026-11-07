/** Device-local visual preferences. No Firestore schema changes or payroll side effects. */
export type UIStyle = 'classic' | 'glass' | 'soft'
export type GradientPreset = 'none' | 'mint' | 'ocean' | 'sunset' | 'violet' | 'custom'
export type AppearancePreferences = {
  style: UIStyle
  gradient: GradientPreset
  from: string
  to: string
  angle: number
  /** Android Liquid Glass dock overlay transparency (0 = opaque, 100 = clearest). */
  dockTransparency: number
}

export const APPEARANCE_STORAGE_KEY = 'paytakt-appearance-v1'
export const DEFAULT_APPEARANCE: AppearancePreferences = {
  style: 'classic', gradient: 'none',
  from: '#117f6b', to: '#1b486d', angle: 135, dockTransparency: 90,
}

export const GRADIENT_COLORS: Record<Exclude<GradientPreset, 'none' | 'custom'>, {from:string;to:string}> = {
  mint: {from: '#087f69', to: '#294c78'},
  ocean: {from: '#075985', to: '#5b4bc4'},
  sunset: {from: '#ba4c65', to: '#8a4cba'},
  violet: {from: '#7042a3', to: '#3155a4'},
}

const isStyle = (value:unknown):value is UIStyle =>
  value === 'classic' || value === 'glass' || value === 'soft'
const isGradient = (value:unknown):value is GradientPreset =>
  value === 'none' || value === 'mint' || value === 'ocean' ||
  value === 'sunset' || value === 'violet' || value === 'custom'
const isColor = (value:unknown):value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)

/** Validate persisted values before using them in a CSS variable. */
export function normalizeAppearance(input:unknown):AppearancePreferences {
  if(!input || typeof input !== 'object' || Array.isArray(input)) return {...DEFAULT_APPEARANCE}
  const data=input as Record<string,unknown>
  const style=isStyle(data.style)?data.style:DEFAULT_APPEARANCE.style
  const gradient=isGradient(data.gradient)?data.gradient:DEFAULT_APPEARANCE.gradient
  const from=isColor(data.from)?data.from.toLowerCase():DEFAULT_APPEARANCE.from
  const to=isColor(data.to)?data.to.toLowerCase():DEFAULT_APPEARANCE.to
  const angle=typeof data.angle==='number' && Number.isInteger(data.angle) &&
    data.angle>=0 && data.angle<=360 ? data.angle : DEFAULT_APPEARANCE.angle
  const dockTransparency=typeof data.dockTransparency==='number' && Number.isInteger(data.dockTransparency) &&
    data.dockTransparency>=0 && data.dockTransparency<=100 ? data.dockTransparency : DEFAULT_APPEARANCE.dockTransparency
  return {style,gradient,from,to,angle,dockTransparency}
}

export function selectGradient(current:AppearancePreferences, gradient:GradientPreset):AppearancePreferences {
  const next=normalizeAppearance({...current,gradient})
  if(gradient==='none'||gradient==='custom')return next
  return {...next,...GRADIENT_COLORS[gradient]}
}

export function gradientCss(value:AppearancePreferences):string {
  const pref=normalizeAppearance(value)
  // Only whitelisted hex colors and a bounded integer angle can reach CSS.
  return `linear-gradient(${pref.angle}deg, ${pref.from}, ${pref.to})`
}

export function readAppearance():AppearancePreferences {
  try {
    if(typeof localStorage==='undefined')return {...DEFAULT_APPEARANCE}
    const raw=localStorage.getItem(APPEARANCE_STORAGE_KEY)
    return raw?normalizeAppearance(JSON.parse(raw)):{...DEFAULT_APPEARANCE}
  } catch { return {...DEFAULT_APPEARANCE} }
}

export function saveAppearance(value:AppearancePreferences):AppearancePreferences {
  const normalized=normalizeAppearance(value)
  try {
    if(typeof localStorage!=='undefined')
      localStorage.setItem(APPEARANCE_STORAGE_KEY,JSON.stringify(normalized))
  } catch { /* The style still applies in memory if device storage is unavailable. */ }
  return normalized
}
