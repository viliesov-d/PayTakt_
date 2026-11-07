import test from 'node:test'
import assert from 'node:assert/strict'
import {roundedRectDistance,glassEdgeVector,makeGlassDisplacementMap} from '../src/lib/glassOptics.ts'

test('rounded rectangle distance is negative inside and positive outside',()=>{
  assert.ok(roundedRectDistance(180,40,360,80,27)<0)
  assert.ok(roundedRectDistance(0,0,360,80,27)>0)
  assert.ok(Math.abs(roundedRectDistance(180,0,360,80,27))<1e-9)
})

test('convex optical edge changes the sampled backdrop, not the center',()=>{
  const center=glassEdgeVector(180,40,360,80,27)
  const left=glassEdgeVector(5,40,360,80,27)
  const right=glassEdgeVector(355,40,360,80,27)
  const top=glassEdgeVector(180,4,360,80,27)
  assert.deepEqual(center,{x:0,y:0})
  assert.ok(left.x<-0.05)
  assert.ok(right.x>0.05)
  assert.ok(top.y<-.05)
  assert.ok(Number.isFinite(top.x)&&Number.isFinite(top.y))
})

test('lens displacement map limits image resolution on large dialogs',()=>{
  let size={width:0,height:0}
  let pixels
  const mockCanvas={
    width:0,height:0,
    getContext(){
      return {
        createImageData(w,h){
          pixels=new Uint8ClampedArray(w*h*4)
          size={width:w,height:h}
          return {data:pixels}
        },
        putImageData(){},
      }
    },
    toDataURL(){return 'data:image/png;base64,mock'},
  }
  const map=makeGlassDisplacementMap(540,820,25,()=>mockCanvas)
  assert.ok(map)
  assert.deepEqual([map.width,map.height],[540,820])
  assert.ok(size.width*size.height<=126000)
  assert.equal(pixels[3],255)
  assert.match(map.dataUrl,/^data:image\/png/)
})

test('invalid dimensions never make an optical map',()=>{
  assert.equal(makeGlassDisplacementMap(0,50,20),null)
  assert.equal(makeGlassDisplacementMap(NaN,70,20),null)
})
