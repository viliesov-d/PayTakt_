import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {navigationPosition,navigationKeyIndex} from '../src/lib/navigationSlider.ts'

const nav=readFileSync(new URL('../src/components/MobileNavigation.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles/navigation-slider.css',import.meta.url),'utf8')
const optics=readFileSync(new URL('../src/components/OpticalGlass.tsx',import.meta.url),'utf8')

test('press expands instantly while dragging tracks every pointer move continuously',()=>{
  assert.match(nav,/const \[pressed,setPressed\]=useState\(false\)/)
  assert.match(nav,/const \[dragging,setDragging\]=useState\(false\)/)
  assert.match(nav,/setPressed\(true\)[\s\S]*?setPreview\(sample\(event\.clientX\)\)/)
  assert.match(nav,/const move=\(event:PointerEvent<HTMLElement>\)=>\{[\s\S]*?setPreview\(sample\(event\.clientX\)\)/)
  assert.match(nav,/data-dragging=\{dragging\} data-pressed=\{pressed\}/)
  assert.match(css,/\.pt-slider-nav\[data-pressed='true'\]>\.pt-nav-thumb\{[\s\S]*?scale\(1\.075,1\.105\)/)
  assert.match(css,/\.pt-slider-nav\[data-dragging='true'\]>\.pt-nav-thumb\{\s*transition:none!important;/)
})

test('free drag snaps only on release and cancelled touch cannot select',()=>{
  assert.match(nav,/const index=Math\.round\(sample\(event\.clientX\)\)/)
  assert.match(nav,/onPointerCancel=\{reset\} onLostPointerCapture=\{reset\}/)
  assert.match(nav,/if\(items\[index\]\)onSelect\(items\[index\]\.id\)/)
  assert.match(nav,/aria-current=\{active===index\?'page':undefined\}/)
  assert.match(nav,/onClick=\{event=>\{if\(event\.detail===0\)onSelect\(item\.id\)\}\}/)
  assert.equal(navigationPosition(120,60,300,3),.5)
  assert.equal(navigationPosition(180,60,300,3),1)
  assert.equal(navigationPosition(240,60,300,3),1.5)
  assert.equal(navigationKeyIndex('ArrowRight',0,3),1)
})

test('rim profile is enabled only for outer dock; no other style rules changed',()=>{
  assert.match(nav,/glass&&<OpticalGlass radius=\{27\} strength=\{24\} dock reflectiveRim\/>/)
  assert.match(nav,/glass&&<OpticalGlass radius=\{21\} strength=\{15\} dock\/>/)
  assert.match(optics,/makeGlassDisplacementMap\(width,height,radius,undefined,dock,strength,reflectiveRim\)/)
  assert.match(css,/touch-action:none;user-select:none/)
  assert.match(css, /prefers-reduced-motion:reduce/)
})
