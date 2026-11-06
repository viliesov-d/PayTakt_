/** Version the generated Capacitor Android project without committing secrets or
 * the generated /android directory. Both debug and release use one versionCode.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const root=new URL('../',import.meta.url)
const info=JSON.parse(readFileSync(new URL('mobile-version.json',root),'utf8'))
const config=JSON.parse(readFileSync(new URL('capacitor.config.json',root),'utf8'))
if(!/^\d+\.\d+\.\d+$/.test(info.version)||!Number.isSafeInteger(info.versionCode)||
    info.versionCode<1||info.versionCode>2100000000||info.applicationId!==config.appId){
  throw Error('mobile-version.json не збігається з Capacitor або має некоректну версію.')
}
const path=fileURLToPath(new URL('android/app/build.gradle',root))
if(!existsSync(path))throw Error('Спочатку запусти cap add android / cap sync android.')
let data=readFileSync(path,'utf8')
if(!/\bversionCode\s+\d+/.test(data)||!/\bversionName\s+["'][^"']+["']/.test(data)||
  !data.includes(info.applicationId))throw Error('Android Gradle змінився: автоматичне встановлення версії зупинено.')
data=data.replace(/\bversionCode\s+\d+/, 'versionCode '+info.versionCode)
  .replace(/\bversionName\s+["'][^"']+["']/, 'versionName "'+info.version+'"')
writeFileSync(path,data)
console.log('PayTakt Android version:',info.version,'code:',info.versionCode,'package:',info.applicationId)
