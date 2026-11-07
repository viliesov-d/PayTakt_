import test from 'node:test'
import assert from 'node:assert/strict'
import {
  APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, GRADIENT_COLORS,
  gradientCss, normalizeAppearance, selectGradient, readAppearance, saveAppearance,
} from '../src/lib/uiPreferences.ts'

test('new and invalid preferences preserve Classic appearance',()=>{
  assert.deepEqual(normalizeAppearance(null),DEFAULT_APPEARANCE)
  assert.deepEqual(normalizeAppearance({style:'unexpected',gradient:'unknown',from:'red',to:'javascript:alert(1)',angle:999}),DEFAULT_APPEARANCE)
  assert.deepEqual(normalizeAppearance([]),DEFAULT_APPEARANCE)
})

test('preset gradients select safe colors and retain style and angle',()=>{
  const current={...DEFAULT_APPEARANCE,style:'glass',angle:225}
  const selected=selectGradient(current,'sunset')
  assert.deepEqual(selected,{...current,...GRADIENT_COLORS.sunset,gradient:'sunset'})
  assert.equal(gradientCss(selected),'linear-gradient(225deg, #ba4c65, #8a4cba)')
  const custom=selectGradient(selected,'custom')
  assert.equal(custom.style,'glass')
  assert.equal(custom.from,selected.from)
})

test('editable colors are validated and cannot inject CSS',()=>{
  const input={style:'soft',gradient:'custom',from:'#aabbcc',to:'#112233',angle:315}
  assert.deepEqual(normalizeAppearance(input),input)
  assert.equal(gradientCss(input),'linear-gradient(315deg, #aabbcc, #112233)')
  const escaped=normalizeAppearance({...input,from:'red);background:url(https://example.com)',angle:Infinity})
  assert.equal(escaped.from,DEFAULT_APPEARANCE.from)
  assert.equal(escaped.angle,DEFAULT_APPEARANCE.angle)
})

test('device appearance round-trips and recovers from invalid storage',()=>{
  const previous=globalThis.localStorage
  const storage=new Map()
  globalThis.localStorage={
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,value),
  }
  try{
    const custom={style:'glass',gradient:'custom',from:'#123456',to:'#abcdef',angle:45}
    assert.deepEqual(saveAppearance(custom),custom)
    assert.equal(storage.has(APPEARANCE_STORAGE_KEY),true)
    assert.deepEqual(readAppearance(),custom)
    storage.set(APPEARANCE_STORAGE_KEY,'{invalid')
    assert.deepEqual(readAppearance(),DEFAULT_APPEARANCE)
  }finally{
    if(previous===undefined)delete globalThis.localStorage
    else globalThis.localStorage=previous
  }
})

test('blocked device storage never crashes the app',()=>{
  const previous=globalThis.localStorage
  globalThis.localStorage={
    getItem(){throw Error('storage blocked')},
    setItem(){throw Error('storage blocked')},
  }
  try{
    assert.deepEqual(readAppearance(),DEFAULT_APPEARANCE)
    assert.equal(saveAppearance({...DEFAULT_APPEARANCE,style:'soft'}).style,'soft')
  }finally{
    if(previous===undefined)delete globalThis.localStorage
    else globalThis.localStorage=previous
  }
})
