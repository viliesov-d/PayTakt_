import {auth, firebaseApp} from './firebase'

export type AdminUser={uid:string;name:string;email:string;createdAt:string|null;lastSeenAt:string|null;platform:string;version:string}
export type AdminStats={total:number;new7:number;active1:number;active7:number;active30:number;tracked:number;platforms:number[];days:{label:string;count:number}[];updatedAt:string}
type Filter=Record<string,unknown>
const filter=(field:string,op:string,value:Record<string,unknown>):Filter=>({fieldFilter:{field:{fieldPath:field},op,value}})
const since=(field:string,date:Date)=>filter(field,'GREATER_THAN_OR_EQUAL',{timestampValue:date.toISOString()})

// Admin responses deliberately bypass the application's persistent Firestore cache.
// The ID token is checked on each refresh and sent only to Google's Firestore API.
async function client(){
  if(!auth?.currentUser||!firebaseApp)throw Error('Увійди в обліковий запис адміністратора.')
  const token=await auth.currentUser.getIdTokenResult(true)
  if(token.claims.admin!==true)throw Error('Доступ лише для адміністратора.')
  const parent=`projects/${firebaseApp.options.projectId}/databases/(default)/documents`
  return {parent,async call(method:string,body:unknown):Promise<any[]>{
    const response=await fetch(`https://firestore.googleapis.com/v1/${parent}:${method}`,{
      method:'POST',headers:{Authorization:`Bearer ${token.token}`,'Content-Type':'application/json'},
      body:JSON.stringify(body),cache:'no-store',
    })
    if(!response.ok)throw Error(response.status===403?'Немає доступу. Перевір роль адміністратора та опубліковані Firestore Rules.':'Не вдалося завантажити статистику. Перевір інтернет і повтори спробу.')
    return response.json()
  }}
}
const usersQuery=(where?:Filter)=>({from:[{collectionId:'users'}],...(where?{where}:{})})
export async function loadAdminStats():Promise<AdminStats>{
  const api=await client(),now=new Date()
  const ago=(days:number)=>new Date(now.getTime()-days*86400000)
  const count=async(where?:Filter)=>{
    const rows=await api.call('runAggregationQuery',{structuredAggregationQuery:{structuredQuery:usersQuery(where),aggregations:[{alias:'total',count:{}}]}})
    const value=rows.find(row=>row.result)?.result?.aggregateFields?.total?.integerValue
    if(value===undefined)throw Error('Сервер не повернув кількість користувачів.')
    return Number(value)
  }
  const dayStarts=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-6+i);return d})
  const [total,new7,active1,active7,active30,tracked,platforms,days]=await Promise.all([
    count(),count(since('createdAt',ago(7))),count(since('lastSeenAt',ago(1))),count(since('lastSeenAt',ago(7))),count(since('lastSeenAt',ago(30))),
    count(since('lastSeenAt',new Date(0))),
    Promise.all(['web','android','ios'].map(p=>count(filter('lastPlatform','EQUAL',{stringValue:p})))),
    Promise.all(dayStarts.map(async(start)=>{
      const end=new Date(start);end.setDate(end.getDate()+1)
      return {label:start.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'}),count:await count({compositeFilter:{op:'AND',filters:[since('createdAt',start),filter('createdAt','LESS_THAN',{timestampValue:end.toISOString()})]}})}
    })),
  ])
  return {total,new7,active1,active7,active30,tracked,platforms,days,updatedAt:now.toISOString()}
}
export async function loadAdminUsers(after?:string,search=''):Promise<{users:AdminUser[];next?:string}>{
  const api=await client()
  // Exact email lookup is explicit in the UI; pagination also includes legacy profiles without createdAt.
  const rows=await api.call('runQuery',{structuredQuery:{...usersQuery(search?filter('email','EQUAL',{stringValue:search.trim()}):undefined),
    orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:26,
    ...(after?{startAt:{values:[{referenceValue:`${api.parent}/users/${after}`}],before:false}}:{}),
    select:{fields:['displayName','email','createdAt','lastSeenAt','lastPlatform','lastAppVersion'].map(fieldPath=>({fieldPath}))},
  }})
  const docs=rows.filter(row=>row.document).map(row=>row.document)
  const users=docs.slice(0,25).map(doc=>{const f=doc.fields??{};return {uid:doc.name.split('/').pop(),name:f.displayName?.stringValue||'Користувач',email:f.email?.stringValue||'',createdAt:f.createdAt?.timestampValue??null,lastSeenAt:f.lastSeenAt?.timestampValue??null,platform:f.lastPlatform?.stringValue||'Немає даних',version:f.lastAppVersion?.stringValue||'—'}})
  return {users,next:docs.length>25?users.at(-1)?.uid:undefined}
}
