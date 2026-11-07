import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles/optical-glass.css',import.meta.url),'utf8')
const version=JSON.parse(readFileSync(new URL('../mobile-version.json',import.meta.url),'utf8'))

test('optical refraction only mounts in the installed Android application',()=>{
  assert.match(app,/const nativeOpticalGlass=isNativeAndroid&&appearance\.style==='glass'/)
  assert.match(app,/nativeOpticalGlass&&<OpticalGlass radius=\{27\}/)
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

test('next signed version can update v0.9.3 without changing app identity',()=>{
  assert.equal(version.version,'0.9.4')
  assert.equal(version.versionCode,90400)
  assert.equal(version.applicationId,'ua.paytakt.mobile')
})
