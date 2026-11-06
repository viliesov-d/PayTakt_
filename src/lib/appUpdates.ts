/** Public GitHub Releases is the only trusted source for PayTakt APK updates.
 * This module never downloads or installs an APK silently.
 */
import mobileVersion from '../../mobile-version.json' with {type:'json'}

export const MOBILE_VERSION=mobileVersion.version
export const MOBILE_VERSION_CODE=mobileVersion.versionCode
const OWNER='viliesov-d'
const REPOSITORY='PayTakt_'
export const RELEASES_URL=`https://github.com/${OWNER}/${REPOSITORY}/releases`
export const RELEASE_API=`https://api.github.com/repos/${OWNER}/${REPOSITORY}/releases/latest`
const ASSET_NAME=mobileVersion.assetName

export type ReleaseInfo={
  version:string
  pageUrl:string
  apkUrl:string
  notes:string
}
export type ReleaseCheck=
  | {status:'available';release:ReleaseInfo}
  | {status:'current';release:ReleaseInfo}
  | {status:'no_release'}
  | {status:'error';message:string}

export function parseVersion(value:string):[number,number,number]|null{
  if(!/^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))return null
  const clean=value.replace(/^v/,'')
  const parts=clean.split('.').map(Number)
  return parts.length===3&&parts.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=100000)
    ?[parts[0],parts[1],parts[2]]:null
}
export function compareVersions(a:string,b:string):number{
  const left=parseVersion(a),right=parseVersion(b)
  if(!left||!right)throw Error('Некоректний номер версії APK.')
  for(let i=0;i<3;i++){
    if(left[i]!==right[i])return left[i]>right[i]?1:-1
  }
  return 0
}
export function parseRelease(input:unknown):ReleaseInfo|null{
  if(!input||typeof input!=='object')return null
  const release=input as Record<string,unknown>
  if(release.draft===true||release.prerelease===true||typeof release.tag_name!=='string')return null
  const version=release.tag_name
  if(!/^v\d+\.\d+\.\d+$/.test(version)||!parseVersion(version))return null
  const expectedPage=`${RELEASES_URL}/tag/${version}`
  if(release.html_url!==expectedPage||!Array.isArray(release.assets))return null
  const expectedAsset=`https://github.com/${OWNER}/${REPOSITORY}/releases/download/${version}/${ASSET_NAME}`
  const matching=release.assets.find(x=>
    x&&typeof x==='object'&&(x as Record<string,unknown>).name===ASSET_NAME&&
    (x as Record<string,unknown>).state==='uploaded'&&
    (x as Record<string,unknown>).browser_download_url===expectedAsset)
  if(!matching)return null
  return {
    version:version.slice(1),pageUrl:expectedPage,apkUrl:expectedAsset,
    notes:typeof release.body==='string'?release.body.slice(0,700):'',
  }
}
/** Check when the app opens or the user requests it.
 * No local credentials or Firebase data are sent to GitHub.
 */
export async function checkForUpdates(currentVersion:string,fetcher:typeof fetch=fetch):Promise<ReleaseCheck>{
  if(!parseVersion(currentVersion))return {status:'error',message:'Не вдалося визначити встановлену версію.'}
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),12000)
  try{
    const response=await fetcher(RELEASE_API,{
      method:'GET',
      headers:{Accept:'application/vnd.github+json'},
      cache:'no-store',
      signal:controller.signal,
    })
    if(response.status===404)return {status:'no_release'}
    if(!response.ok)throw Error(`GitHub API: ${response.status}`)
    const release=parseRelease(await response.json())
    if(!release)return {status:'error',message:'У GitHub Release немає перевіреного APK PayTakt.'}
    return {status:compareVersions(release.version,currentVersion)>0?'available':'current',release}
  }catch{
    return {status:'error',message:'Не вдалося перевірити оновлення. Перевір інтернет і повтори спробу.'}
  }finally{clearTimeout(timeout)}
}
type Native={
  isNativePlatform?:()=>boolean
  getPlatform?:()=>string
  Plugins?:{
    App?:{getInfo:()=>Promise<{version:string;build:string;id:string}>}
    Browser?:{open:(args:{url:string})=>Promise<void>}
  }
}
function nativeCapacitor():Native|null{
  if(typeof window==='undefined')return null
  const cap=(window as Window&{Capacitor?:Native}).Capacitor
  return cap?.isNativePlatform?.()&&cap.getPlatform?.()==='android'?cap:null
}
export function isNativeAndroidUpdate():boolean{return nativeCapacitor()!==null}
export async function installedVersion():Promise<string>{
  const plugin=nativeCapacitor()?.Plugins?.App
  if(!plugin)return MOBILE_VERSION
  try{
    const data=await plugin.getInfo()
    // Updates must use the original Android package identity, never a fork.
    if(data.id!==mobileVersion.applicationId)throw Error('Інший ідентифікатор застосунку.')
    return parseVersion(data.version)?data.version:MOBILE_VERSION
  }catch{return MOBILE_VERSION}
}
export async function openOfficialUpdate(url:string):Promise<void>{
  // Prevent untrusted URLs from being opened if a release payload is modified.
  if(!(url===RELEASES_URL||url.startsWith(`${RELEASES_URL}/`))||
     !/^https:\/\/github\.com\/viliesov-d\/PayTakt_\/releases(?:|\/tag\/v\d+\.\d+\.\d+|\/download\/v\d+\.\d+\.\d+\/PayTakt-Android-release\.apk)$/.test(url))
    throw Error('Посилання на APK не належить офіційному GitHub PayTakt.')
  const browser=nativeCapacitor()?.Plugins?.Browser
  if(browser){await browser.open({url});return}
  if(typeof window!=='undefined'){window.open(url,'_blank','noopener,noreferrer');return}
  throw Error('Неможливо відкрити сторінку оновлення.')
}
