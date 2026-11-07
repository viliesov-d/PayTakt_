import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const manifest=JSON.parse(readFileSync(new URL('../mobile-version.json',import.meta.url),'utf8'))
const workflow=readFileSync(new URL('../.github/workflows/android-release.yml',import.meta.url),'utf8')

test('Android release has a stable package identity and a matching versionCode',()=>{
  assert.match(manifest.version,/^[0-9]+[.][0-9]+[.][0-9]+$/)
  const [major,minor,patch]=manifest.version.split('.').map(Number)
  assert.ok(minor<=99&&patch<=99)
  assert.equal(manifest.versionCode,major*1000000+minor*10000+patch*100)
  assert.equal(manifest.applicationId,'ua.paytakt.mobile')
  assert.equal(manifest.assetName,'PayTakt-Android-release.apk')
})

test('manual release reads the committed manifest, not a typed version',()=>{
  assert.match(workflow,/workflow_dispatch:/)
  assert.doesNotMatch(workflow,/inputs[.]version|required: true\s+type: string/)
  assert.match(workflow,/RELEASE_VERSION="\$\(node -p/)
  assert.match(workflow,/mobile-version[.]json/)
  assert.match(workflow,/GITHUB_ENV/)
  assert.match(workflow,/f[.]versionCode!==expected/)
  assert.match(workflow,/gh release create/)
  assert.match(workflow,/env[.]RELEASE_VERSION/)
})
