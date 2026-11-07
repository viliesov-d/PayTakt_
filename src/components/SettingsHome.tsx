import {
  Bell, BriefcaseBusiness, CalendarDays, ChevronRight, CloudUpload, Coins,
  Palette, ShieldCheck, SlidersHorizontal, UserRound, Wallet,
  type LucideIcon,
} from 'lucide-react'
import type {Language} from '../lib/presentation'
import type {AppearancePreferences} from '../lib/uiPreferences'
import type {ThemeChoice} from '../lib/data'

export type SettingsSection='home'|'appearance'|'schedule'|'finance'|'notifications'|'data'|'account'|'workspaces'

export function isSettingsSection(value:unknown):value is SettingsSection{
  return value==='home'||value==='appearance'||value==='schedule'||value==='finance'||
    value==='notifications'||value==='data'||value==='account'||value==='workspaces'
}

const translations={
  uk:{
    title:'Налаштування',subtitle:'Усе важливе — на своєму місці.',
    quick:'Швидкий доступ',look:'Оформлення',lookHint:'Стиль і кольори',
    schedule:'Графік роботи',scheduleHint:'Зміни та шаблони',
    rules:'Правила оплати',rulesHint:'Ставки й доплати',
    main:'Основне',finance:'Валюта та виплати',financeHint:'Валюта й курс',
    notice:'Сповіщення',noticeOn:'Нагадування ввімкнено',noticeOff:'Налаштувати нагадування',
    personal:'Особисте',account:'Профіль і безпека',accountHint:'Акаунт і підтвердження пошти',
    spaces:'Робочі простори',spaceHint:'Керування просторами',
    service:'Застосунок',data:'Дані та оновлення',dataHint:'Синхронізація та версія',
    classic:'Classic',glass:'Liquid Glass',soft:'Soft Minimal',
    light:'Світла',dark:'Темна',system:'Системна',
    home:'Налаштування',back:'До налаштувань',
    appearanceTitle:'Оформлення',appearanceDetail:'Стиль, тема, кольори й мова',
    scheduleTitle:'Графік роботи',scheduleDetail:'Шаблони, зміни та додаткові можливості',
    financeTitle:'Валюта й виплати',financeDetail:'Валюта простору та відображення сум',
    notificationsTitle:'Сповіщення',notificationsDetail:'Нагадування про роботу та виплати',
    dataTitle:'Дані та оновлення',dataDetail:'Стан синхронізації й оновлення застосунку',
    accountTitle:'Профіль і безпека',accountDetail:'Особисті дані, підтвердження та вихід',
    workspacesTitle:'Робочі простори',workspacesDetail:'Додавання й керування просторами',
  },
  en:{
    title:'Settings',subtitle:'Everything important in one place.',
    quick:'Quick access',look:'Appearance',lookHint:'Style and colors',
    schedule:'Work schedule',scheduleHint:'Shifts and templates',
    rules:'Pay rules',rulesHint:'Rates and bonuses',
    main:'Essentials',finance:'Currency and payments',financeHint:'Currency and exchange rates',
    notice:'Notifications',noticeOn:'Reminders enabled',noticeOff:'Configure reminders',
    personal:'Personal',account:'Profile and security',accountHint:'Account and email verification',
    spaces:'Workspaces',spaceHint:'Manage workspaces',
    service:'Application',data:'Data and updates',dataHint:'Sync and version',
    classic:'Classic',glass:'Liquid Glass',soft:'Soft Minimal',
    light:'Light',dark:'Dark',system:'System',
    home:'Settings',back:'Back to settings',
    appearanceTitle:'Appearance',appearanceDetail:'Style, theme, colors and language',
    scheduleTitle:'Work schedule',scheduleDetail:'Templates, shifts and extra options',
    financeTitle:'Currency and payments',financeDetail:'Workspace currency and displayed amounts',
    notificationsTitle:'Notifications',notificationsDetail:'Shift and payday reminders',
    dataTitle:'Data and updates',dataDetail:'Sync status and app updates',
    accountTitle:'Profile and security',accountDetail:'Account details, verification and sign-out',
    workspacesTitle:'Workspaces',workspacesDetail:'Add and manage workspaces',
  },
  ru:{
    title:'Настройки',subtitle:'Всё важное — на своём месте.',
    quick:'Быстрый доступ',look:'Оформление',lookHint:'Стиль и цвета',
    schedule:'График работы',scheduleHint:'Смены и шаблоны',
    rules:'Правила оплаты',rulesHint:'Ставки и доплаты',
    main:'Основное',finance:'Валюта и выплаты',financeHint:'Валюта и курс',
    notice:'Уведомления',noticeOn:'Напоминания включены',noticeOff:'Настроить напоминания',
    personal:'Личное',account:'Профиль и безопасность',accountHint:'Аккаунт и подтверждение почты',
    spaces:'Рабочие пространства',spaceHint:'Управление пространствами',
    service:'Приложение',data:'Данные и обновления',dataHint:'Синхронизация и версия',
    classic:'Classic',glass:'Liquid Glass',soft:'Soft Minimal',
    light:'Светлая',dark:'Тёмная',system:'Системная',
    home:'Настройки',back:'К настройкам',
    appearanceTitle:'Оформление',appearanceDetail:'Стиль, тема, цвета и язык',
    scheduleTitle:'График работы',scheduleDetail:'Шаблоны, смены и дополнительные функции',
    financeTitle:'Валюта и выплаты',financeDetail:'Валюта пространства и отображение сумм',
    notificationsTitle:'Уведомления',notificationsDetail:'Напоминания о работе и выплатах',
    dataTitle:'Данные и обновления',dataDetail:'Синхронизация и обновления приложения',
    accountTitle:'Профиль и безопасность',accountDetail:'Данные аккаунта, подтверждение и выход',
    workspacesTitle:'Рабочие пространства',workspacesDetail:'Добавление и управление пространствами',
  },
}

type Copy=typeof translations.uk
const metadata:Record<Exclude<SettingsSection,'home'>,{title:keyof Copy;detail:keyof Copy}>={
  appearance:{title:'appearanceTitle',detail:'appearanceDetail'},
  schedule:{title:'scheduleTitle',detail:'scheduleDetail'},
  finance:{title:'financeTitle',detail:'financeDetail'},
  notifications:{title:'notificationsTitle',detail:'notificationsDetail'},
  data:{title:'dataTitle',detail:'dataDetail'},
  account:{title:'accountTitle',detail:'accountDetail'},
  workspaces:{title:'workspacesTitle',detail:'workspacesDetail'},
}

export function SettingsSectionHeader({section,language,onBack}:{
  section:Exclude<SettingsSection,'home'>;language:Language;onBack:()=>void
}){
  const t=translations[language]
  const item=metadata[section]
  return <header className="pt-settings-detail-header">
    <button type="button" className="pt-settings-back" onClick={onBack}>
      <ChevronRight size={17} aria-hidden="true"/>{t.back}
    </button>
    <h2>{t[item.title]}</h2><p>{t[item.detail]}</p>
  </header>
}

function SettingsRow({icon:Icon,title,detail,onClick}:{
  icon:LucideIcon;title:string;detail:string;onClick:()=>void
}){
  return <button type="button" className="pt-settings-row" onClick={onClick}>
    <span className="pt-settings-icon" aria-hidden="true"><Icon size={20}/></span>
    <span className="pt-settings-row-text"><strong>{title}</strong><small>{detail}</small></span>
    <ChevronRight className="pt-settings-chevron" size={19} aria-hidden="true"/>
  </button>
}

export function SettingsHome({language,appearance,theme,workspaceName,workspacesCount,remindersEnabled,onOpen,onGoRules}:{
  language:Language;appearance:AppearancePreferences;theme:ThemeChoice
  workspaceName:string;workspacesCount:number;remindersEnabled:boolean
  onOpen:(section:SettingsSection)=>void;onGoRules:()=>void
}){
  const t=translations[language]
  const styleLabel=appearance.style==='glass'?t.glass:appearance.style==='soft'?t.soft:t.classic
  const themeLabel=theme==='light'?t.light:theme==='dark'?t.dark:t.system
  return <div className="pt-settings-home">
    <header className="pt-settings-hero">
      <div><span className="pt-settings-eyebrow">PAYTAKT</span>
        <h1>{t.title}</h1><p>{t.subtitle}</p></div>
      <span className="pt-settings-hero-icon" aria-hidden="true"><SlidersHorizontal size={25}/></span>
    </header>

    <section aria-label={t.quick}>
      <h2 className="pt-settings-group-title">{t.quick}</h2>
      <div className="pt-settings-quick-grid">
        <button type="button" className="pt-settings-quick pt-settings-quick-appearance" onClick={()=>onOpen('appearance')}>
          <Palette size={24} aria-hidden="true"/><strong>{t.look}</strong>
          <small>{styleLabel} · {themeLabel}</small><ChevronRight size={16} className="pt-settings-quick-arrow" aria-hidden="true"/>
        </button>
        <button type="button" className="pt-settings-quick" onClick={()=>onOpen('schedule')}>
          <CalendarDays size={24} aria-hidden="true"/><strong>{t.schedule}</strong>
          <small>{t.scheduleHint}</small><ChevronRight size={16} className="pt-settings-quick-arrow" aria-hidden="true"/>
        </button>
        <button type="button" className="pt-settings-quick" onClick={onGoRules}>
          <Wallet size={24} aria-hidden="true"/><strong>{t.rules}</strong>
          <small>{t.rulesHint}</small><ChevronRight size={16} className="pt-settings-quick-arrow" aria-hidden="true"/>
        </button>
      </div>
    </section>

    <section aria-label={t.main}>
      <h2 className="pt-settings-group-title">{t.main}</h2>
      <div className="pt-settings-list">
        <SettingsRow icon={Coins} title={t.finance} detail={t.financeHint} onClick={()=>onOpen('finance')}/>
        <SettingsRow icon={BriefcaseBusiness} title={t.spaces} detail={`${workspaceName} · ${workspacesCount}`} onClick={()=>onOpen('workspaces')}/>
      </div>
    </section>

    <section aria-label={t.personal}>
      <h2 className="pt-settings-group-title">{t.personal}</h2>
      <div className="pt-settings-list">
        <SettingsRow icon={Bell} title={t.notice} detail={remindersEnabled?t.noticeOn:t.noticeOff} onClick={()=>onOpen('notifications')}/>
        <SettingsRow icon={UserRound} title={t.account} detail={t.accountHint} onClick={()=>onOpen('account')}/>
      </div>
    </section>

    <section aria-label={t.service}>
      <h2 className="pt-settings-group-title">{t.service}</h2>
      <div className="pt-settings-list">
        <SettingsRow icon={CloudUpload} title={t.data} detail={t.dataHint} onClick={()=>onOpen('data')}/>
      </div>
    </section>
    <span className="pt-settings-home-footer"><ShieldCheck size={15} aria-hidden="true"/>{t.subtitle}</span>
  </div>
}
