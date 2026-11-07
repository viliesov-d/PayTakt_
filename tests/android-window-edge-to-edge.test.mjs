import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {setAndroidSystemBarContrast} from '../src/lib/nativeSystemBars.ts'

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const script=file('scripts/configure-android-window.mjs')
const setup=file('scripts/setup-android.mjs')
const css=file('src/styles/android-window.css')
const main=file('src/main.tsx')
const app=file('src/App.tsx')
const config=JSON.parse(file('capacitor.config.json'))

test('Android build reproducibly sets translucent system bars and removes WebView stretch',()=>{
  assert.match(setup,/run\('node', \['scripts\/configure-android-window\.mjs'\]\)/)
  assert.ok(setup.indexOf('scripts/configure-android-window.mjs')>setup.indexOf("'cap', 'add', 'android'"))
  assert.match(script,/PAYTAKT_EDGE_TO_EDGE_AND_NO_STRETCH/)
  assert.match(script,/EdgeToEdge\.enable\(this\)/)
  assert.match(script,/setNavigationBarContrastEnforced\(false\)/)
  assert.match(script,/setOverScrollMode\(View\.OVER_SCROLL_NEVER\)/)
  assert.match(script,/Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.R/)
  assert.match(script,/getWindow\(\)\.setStatusBarColor|window\.setStatusBarColor/)
  assert.match(script,/window\.setNavigationBarColor/)
  assert.match(script,/if\(!expected\.test\(source\)\)/)
})

test('transparent Android bars use safe insets but preserve the OS status and gestures',()=>{
  assert.equal(config.plugins.SystemBars.insetsHandling,'css')
  assert.equal(config.plugins.SystemBars.initialViewportFitValueHint,'cover')
  assert.equal(config.plugins.SystemBars.hidden,false)
  assert.match(file('index.html'),/initial-scale=1, viewport-fit=cover/)
  assert.match(main,/import '\.\/styles\/android-window\.css'/)
  assert.match(css,/--pt-safe-top:max\(env\(safe-area-inset-top,0px\),var\(--safe-area-inset-top,0px\)\)/)
  assert.match(css,/--pt-safe-bottom:max\(env\(safe-area-inset-bottom,0px\),var\(--safe-area-inset-bottom,0px\)\)/)
  assert.match(css,/\.zmina-site-header\{\s*padding-top:var\(--pt-safe-top\)/)
  assert.match(css,/\.pt-slider-nav\{\s*bottom:calc\(10px \+ var\(--pt-safe-bottom\)\)/)
  assert.match(css,/\.main-content\{\s*padding-bottom:calc\(116px \+ var\(--pt-safe-bottom\)\)/)
  assert.doesNotMatch(css,/pt-optical-glass|pt-nav-thumb|glassReflectiveRimVector/)
})

test('Android rubber-band scrolling is disabled without blocking ordinary scrolling',()=>{
  assert.match(css,/overscroll-behavior-y:none/)
  assert.doesNotMatch(css,/touch-action:none|overflow:hidden|position:fixed/)
  assert.match(script,/View\.OVER_SCROLL_NEVER/)
  assert.doesNotMatch(script,/requestDisallowInterceptTouchEvent/)
})

test('Android system icons track the current appearance; web pages are unaffected',async()=>{
  const writes=[]
  const android={isNativePlatform:()=>true,getPlatform:()=> 'android',
    Plugins:{SystemBars:{setStyle:async args=>{writes.push(args.style)}}}}
  setAndroidSystemBarContrast(false,android)
  setAndroidSystemBarContrast(true,android)
  setAndroidSystemBarContrast(true,{...android,getPlatform:()=> 'web'})
  setAndroidSystemBarContrast(false,{...android,isNativePlatform:()=>false})
  await Promise.resolve()
  assert.deepEqual(writes,['LIGHT','DARK'])
  assert.match(app,/if\(isNativeAndroid\)setAndroidSystemBarContrast\(dark\)/)
  assert.match(app,/\},\[theme,isNativeAndroid\]\)/)
  assert.doesNotThrow(()=>setAndroidSystemBarContrast(false,undefined))
})
