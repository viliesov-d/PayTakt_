import {Download,RefreshCw,ShieldCheck,Smartphone,AlertCircle,ExternalLink} from 'lucide-react'
import {tr} from '../lib/presentation.ts'
import {MOBILE_VERSION,RELEASES_URL,type ReleaseCheck} from '../lib/appUpdates.ts'

type Props={
  native:boolean
  currentVersion:string
  result:ReleaseCheck|null
  checking:boolean
  onCheck:()=>void
  onOpen:(url:string)=>void
  hasPendingOffline:boolean
}
export function AppUpdatesPanel({native,currentVersion,result,checking,onCheck,onOpen,hasPendingOffline}:Props){
  return <section className="panel settings-panel settings-wide paytakt-updates-panel">
    <div className="settings-heading"><Smartphone size={22}/><div>
      <h3>{tr('Оновлення PayTakt')}</h3>
      <p>{tr('Перевіряй нові безпечні версії Android-застосунку.')}</p>
    </div></div>
    <div className="paytakt-update-current">
      <span>{tr('Встановлена версія')}</span>
      <strong>v{native?currentVersion:MOBILE_VERSION}</strong>
    </div>
    {native?<>
      <div className="paytakt-update-status" role="status">
        {result?.status==='available'?
          <><strong>{tr('Доступна нова версія')} v{result.release.version}</strong>
          <p>{tr('Опубліковано офіційний підписаний APK на GitHub Releases.')}</p></>:
        result?.status==='current'?
          <><strong>{tr('У тебе актуальна версія')}</strong>
          <p>v{result.release.version}</p></>:
        result?.status==='no_release'?
          <p>{tr('Стабільний APK ще не опублікований на GitHub Releases.')}</p>:
        result?.status==='error'?
          <p className="paytakt-update-error"><AlertCircle size={15}/>{tr(result.message)}</p>:
          <p>{tr('Перевіряємо наявність нової версії…')}</p>}
      </div>
      {result?.status==='available'&&<button className="btn btn-primary paytakt-update-action" type="button"
        onClick={()=>onOpen(result.release.apkUrl)}>
        <Download size={18}/>{tr('Завантажити оновлення')} v{result.release.version}
      </button>}
      <button type="button" className="btn btn-outline paytakt-update-check"
        disabled={checking} onClick={onCheck}>
        <RefreshCw size={17}/>{checking?tr('Перевіряємо…'):tr('Перевірити оновлення')}
      </button>
    </>:<p className="paytakt-update-note">
      {tr('Вебверсія оновлюється через сайт. Перевірка APK доступна лише в Android-застосунку.')}
    </p>}
    {native&&<button type="button" className="paytakt-update-release-link" onClick={()=>onOpen(RELEASES_URL)}>
      <ExternalLink size={15}/>{tr('Відкрити всі релізи GitHub')}
    </button>}
    {hasPendingOffline&&<p className="paytakt-update-danger"><AlertCircle size={16}/>
      {tr('Спочатку синхронізуй усі локальні зміни. Не видаляй застосунок, поки є непередані записи.')}
    </p>}
    <div className="paytakt-update-note"><ShieldCheck size={16}/>
      <span>{tr('Для встановлення поверх старої версії потрібен однаковий Android-підпис. Перший перехід із debug APK на release APK може потребувати перевстановлення. Перед цим збережи всі дані у Firebase.')}</span>
    </div>
  </section>
}
