import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gradientCss,normalizeAppearance,selectGradient,DEFAULT_APPEARANCE} from '../src/lib/uiPreferences.ts'

const css=readFileSync(new URL('../src/styles/navigation-slider.css',import.meta.url),'utf8')
const optical=readFileSync(new URL('../src/components/OpticalGlass.tsx',import.meta.url),'utf8')
const panelOptics=readFileSync(new URL('../src/styles/optical-glass.css',import.meta.url),'utf8')
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const navigation=readFileSync(new URL('../src/components/MobileNavigation.tsx',import.meta.url),'utf8')

test('pressed Glass capsule extends slightly beyond the panel without altering its fixed dock',()=>{
  assert.match(css,/\.pt-slider-nav\[data-pressed='true'\]\{\s*overflow:visible;/)
  assert.match(css,/\.pt-slider-nav\[data-pressed='true'\]>\.pt-nav-thumb\{\s*top:0;bottom:0;/)
  assert.match(css,/scale\(1\.075,1\.105\)/)
  const dockHeight=61+2*7+2 // minimum button height, padding, transparent borders
  const apparentTop=-(dockHeight*(1.105-1))/2
  assert.ok(apparentTop < -3 && apparentTop > -6,
    'pressed glass should project a few px beyond the top and bottom edges')
  assert.match(panelOptics,/\.paytakt-mobile-tabs\.pt-optical-host\{[\s\S]*?position:fixed;/)
  assert.match(navigation,/data-dragging=\{dragging\} data-pressed=\{pressed\}/)
})

test('gradient color follows chosen appearance and stays translucent',()=>{
  assert.match(app,/root\.dataset\.uiGradient=appearance\.gradient==='none'\?'off':'on'/)
  assert.match(app,/root\.style\.setProperty\('--pt-gradient',gradientCss\(appearance\)\)/)
  assert.match(css,/\[data-ui-style='glass'\]\[data-ui-gradient='on'\][\s\S]*?\.pt-nav-thumb::after\{[\s\S]*?background:var\(--pt-gradient\);\s*opacity:\.34;/)
  const minted=selectGradient({...DEFAULT_APPEARANCE,style:'glass'},'mint')
  const sunset=selectGradient(minted,'sunset')
  assert.notEqual(gradientCss(minted),gradientCss(sunset))
  const custom=normalizeAppearance({...sunset,gradient:'custom',from:'#aabbcc',to:'#112233'})
  assert.match(gradientCss(custom),/#aabbcc, #112233/)
  assert.match(css,/prefers-reduced-transparency:reduce[\s\S]*?\.pt-nav-thumb::after\{\s*opacity:0;/)
})

test('optical surface, active capsule lens, controls, and other styles are untouched',()=>{
  assert.match(navigation,/<OpticalGlass radius=\{27\} strength=\{24\} dock reflectiveRim\/>/)
  assert.match(navigation,/<OpticalGlass radius=\{21\} strength=\{15\} dock\/>/)
  assert.match(optical,/makeGlassDisplacementMap\(width,height,radius,undefined,dock,strength,reflectiveRim\)/)
  assert.match(css,/\.pt-slider-nav>\.pt-nav-thumb\{[\s\S]*?overflow:hidden;/)
  assert.match(css,/\.pt-slider-nav\[data-dragging='true'\]>\.pt-nav-thumb\{\s*transition:none!important;/)
  assert.match(css,/touch-action:none;user-select:none/)
  assert.match(css,/\.pt-slider-nav>button\{[\s\S]*?min-height:61px;/)
  // The new appearance only applies to native Android Liquid Glass.
  assert.match(css,/html:is\(\.paytakt-native-android,\.paytakt-native-ios\)\[data-ui-style='glass'\]/)
})
