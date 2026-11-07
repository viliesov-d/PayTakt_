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

test('dock lens fades at the boundary but still refracts inside the bezel',()=>{
  assert.deepEqual(glassEdgeVector(180,0,360,80,27,18,true),{x:0,y:0})
  assert.ok(Math.abs(glassEdgeVector(180,.01,360,80,27,18,true).y)<.001)
  assert.ok(glassEdgeVector(180,9,360,80,27,18,true).y<-.9)
  assert.deepEqual(glassEdgeVector(180,20,360,80,27,18,true),{x:0,y:0})
  // At the dock's scale, sampling must not cross the straight outer edge.
  for(let depth=.1;depth<18;depth+=.1){
    const v=glassEdgeVector(180,depth,360,80,27,18,true)
    assert.ok(Math.abs(v.y)*12*117/255<=depth)
  }
})

test('strong dock refraction keeps samples inside straight and rounded edges',()=>{
  const width=360,height=78,radius=27,bezel=height*.32,scale=24
  let maximumOffset=0
  for(let y=.5;y<height;y+=1){
    for(let x=.5;x<width;x+=1){
      const distance=roundedRectDistance(x,y,width,height,radius)
      const v=glassEdgeVector(x,y,width,height,radius,bezel,true,scale)
      const dx=v.x*scale*117/255,dy=v.y*scale*117/255
      const offset=Math.hypot(dx,dy)
      maximumOffset=Math.max(maximumOffset,offset)
      if(distance>=0){assert.equal(offset,0);continue}
      assert.ok(offset<=-distance*.75+1e-9)
      assert.ok(roundedRectDistance(x+dx,y+dy,width,height,radius)<=0)
    }
  }
  // Stronger visible bending than the previous 12px-scale lens (~5.5px max).
  assert.ok(maximumOffset>7)
  assert.deepEqual(glassEdgeVector(180,39,width,height,radius,bezel,true,scale),{x:0,y:0})
})
