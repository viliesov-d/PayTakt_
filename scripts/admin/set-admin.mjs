// Run only on a trusted machine with Application Default Credentials.
import {initializeApp,applicationDefault} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
const [projectId,uid,action]=process.argv.slice(2)
if(!projectId||!uid||!['grant','revoke'].includes(action)){
  console.error('Usage: node scripts/admin/set-admin.mjs PROJECT_ID USER_UID grant|revoke');process.exit(1)
}
initializeApp({credential:applicationDefault(),projectId})
const auth=getAuth(),user=await auth.getUser(uid)
const claims={...user.customClaims}
if(action==='grant')claims.admin=true
else delete claims.admin
await auth.setCustomUserClaims(uid,claims)
if(action==='revoke')await auth.revokeRefreshTokens(uid)
console.log(`${action}: ${user.uid} (${user.email||'no email'}). Sign in again to refresh claims.`)
