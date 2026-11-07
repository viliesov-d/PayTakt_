import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles/optical-glass.css',import.meta.url),'utf8')
const version=JSON.parse(readFileSync(new URL('../mobile-version.json',import.meta.url),'utf8'))

test('optical refraction only mounts in the installed Android application',()=>{
  assert.match(app,/const nativeOpticalGlass=isNativeAndroid&&appearance\.style==='glass'/)
  assert.match(app,/nativeOpticalGlass&&<OpticalGlass radius=\{27\} strength=\{12\} dock/)
  assert.doesNotMatch(app,/<OpticalGlass radius=\{35\}/)
  assert.match(css,/:root:not\(\.paytakt-native-android\)\[data-ui-style='glass'\] \.zmina-primary-nav/)
})

test('glass skin never changes positioning of all optical hosts',()=>{
  const match=css.match(/:root\[data-ui-style='glass'\] \.app-shell \.pt-optical-host\{([^}]+)\}/)
  assert.ok(match,'host style declaration must exist')
  assert.doesNotMatch(match[1],/position\s*:/)
})

test('Android dock remains fixed, floating, with three navigation slots',()=>{
  assert.match(css,/html\.paytakt-native-android\[data-ui-style='glass'\] \.app-shell \.paytakt-mobile-tabs\.pt-optical-host\{\s*position:fixed;/)
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
  assert.match(css,/bottom:calc\(10px \+ env\(safe-area-inset-bottom,0px\)\)/)
})

test('only the Android dock has a clear border, while remaining fixed',()=>{
  const outer=css.match(/html\.paytakt-native-android\[data-ui-style='glass'\] \.app-shell \.paytakt-mobile-tabs\.pt-optical-host\{([\s\S]*?)\n  \}/)
  const inner=css.match(/html\.paytakt-native-android\[data-ui-style='glass'\] \.app-shell \.paytakt-mobile-tabs\.pt-optical-host>\.pt-optical-glass\{([\s\S]*?)\n  \}/)
  assert.ok(outer,'floating dock CSS rule must exist')
  assert.ok(inner,'glass layer CSS rule must exist')
  assert.match(outer[1],/position:fixed;/)
  assert.match(outer[1],/border:1px solid transparent;/)
  assert.match(inner[1],/border:1px solid transparent;/)
  assert.match(css,/\.pt-optical-glass::before\{\s*border-color:transparent;/)
})

test('signed Android version is higher than the previous release',()=>{
  assert.match(version.version,/^\d+\.\d+\.\d+$/)
  assert.ok(Number.isInteger(version.versionCode))
  assert.ok(version.versionCode>90400)
  assert.equal(version.applicationId,'ua.paytakt.mobile')
})

test('Android dock disables only its white optical halo layers',()=>{
  const start=css.indexOf('v0.9.6 — remove the broad pale halo')
  assert.ok(start>0,'targeted halo override must exist')
  const override=css.slice(start)
  assert.ok(override.includes('.paytakt-mobile-tabs.pt-optical-host>.pt-optical-glass'))
  assert.ok(override.includes('background:rgba(25,64,82,.08)!important;'))
  assert.ok(override.includes('box-shadow:none!important;'))
  assert.ok(override.includes('content:none!important;'))
  assert.ok(override.includes('display:none!important;'))
  // The previous fixed dock rule and 3 tap targets must remain unchanged.
  assert.match(css,/position:fixed;/)
  assert.ok(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'))
})

test('Android dock restores a soft lens without the refractive rim or white glow',()=>{
  const nav=app.slice(app.indexOf('aria-label="Навігація PayTakt Mobile"'))
  assert.match(nav,/<OpticalGlass radius=\{27\} strength=\{12\} dock/)
  const marker=css.indexOf('Dock refraction uses a lens')
  assert.ok(marker>0)
  const cleanup=css.slice(marker)
  assert.match(cleanup,/box-shadow:none!important;/)
  assert.match(cleanup,/border-color:transparent!important;/)
  assert.match(cleanup,/backdrop-filter:blur\(18px\)/)
  assert.ok(!cleanup.includes('position:fixed'))
  // Other dialogs retain the real optical lens implementation.
  assert.match(app, /glass&&<OpticalGlass radius=\{23\}/)
})
