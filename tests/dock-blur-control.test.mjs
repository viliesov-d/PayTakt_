import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {DEFAULT_APPEARANCE,normalizeAppearance,dockFrostBlurPx,dockOpticalBlurPx} from '../src/lib/uiPreferences.ts'

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const app=read('../src/App.tsx')
const native=read('../src/components/MobileNavigation.tsx')
const browser=read('../src/components/WebMobileNavigation.tsx')
const lens=read('../src/components/OpticalGlass.tsx')
const appearance=read('../src/components/AppearanceSettings.tsx')
const nativeCss=read('../src/styles/optical-glass.css')
const browserCss=read('../src/styles/web-liquid-dock.css')

test('existing appearance choices migrate with original blur preserved',()=>{
  assert.equal(DEFAULT_APPEARANCE.dockBlur,50)
  assert.equal(normalizeAppearance({style:'glass',dockTransparency:90}).dockBlur,50)
  assert.equal(normalizeAppearance({style:'soft',dockBlur:80}).style,'soft')
  assert.equal(normalizeAppearance({dockBlur:-1}).dockBlur,50)
  assert.equal(normalizeAppearance({dockBlur:101}).dockBlur,50)
  assert.equal(normalizeAppearance({dockBlur:21.5}).dockBlur,50)
  assert.equal(normalizeAppearance({dockBlur:'70'}).dockBlur,50)
  for(const x of [0,5,50,100]){
    assert.equal(normalizeAppearance({dockBlur:x}).dockBlur,x)
  }
})
test('0 to 100 slider maps to valid CSS blur while retaining old default',()=>{
  assert.equal(dockFrostBlurPx(0),0)
  assert.equal(dockFrostBlurPx(50),18)
  assert.equal(dockFrostBlurPx(50,true),19)
  assert.equal(dockFrostBlurPx(100),36)
  assert.equal(dockFrostBlurPx(100,true),38)
  assert.equal(dockOpticalBlurPx(0),0)
  assert.equal(dockOpticalBlurPx(50),.65)
  assert.ok(dockOpticalBlurPx(100)>dockOpticalBlurPx(50))
  assert.equal(dockOpticalBlurPx(NaN),.65)
  assert.equal(dockOpticalBlurPx(-30),0)
  assert.ok(dockFrostBlurPx(500,true)<=38)
})
test('slider only renders for Liquid Glass, next to existing transparency',()=>{
  assert.match(appearance,/value.style==='glass'&&<div className="appearance-dock-control"/)
  assert.match(appearance,/id="appearance-dock-transparency"/)
  assert.match(appearance,/id="appearance-dock-blur" type="range" min="0" max="100" step="5"/)
  assert.match(appearance,/value=\{value.dockBlur\}/)
  assert.match(appearance,/onChange=\{e=>onChange\(\{\.\.\.value,dockBlur:Number\(e.target.value\)\}\)\}/)
  assert.match(app,/dockBlur=\{appearance.dockBlur\}/)
})
test('native and browser outer panels expose distinct blur values without affecting thumb',()=>{
  assert.match(native,/--pt-dock-frost-blur':dockFrostBlurPx\(dockBlur\)/)
  assert.match(browser,/--pt-dock-frost-blur':dockFrostBlurPx\(dockBlur,true\)/)
  assert.match(native,/--pt-dock-optical-blur':dockOpticalBlurPx\(dockBlur\)/)
  assert.match(browser,/--pt-dock-optical-blur':dockOpticalBlurPx\(dockBlur\)/)
  assert.match(lens,/dock&&reflectiveRim\?'var\(--pt-dock-optical-blur,0\.65px\)'/)
  assert.match(lens,/dock\?'0\.65px':'3px'/)
  assert.match(nativeCss,/\.pt-dock-glass\{\s*-webkit-backdrop-filter:blur\(var\(--pt-dock-frost-blur,18px\)\)/)
  assert.match(browserCss,/\.pt-dock-glass\{\s*-webkit-backdrop-filter:blur\(var\(--pt-dock-frost-blur,19px\)\)/)
  assert.match(browserCss,/\[data-ui-style='glass'\]/)
  assert.doesNotMatch(browserCss,/\.pt-web-slider\.pt-optical-host > \.pt-nav-thumb\{[\s\S]*?blur\(var\(--pt-dock-frost-blur/)
})
