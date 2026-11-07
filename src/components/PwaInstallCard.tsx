import {useState,useSyncExternalStore} from 'react'
import {CheckCircle2,Download,Share2} from 'lucide-react'
import type {Language} from '../lib/presentation'
import {getInstallState,requestWebInstall,watchInstallState} from '../lib/webPwa'

const copy={
  uk:{
    title:'Встановити PayTakt',detail:'Додай сайт на головний екран, щоб відкривати його як застосунок.',
    action:'Встановити застосунок',installed:'PayTakt уже відкритий як встановлений застосунок.',
    ios:'На iPhone відкрий сайт у Safari, натисни «Поділитися» та вибери «На початковий екран» → «Додати».',
    other:'У меню браузера знайди «Встановити застосунок» або «Додати на головний екран».',
    declined:'Установлення скасовано. Можеш повторити його через меню браузера.',
    failed:'Автоматичне встановлення недоступне. Скористайся меню браузера.',
  },
  en:{
    title:'Install PayTakt',detail:'Add PayTakt to your Home Screen and use it like an app.',
    action:'Install app',installed:'PayTakt is already running as an installed app.',
    ios:'On iPhone, open this site in Safari, tap Share, then Add to Home Screen → Add.',
    other:'Open your browser menu and choose Install app or Add to Home Screen.',
    declined:'Installation cancelled. You can also use your browser menu.',
    failed:'Automatic installation is unavailable. Use your browser menu instead.',
  },
  ru:{
    title:'Установить PayTakt',detail:'Добавь сайт на главный экран и открывай его как приложение.',
    action:'Установить приложение',installed:'PayTakt уже открыт как установленное приложение.',
    ios:'На iPhone открой сайт в Safari, нажми «Поделиться» → «На экран Домой» → «Добавить».',
    other:'В меню браузера выбери «Установить приложение» или «Добавить на главный экран».',
    declined:'Установка отменена. Можно воспользоваться меню браузера.',
    failed:'Автоматическая установка недоступна. Используй меню браузера.',
  },
}
export function PwaInstallCard({language}:{language:Language}){
  const state=useSyncExternalStore(watchInstallState,getInstallState,()=> 'manual')
  const [feedback,setFeedback]=useState('')
  const [busy,setBusy]=useState(false)
  const t=copy[language]
  const ios=typeof navigator!=='undefined'&&/iPhone|iPad|iPod/i.test(navigator.userAgent)
  const onInstall=async()=>{
    setBusy(true);setFeedback('')
    try{
      const outcome=await requestWebInstall()
      if(outcome==='dismissed')setFeedback(t.declined)
      else if(outcome==='unavailable')setFeedback(t.failed)
    }finally{setBusy(false)}
  }
  return <section className="pt-pwa-install-card" aria-label={t.title}>
    <div className="pt-pwa-install-top">
      <span className="pt-pwa-install-icon" aria-hidden="true">{state==='installed'?<CheckCircle2 size={22}/>:<Download size={22}/>}</span>
      <div><h3>{t.title}</h3><p>{t.detail}</p></div>
    </div>
    {state==='installed'
      ?<p role="status">{t.installed}</p>
      :<>
        {state==='ready'&&<button type="button" className="btn btn-primary" disabled={busy}
          onClick={()=>void onInstall()}><Download size={17}/>{t.action}</button>}
        {state==='manual'&&<p><Share2 size={15} aria-hidden="true" style={{verticalAlign:'middle',marginRight:6}}/>{ios?t.ios:t.other}</p>}
        {feedback&&<p role="status">{feedback}</p>}
      </>}
  </section>
}
