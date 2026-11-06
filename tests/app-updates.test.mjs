import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  MOBILE_VERSION,MOBILE_VERSION_CODE,parseVersion,compareVersions,parseRelease,
  checkForUpdates,RELEASES_URL,RELEASE_API,
} from '../src/lib/appUpdates.ts'

const release=(version='0.9.1')=>({
  tag_name:'v'+version,
  name:'PayTakt Mobile v'+version,
  html_url:RELEASES_URL+'/tag/v'+version,
  draft:false,
  prerelease:false,
  body:'Bug fixes and improved offline mode',
  assets:[{
    name:'PayTakt-Android-release.apk',state:'uploaded',
    browser_download_url:RELEASES_URL+'/download/v'+version+'/PayTakt-Android-release.apk',
  }],
})

test('current mobile version agrees with shared package, Android versionCode increases',()=>{
  const version=JSON.parse(readFileSync(new URL('../mobile-version.json',import.meta.url),'utf8'))
  assert.equal(MOBILE_VERSION,version.version)
  assert.equal(MOBILE_VERSION_CODE,version.versionCode)
  assert.equal(version.applicationId,'ua.paytakt.mobile')
  assert.ok(Number.isInteger(MOBILE_VERSION_CODE)&&MOBILE_VERSION_CODE>100)
  const script=readFileSync(new URL('../scripts/set-android-version.mjs',import.meta.url),'utf8')
  assert.match(script,/versionCode/)
  assert.match(script,/versionName/)
})

test('semver comparison uses numeric components, not lexical ordering',()=>{
  assert.deepEqual(parseVersion('v0.9.0'),[0,9,0])
  assert.equal(compareVersions('0.10.0','0.9.9'),1)
  assert.equal(compareVersions('v0.9.0','0.9.0'),0)
  assert.equal(compareVersions('0.9.0','0.9.1'),-1)
  assert.equal(parseVersion('0.9.0-beta.1'),null)
  assert.equal(parseVersion('../0.9.0'),null)
  assert.equal(parseVersion('v01.2.3'),null)
})

test('only a complete official GitHub Release with exact APK path is accepted',()=>{
  const valid=parseRelease(release())
  assert.equal(valid?.version,'0.9.1')
  assert.equal(valid?.apkUrl,RELEASES_URL+'/download/v0.9.1/PayTakt-Android-release.apk')
  assert.equal(parseRelease({...release(),draft:true}),null)
  assert.equal(parseRelease({...release(),prerelease:true}),null)
  assert.equal(parseRelease({...release(),html_url:'https://evil.example/update'}),null)
  assert.equal(parseRelease({...release(),assets:[{...release().assets[0],browser_download_url:'https://evil.example/malware.apk'}]}),null)
  assert.equal(parseRelease({...release(),assets:[]}),null)
  assert.equal(parseRelease({...release(),tag_name:'v99.99.0',html_url:'https://evil.example'}),null)
})

test('new release, up-to-date and no-release states are distinct',async()=>{
  const get=async()=>({ok:true,status:200,json:async()=>release('0.9.1')})
  const out=await checkForUpdates('0.9.0',get)
  assert.equal(out.status,'available')
  const same=await checkForUpdates('0.9.1',get)
  assert.equal(same.status,'current')
  const missing=await checkForUpdates('0.9.0',async()=>({ok:false,status:404}))
  assert.deepEqual(missing,{status:'no_release'})
  const failed=await checkForUpdates('0.9.0',async()=>{throw Error('offline')})
  assert.equal(failed.status,'error')
  assert.match(RELEASE_API,/api.github.com\/repos\/viliesov-d\/PayTakt_\/releases\/latest/)
})

test('workspace confirmation is yes/no and statistics title omits tax caveat',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
  const stats=readFileSync(new URL('../src/components/StatisticsPage.tsx',import.meta.url),'utf8')
  assert.match(app,/tr\('Ви впевнені\?'\)/)
  assert.doesNotMatch(app,/tr\('Для підтвердження введи точну назву простору'\)/)
  assert.match(stats,/tr\("Нарахування"\)/)
  assert.doesNotMatch(stats,/tr\("Нараховано до податків"\)/)
})

test('release workflow requires permanent signing secrets and verifies certificate',()=>{
  const flow=readFileSync(new URL('../.github/workflows/android-release.yml',import.meta.url),'utf8')
  for(const key of ['ANDROID_KEYSTORE_BASE64','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD'])assert.match(flow,new RegExp(key))
  assert.match(flow,/assembleRelease/)
  assert.match(flow,/apksigner/)
  assert.match(flow,/zipalign/)
  assert.match(flow,/gh release create/)
  assert.doesNotMatch(flow,/keytool -genkeypair/)
})
