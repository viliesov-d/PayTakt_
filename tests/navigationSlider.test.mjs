import test from 'node:test'
import assert from 'node:assert/strict'
import {navigationPosition,navigationKeyIndex} from '../src/lib/navigationSlider.ts'

test('selection follows the finger continuously between actual tab centers',()=>{
  assert.equal(navigationPosition(64,64,324,3),0)
  assert.equal(navigationPosition(129,64,324,3),.5)
  assert.equal(navigationPosition(194,64,324,3),1)
  assert.equal(navigationPosition(324,64,324,3),2)
})
test('captured drags outside the panel settle on the nearest endpoint',()=>{
  assert.equal(navigationPosition(-100,64,324,3),0)
  assert.equal(navigationPosition(900,64,324,3),2)
  assert.equal(Math.round(navigationPosition(240,64,324,3)),1)
  assert.equal(Math.round(navigationPosition(290,64,324,3)),2)
})
test('resized and single-item tracks remain valid',()=>{
  assert.equal(navigationPosition(150,50,250,3),1)
  assert.equal(navigationPosition(150,80,80,1),0)
  assert.equal(navigationPosition(150,0,0,0),0)
})
test('keyboard navigation supports arrows and endpoints without escaping the track',()=>{
  assert.equal(navigationKeyIndex('ArrowLeft',0,3),0)
  assert.equal(navigationKeyIndex('ArrowRight',0,3),1)
  assert.equal(navigationKeyIndex('ArrowRight',2,3),2)
  assert.equal(navigationKeyIndex('Home',2,3),0)
  assert.equal(navigationKeyIndex('End',0,3),2)
  assert.equal(navigationKeyIndex('Enter',1,3),null)
})
