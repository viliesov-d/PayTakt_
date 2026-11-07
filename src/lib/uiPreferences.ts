/** Device-local visual preferences. No Firestore schema changes or payroll side effects. */
export type UIStyle = 'classic' | 'glass' | 'soft'
export type GradientPreset = 'none' | 'mint' | 'ocean' | 'sunset' | 'violet' | 'custom'
export type AppearancePreferences = {
  style: UIStyle
  gradient: GradientPreset
  from: string
  to: string
  angle: number
  /** Liquid Glass dock overlay transparency (0 = opaque, 100 = clearest). */
  dockTransparency: number
  /** Liquid Glass dock blur strength (0..100, 50 = original appearance). */
  dockBlur: number
}

export const APPEARANCE_STORAGE_KEY = 'paytakt-appearance-v1'
export const DEFAULT_APPEARANCE: AppearancePreferences = {
  style: 'classic', gradient: 'none',
  from: '#117f6b', to: '#1b486d', angle: 135, dockTransparency: 90, dockBlur: 50,
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
  const dockBlur=typeof data.dockBlur==='number' && Number.isInteger(data.dockBlur) &&
    data.dockBlur>=0 && data.dockBlur<=100 ? data.dockBlur : DEFAULT_APPEARANCE.dockBlur
  return {style,gradient,from,to,angle,dockTransparency,dockBlur}
}

/** Transparency changes the tint, not the optical distortion or the click targets.
 * The default of 90% maps close to the existing v0.9.13 dock tint (~0.10).
 */
export function dockOverlayAlpha(transparency:number):number {
  const safe=Number.isFinite(transparency)?Math.min(100,Math.max(0,transparency)):DEFAULT_APPEARANCE.dockTransparency
  return Math.round((0.75-0.73*safe/100)*1000)/1000
}

/** The normal 50% position preserves the original platform-specific fallback.
 * The stronger half lets users visibly change the frosted result without
 * altering the dock's geometry, displacement map or optical edge strength. */
export function dockFrostBlurPx(blur:number,web=false):number{
  const safe=Number.isFinite(blur)?Math.min(100,Math.max(0,blur)):DEFAULT_APPEARANCE.dockBlur
  return Math.round(safe*(web?19:18)/50)
}
/** The SVG-refracted backdrop uses a lower blur to keep refraction visible.
 * At 50% this remains exactly the old 0.65px setting. */
export function dockOpticalBlurPx(blur:number):number{
  const safe=Number.isFinite(blur)?Math.min(100,Math.max(0,blur)):DEFAULT_APPEARANCE.dockBlur
  const value=safe<=50?safe*.65/50:.65+(safe-50)*.13
  return Math.round(value*100)/100
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
