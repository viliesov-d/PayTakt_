import {Check, Droplets, Moon, Monitor, Palette, RotateCcw, Sparkles, Sun} from 'lucide-react'
import type {ThemeChoice} from '../lib/data'
import type {Language} from '../lib/presentation'
import {
  DEFAULT_APPEARANCE, GRADIENT_COLORS, gradientCss, selectGradient,
  type AppearancePreferences, type GradientPreset, type UIStyle,
} from '../lib/uiPreferences'

type Props={
  value:AppearancePreferences
  onChange:(value:AppearancePreferences)=>void
  theme:ThemeChoice
  onThemeChange:(value:ThemeChoice)=>void
  language:Language
}

const translations={
  uk:{
    heading:'Зовнішній вигляд',subtitle:'Налаштуй PayTakt під себе.',
    style:'Стиль',classic:'Звичайний',classicSub:'Як зараз',glass:'Liquid Glass',glassSub:'Скляні панелі',soft:'Soft Minimal',softSub:'М’який мінімалізм',
    theme:'Тема',light:'Світла',dark:'Темна',system:'Авто',
    gradient:'Градієнт',none:'Без градієнта',mint:'М’ята',ocean:'Океан',sunset:'Захід',violet:'Фіолет',custom:'Власний',
    from:'Перший колір',to:'Другий колір',angle:'Напрямок',reset:'Скинути оформлення',
    device:'Зберігається на цьому пристрої.',preview:'Попередній перегляд',
    dockTransparency:'Прозорість панелі навігації',dockHint:'Для скляної панелі на мобільному сайті та у застосунку.',
    dockBlur:'Розмиття панелі навігації',dockBlurHint:'Налаштовує силу блюру, не змінюючи заломлення країв та рух повзунка.',
    noBlur:'Без розмиття',strongBlur:'Сильне',
    opaque:'Непрозора',clear:'Прозора',
  },
  en:{
    heading:'Appearance',subtitle:'Make PayTakt yours.',
    style:'Style',classic:'Classic',classicSub:'Original',glass:'Liquid Glass',glassSub:'Frosted panels',soft:'Soft Minimal',softSub:'Calm and clean',
    theme:'Theme',light:'Light',dark:'Dark',system:'Auto',
    gradient:'Gradient',none:'None',mint:'Mint',ocean:'Ocean',sunset:'Sunset',violet:'Violet',custom:'Custom',
    from:'First color',to:'Second color',angle:'Direction',reset:'Reset appearance',
    device:'Saved on this device.',preview:'Live preview',
    dockTransparency:'Navigation panel transparency',dockHint:'For the glass panel on mobile web and in the app.',
    dockBlur:'Navigation panel blur',dockBlurHint:'Adjusts background blur without changing the optical edge or moving thumb.',
    noBlur:'No blur',strongBlur:'Strong',
    opaque:'Opaque',clear:'Transparent',
  },
  ru:{
    heading:'Оформление',subtitle:'Настрой PayTakt под себя.',
    style:'Стиль',classic:'Обычный',classicSub:'Как сейчас',glass:'Liquid Glass',glassSub:'Стеклянные панели',soft:'Soft Minimal',softSub:'Мягкий минимализм',
    theme:'Тема',light:'Светлая',dark:'Тёмная',system:'Авто',
    gradient:'Градиент',none:'Без градиента',mint:'Мята',ocean:'Океан',sunset:'Закат',violet:'Фиолет',custom:'Свой',
    from:'Первый цвет',to:'Второй цвет',angle:'Направление',reset:'Сбросить оформление',
    device:'Сохраняется на этом устройстве.',preview:'Предпросмотр',
    dockTransparency:'Прозрачность панели навигации',dockHint:'Для стеклянной панели на мобильном сайте и в приложении.',
    dockBlur:'Размытие панели навигации',dockBlurHint:'Меняет силу размытия, сохраняя преломление краёв и движение ползунка.',
    noBlur:'Без размытия',strongBlur:'Сильное',
    opaque:'Непрозрачная',clear:'Прозрачная',
  },
}

const styles: {id:UIStyle;icon:typeof Palette;name:'classic'|'glass'|'soft';description:'classicSub'|'glassSub'|'softSub'}[]=[
  {id:'classic',icon:Palette,name:'classic',description:'classicSub'},
  {id:'glass',icon:Droplets,name:'glass',description:'glassSub'},
  {id:'soft',icon:Sparkles,name:'soft',description:'softSub'},
]
const gradients: GradientPreset[]=['none','mint','ocean','sunset','violet','custom']
const themeOptions: {id:ThemeChoice;icon:typeof Sun;label:'light'|'dark'|'system'}[]=[
  {id:'light',icon:Sun,label:'light'},{id:'dark',icon:Moon,label:'dark'},{id:'system',icon:Monitor,label:'system'},
]

export function AppearanceSettings({value,onChange,theme,onThemeChange,language}:Props){
  const t=translations[language]
  return <section className="panel settings-panel settings-wide appearance-settings" aria-labelledby="appearance-title">
    <div className="settings-heading appearance-heading">
      <Palette size={22}/>
      <div><h3 id="appearance-title">{t.heading}</h3><p>{t.subtitle}</p></div>
    </div>

    <div className="appearance-section-title">{t.style}</div>
    <div className="appearance-styles" role="group" aria-label={t.style}>
      {styles.map(({id,icon:Icon,name,description})=><button
        key={id} type="button" aria-pressed={value.style===id}
        className={`appearance-style-card is-${id} ${value.style===id?'selected':''}`}
        onClick={()=>onChange({...value,style:id})}>
        <span className="appearance-style-visual" aria-hidden="true">
          <span className="appearance-faux-header"/>
          <span className="appearance-faux-content"><i/><i/><i/></span>
          <span className="appearance-faux-dock"><i/><i/><i/></span>
        </span>
        <span className="appearance-style-label"><Icon size={16}/><strong>{t[name]}</strong></span>
        <small>{t[description]}</small>
        {value.style===id&&<Check className="appearance-style-check" size={16} aria-hidden="true"/>}
      </button>)}
    </div>


    {value.style==='glass'&&<div className="appearance-dock-control">
      <label htmlFor="appearance-dock-transparency" className="appearance-dock-title">
        <span><Droplets size={18} aria-hidden="true"/>{t.dockTransparency}</span>
        <output htmlFor="appearance-dock-transparency">{value.dockTransparency}%</output>
      </label>
      <input id="appearance-dock-transparency" type="range" min="0" max="100" step="5"
        value={value.dockTransparency} aria-describedby="appearance-dock-hint"
        onChange={e=>onChange({...value,dockTransparency:Number(e.target.value)})}/>
      <div className="appearance-dock-scale"><span>{t.opaque}</span><span>{t.clear}</span></div>
      <p id="appearance-dock-hint" className="appearance-dock-hint">{t.dockHint}</p>
      <div className="appearance-dock-blur">
        <label htmlFor="appearance-dock-blur" className="appearance-dock-title">
          <span><Droplets size={18} aria-hidden="true"/>{t.dockBlur}</span>
          <output htmlFor="appearance-dock-blur">{value.dockBlur}%</output>
        </label>
        <input id="appearance-dock-blur" type="range" min="0" max="100" step="5"
          value={value.dockBlur} aria-describedby="appearance-dock-blur-hint"
          onChange={e=>onChange({...value,dockBlur:Number(e.target.value)})}/>
        <div className="appearance-dock-scale"><span>{t.noBlur}</span><span>{t.strongBlur}</span></div>
        <p id="appearance-dock-blur-hint" className="appearance-dock-hint">{t.dockBlurHint}</p>
      </div>
    </div>}

    <div className="appearance-theme-row">
      <div className="appearance-section-title">{t.theme}</div>
      <div className="appearance-theme-options" role="group" aria-label={t.theme}>
        {themeOptions.map(({id,icon:Icon,label})=><button key={id} type="button"
          aria-pressed={theme===id} className={theme===id?'selected':''}
          onClick={()=>onThemeChange(id)}><Icon size={16}/>{t[label]}</button>)}
      </div>
    </div>

    <div className="appearance-gradient-head">
      <div className="appearance-section-title">{t.gradient}</div>
      <button className="appearance-reset" type="button" onClick={()=>onChange({...DEFAULT_APPEARANCE})}>
        <RotateCcw size={14}/>{t.reset}
      </button>
    </div>
    <div className="appearance-gradient-options" role="group" aria-label={t.gradient}>
      {gradients.map(id=>{
        const sample=id==='custom'?{from:value.from,to:value.to}:id==='none'?null:GRADIENT_COLORS[id]
        return <button type="button" key={id}
          aria-pressed={value.gradient===id}
          className={`appearance-gradient-option ${value.gradient===id?'selected':''}`}
          onClick={()=>onChange(selectGradient(value,id))}>
          <span className={`appearance-gradient-swatch ${id==='none'?'is-none':''}`}
            style={sample?{background:`linear-gradient(135deg, ${sample.from}, ${sample.to})`}:undefined} aria-hidden="true">
            {value.gradient===id&&<Check size={17}/>}
          </span>
          <span>{t[id]}</span>
        </button>
      })}
    </div>

    {value.gradient!=='none'&&<div className="appearance-gradient-edit">
      {value.gradient==='custom'&&<div className="appearance-color-fields">
        <label>{t.from}<input type="color" value={value.from}
          onChange={e=>onChange({...value,gradient:'custom',from:e.target.value})}/></label>
        <label>{t.to}<input type="color" value={value.to}
          onChange={e=>onChange({...value,gradient:'custom',to:e.target.value})}/></label>
      </div>}
      <label className="appearance-angle-label" htmlFor="appearance-angle">
        {t.angle} <strong>{value.angle}°</strong>
      </label>
      <input id="appearance-angle" type="range" min="0" max="360" step="15"
        value={value.angle} onChange={e=>onChange({...value,angle:Number(e.target.value)})}/>
    </div>}

    <div className="appearance-preview" aria-label={t.preview}>
      <span className="appearance-preview-caption">{t.preview}</span>
      <span className="appearance-preview-bar"
        style={{background:value.gradient==='none'?'var(--panel-soft)':gradientCss(value)}}/>
      <span className="appearance-preview-label">PayTakt</span>
    </div>
    <p className="appearance-storage-note">{t.device}</p>
  </section>
}
