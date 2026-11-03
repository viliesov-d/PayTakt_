import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname,join} from 'node:path'
import {defaultPaySettings} from '../src/lib/salary.ts'
import {verifyPaySettingsFirestoreShape} from '../src/lib/paySettingsRulesCheck.ts'
import {preparePaySettingsWrite} from '../src/lib/paySettingsPayload.ts'

const rules=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'..','firestore.rules'),'utf8')
const payMatch=rules.match(/match \/paySettings\/\{payId\}\s*\{([^}]+)\}/)

// Static rule tests: confirm intended guards are present. Emulator-backed
// integration testing is still necessary to verify actual Firestore behavior.
test('paySettings route is scoped to current and authenticated workspace owner',()=>{
  assert.ok(payMatch, 'paySettings/current route must exist')
  assert.match(payMatch[1],/allow get:\s*if payId == 'current' && ownWorkspace\(workspaceId\)/)
  assert.match(payMatch[1],/allow list, delete:\s*if false/)
  assert.match(payMatch[1],/allow create, update:\s*if payId == 'current'\s*&& ownWorkspace\(workspaceId\)\s*&& request\.resource\.data\.version == 5/)
})

test('workspace owner guard checks authenticated UID against stored owner',()=>{
  assert.match(rules,/function ownWorkspace\(workspaceId\)\s*\{[\s\S]*?request\.auth\.uid/)
  assert.match(rules,/\.data\.ownerUid == request\.auth\.uid/)
})

test('a typical v5 pay document is validated before Firebase write',()=>{
  const payload=preparePaySettingsWrite(structuredClone(defaultPaySettings))
  assert.equal(payload.version,5)
  assert.deepEqual(verifyPaySettingsFirestoreShape(payload),[])
})
