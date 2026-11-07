import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {glassEdgeVector} from '../src/lib/glassOptics.ts'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const nav=readFileSync(new URL('../src/components/MobileNavigation.tsx',import.meta.url),'utf8')
const sliderCss=readFileSync(new URL('../src/styles/navigation-slider.css',import.meta.url),'utf8')
const appearance=readFileSync(new URL('../src/components/AppearanceSettings.tsx',import.meta.url),'utf8')
const optical=readFileSync(new URL('../src/components/OpticalGlass.tsx',import.meta.url),'utf8')

test('two independent optical lenses exist without changing the original dock lens',()=>{
  assert.match(nav, /glass&&<OpticalGlass radius=\{27\} strength=\{24\} dock\/>/)
  assert.match(nav, /<span className="pt-nav-thumb"[^>]*>[\s\S]*?glass&&<OpticalGlass radius=\{21\} strength=\{15\} dock\/>/)
  assert.match(optical, /makeGlassDisplacementMap\(width,height,radius,undefined,dock,strength\)/)
  assert.match(nav, /onPointerDown=\{down\} onPointerMove=\{move\} onPointerUp=\{up\}/)
  assert.match(nav, /onKeyDown=\{event=>key\(event,index\)\}/)
})

test('secondary capsule refraction is concentrated near its rounded edges',()=>{
  const w=100,h=61,r=21,bezel=19.52
  assert.deepEqual(glassEdgeVector(w/2,h/2,w,h,r,bezel,true,15),{x:0,y:0})
  assert.deepEqual(glassEdgeVector(w/2,0,w,h,r,bezel,true,15),{x:0,y:0})
  assert.ok(glassEdgeVector(w/2,8,w,h,r,bezel,true,15).y<0)
  assert.ok(glassEdgeVector(8,h/2,w,h,r,bezel,true,15).x<0)
})

test('transparency slider updates the installed Android dock tint only',()=>{
  assert.match(appearance,/value\.style==='glass'&&<div className="appearance-dock-control"/)
  assert.match(appearance,/id="appearance-dock-transparency" type="range" min="0" max="100" step="5"/)
  assert.match(appearance,/onChange=\{e=>onChange\(\{\.\.\.value,dockTransparency:Number\(e\.target\.value\)\}\)\}/)
  assert.match(app,/dockTransparency=\{appearance\.dockTransparency\}/)
  assert.match(nav,/--pt-dock-tint-alpha':dockOverlayAlpha\(dockTransparency\)/)
  assert.match(sliderCss,/background:rgba\(28,62,77,var\(--pt-dock-tint-alpha/)
  assert.match(sliderCss,/background:rgba\(190,216,230,var\(--pt-dock-tint-alpha/)
})

test('lens stays within the moving thumb and avoids an outer white halo',()=>{
  assert.match(sliderCss,/\.pt-slider-nav>\.pt-nav-thumb>\.pt-optical-glass/)
  assert.match(sliderCss,/\.pt-slider-nav>\.pt-nav-thumb\{[\s\S]*?overflow:hidden/)
  assert.match(sliderCss,/\.pt-slider-nav>\.pt-nav-thumb>\.pt-optical-glass::before\{[\s\S]*?border:0!important/)
  assert.match(sliderCss, /prefers-reduced-transparency:reduce/)
  assert.match(sliderCss, /\.pt-slider-nav>\.pt-dock-glass\.pt-optical-glass-ready\{\s*background:var\(--panel\)!important/)
  assert.match(sliderCss, /pointer-events:none/)
  assert.doesNotMatch(sliderCss, /position:fixed/)
})
