import {useState, type FormEvent, type ReactNode} from 'react'
import {ArrowRight, CalendarDays, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Wallet} from 'lucide-react'
import {createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile} from 'firebase/auth'
import {doc, setDoc} from 'firebase/firestore'
import {auth, db, firebaseReady} from '../lib/firebase'
import type {ThemeChoice} from '../lib/data'
import type {Language} from '../lib/presentation'

type Props = {
  onDemo: () => void
  language: Language
  onLanguageChange: (value: Language) => void
  logo: ReactNode
  theme: ThemeChoice
  friendlyError: (error: unknown) => string
}

const translations = {
  uk: {
    tagline: 'Твій графік. Твоя зарплата.',
    hero: 'Усе важливе — в одному місці.',
    calendar: 'Графік', pay: 'Зарплата', safe: 'Дані збережені',
    greeting: 'З поверненням!', join: 'Створи акаунт',
    login: 'Вхід', register: 'Реєстрація', name: 'Ім’я', nameHint: 'Як тебе звати?',
    email: 'Електронна пошта', emailHint: 'you@example.com',
    password: 'Пароль', passwordHint: 'Щонайменше 6 символів',
    show: 'Показати пароль', hide: 'Приховати пароль',
    forgot: 'Забули пароль?', enter: 'Увійти', create: 'Створити акаунт',
    processing: 'Зачекай…', demo: 'Спробувати демо', language: 'Мова',
    unavailable: 'Вхід тимчасово недоступний. Можна спробувати демо.',
    recoveryUnavailable: 'Відновлення пароля зараз недоступне.',
    emailRequired: 'Спочатку введи електронну пошту.',
    recovered: 'Якщо акаунт існує, ми надіслали лист для відновлення пароля.',
    invalidName: 'Вкажи ім’я щонайменше з 2 символів.',
  },
  en: {
    tagline: 'Your shifts. Your pay.',
    hero: 'Everything important in one place.',
    calendar: 'Schedule', pay: 'Earnings', safe: 'Data saved',
    greeting: 'Welcome back!', join: 'Create an account',
    login: 'Sign in', register: 'Sign up', name: 'Name', nameHint: 'Your name',
    email: 'Email', emailHint: 'you@example.com',
    password: 'Password', passwordHint: 'At least 6 characters',
    show: 'Show password', hide: 'Hide password',
    forgot: 'Forgot password?', enter: 'Sign in', create: 'Create account',
    processing: 'Working…', demo: 'Try demo', language: 'Language',
    unavailable: 'Sign-in is unavailable right now. You can try the demo.',
    recoveryUnavailable: 'Password recovery is unavailable right now.',
    emailRequired: 'Enter your email first.',
    recovered: 'If the account exists, a recovery email has been sent.',
    invalidName: 'Enter a name with at least 2 characters.',
  },
  ru: {
    tagline: 'Твой график. Твоя зарплата.',
    hero: 'Всё важное — в одном месте.',
    calendar: 'График', pay: 'Зарплата', safe: 'Данные сохранены',
    greeting: 'С возвращением!', join: 'Создать аккаунт',
    login: 'Вход', register: 'Регистрация', name: 'Имя', nameHint: 'Как тебя зовут?',
    email: 'Электронная почта', emailHint: 'you@example.com',
    password: 'Пароль', passwordHint: 'Не менее 6 символов',
    show: 'Показать пароль', hide: 'Скрыть пароль',
    forgot: 'Забыли пароль?', enter: 'Войти', create: 'Создать аккаунт',
    processing: 'Подождите…', demo: 'Попробовать демо', language: 'Язык',
    unavailable: 'Вход временно недоступен. Можно попробовать демо.',
    recoveryUnavailable: 'Восстановление пароля сейчас недоступно.',
    emailRequired: 'Сначала укажите электронную почту.',
    recovered: 'Если аккаунт существует, мы отправили письмо для восстановления пароля.',
    invalidName: 'Укажите имя не короче 2 символов.',
  },
} satisfies Record<Language, Record<string, string>>

export function AuthScreen({onDemo, language, onLanguageChange, logo, theme, friendlyError}: Props) {
  const copy = translations[language]
  const [variant, setVariant] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const switchVariant = (next: 'login' | 'register') => {
    if (busy || recoveryBusy) return
    setVariant(next)
    setPassword('')
    setPasswordVisible(false)
    setError('')
    setNotice('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')
    if (!auth || !db) { setError(copy.unavailable); return }
    setBusy(true)
    try {
      if (variant === 'register') {
        if (name.trim().length < 2) throw Error(copy.invalidName)
        const created = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(created.user, {displayName: name.trim()})
        await setDoc(doc(db, 'users', created.user.uid), {
          email: created.user.email || '', displayName: name.trim(), theme,
        }, {merge: true})
        // Account creation succeeds even when the verification email cannot be sent.
        try { await sendEmailVerification(created.user) }
        catch (mailError) { console.warn('Verification email could not be sent:', mailError) }
        // Read the completed profile after the initial auth listener may have loaded a fallback name.
        window.location.reload()
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (e) { setError(friendlyError(e)) }
    finally { setBusy(false) }
  }

  const resetPassword = async () => {
    if (recoveryBusy) return
    setError('')
    setNotice('')
    if (!auth) { setError(copy.recoveryUnavailable); return }
    if (!email.trim()) { setError(copy.emailRequired); return }
    setRecoveryBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setNotice(copy.recovered)
    } catch (e) { setError(friendlyError(e)) }
    finally { setRecoveryBusy(false) }
  }

  return <div className="auth-layout auth-v1">
    <aside className="auth-v1-art" aria-label="PayTakt">
      <div className="auth-v1-art-top">{logo}</div>
      <div className="auth-v1-art-body">
        <div className="auth-v1-kicker"><span className="auth-v1-dot"/> PayTakt</div>
        <h1>{copy.hero}</h1>
        <p>{copy.tagline}</p>
        <div className="auth-v1-preview" aria-hidden="true">
          <div className="auth-v1-preview-head"><CalendarDays size={18}/><span>{copy.calendar}</span><span className="auth-v1-preview-dots">•••</span></div>
          <div className="auth-v1-preview-days">
            {[0,1,2,3,4,5,6].map(i=><span key={i} className={i===1||i===2||i===4||i===5?'filled':''}/>)}
          </div>
          <div className="auth-v1-preview-bottom"><Wallet size={16}/><span>{copy.pay}</span><strong>₴</strong></div>
        </div>
      </div>
      <div className="auth-v1-art-foot"><ShieldCheck size={16}/>{copy.safe}</div>
    </aside>

    <main className="auth-panel auth-v1-panel">
      <div className="auth-v1-top">
        <div className="auth-v1-mobile-brand">{logo}</div>
        <div className="auth-v1-language">
          <label htmlFor="paytakt-auth-lang">{copy.language}</label>
          <select id="paytakt-auth-lang" value={language} onChange={e=>onLanguageChange(e.target.value as Language)}>
            <option value="uk">Українська</option>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>
      </div>

      <div className="auth-v1-card">
        <header className="auth-v1-card-head">
          <h2>{variant==='login'?copy.greeting:copy.join}</h2>
          <p>{copy.tagline}</p>
        </header>
        <div className="auth-tabs auth-v1-tabs" role="group" aria-label={copy.login+' / '+copy.register}>
          <button type="button" aria-pressed={variant==='login'} className={variant==='login'?'selected':''} onClick={()=>switchVariant('login')}>{copy.login}</button>
          <button type="button" aria-pressed={variant==='register'} className={variant==='register'?'selected':''} onClick={()=>switchVariant('register')}>{copy.register}</button>
        </div>
        <form onSubmit={submit} className="auth-form auth-v1-form">
          {variant==='register'&&<label className="auth-v1-field">
            <span>{copy.name}</span>
            <input required autoComplete="name" maxLength={70} value={name} onChange={e=>setName(e.target.value)} placeholder={copy.nameHint}/>
          </label>}
          <label className="auth-v1-field">
            <span>{copy.email}</span>
            <div className="auth-v1-input-wrap"><Mail size={18} aria-hidden="true"/>
              <input required type="email" inputMode="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={copy.emailHint}/>
            </div>
          </label>
          <label className="auth-v1-field">
            <span>{copy.password}</span>
            <div className="auth-v1-input-wrap"><LockKeyhole size={18} aria-hidden="true"/>
              <input required type={passwordVisible?'text':'password'} minLength={6} autoComplete={variant==='login'?'current-password':'new-password'}
                value={password} onChange={e=>setPassword(e.target.value)} placeholder={variant==='register'?copy.passwordHint:'••••••••'}/>
              <button type="button" className="auth-v1-eye" aria-label={passwordVisible?copy.hide:copy.show} aria-pressed={passwordVisible}
                onClick={()=>setPasswordVisible(v=>!v)}>{passwordVisible?<EyeOff size={18}/>:<Eye size={18}/>}</button>
            </div>
          </label>
          {variant==='login'&&<button type="button" className="link-button auth-v1-forgot" disabled={recoveryBusy} onClick={()=>void resetPassword()}>{copy.forgot}</button>}
          {error&&<p className="form-error" role="alert">{error}</p>}
          {notice&&<p className="form-success" role="status">{notice}</p>}
          <button type="submit" className="btn btn-primary auth-v1-submit" disabled={busy||recoveryBusy}>
            {busy?copy.processing:variant==='register'?copy.create:copy.enter}<ArrowRight size={18} aria-hidden="true"/>
          </button>
        </form>
        <div className="auth-v1-demo">
          <button type="button" onClick={onDemo} disabled={busy||recoveryBusy}>{copy.demo}<ArrowRight size={16} aria-hidden="true"/></button>
        </div>
        {!firebaseReady&&<p className="auth-v1-note" role="status">{copy.unavailable}</p>}
      </div>
    </main>
  </div>
}
