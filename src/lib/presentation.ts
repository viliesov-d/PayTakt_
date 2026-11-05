/** UI presentation settings only. Core payroll amounts are always stored in UAH cents. */
export type Language = 'uk' | 'en' | 'ru'
export type DisplayCurrency = 'UAH' | 'USD' | 'EUR' | 'PLN' | 'GBP'
export type PresentationSettings = { language: Language; currency: DisplayCurrency; uahPerUnit: number }
const key = 'paytakt-presentation-v1'
export const localeForLanguage: Record<Language, string> = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' }
export const currencies: DisplayCurrency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP']
const translations: Record<string, { en: string; ru: string }> = {
  "Мій календар": {
    "en": "Calendar",
    "ru": "Календарь"
  },
  "Мої гроші": {
    "en": "My earnings",
    "ru": "Мои деньги"
  },
  "Налаштування роботи": {
    "en": "Work settings",
    "ru": "Настройки работы"
  },
  "Календар": {
    "en": "Calendar",
    "ru": "Календарь"
  },
  "Налаштування": {
    "en": "Settings",
    "ru": "Настройки"
  },
  "До календаря": {
    "en": "To calendar",
    "ru": "К календарю"
  },
  "Мова застосунку": {
    "en": "App language",
    "ru": "Язык приложения"
  },
  "Валюта відображення": {
    "en": "Display currency",
    "ru": "Валюта отображения"
  },
  "Зберегти валюту": {
    "en": "Save currency",
    "ru": "Сохранить валюту"
  },
  "Українська": {
    "en": "Ukrainian",
    "ru": "Украинский"
  },
  "Англійська": {
    "en": "English",
    "ru": "Английский"
  },
  "Російська": {
    "en": "Russian",
    "ru": "Русский"
  },
  "Курс обміну": {
    "en": "Exchange rate",
    "ru": "Обменный курс"
  },
  "Гривень за 1 одиницю валюти": {
    "en": "UAH per 1 currency unit",
    "ru": "Гривен за 1 единицу валюты"
  },
  "Вкажи курс більше нуля.": {
    "en": "Enter an exchange rate greater than zero.",
    "ru": "Укажите курс больше нуля."
  },
  "Налаштування збережено на цьому пристрої.": {
    "en": "Settings saved on this device.",
    "ru": "Настройки сохранены на этом устройстве."
  },
  "Зарплата обліковується у гривнях. Інша валюта показує лише орієнтовний еквівалент за вказаним тобою курсом. Введення сум залишається у гривнях.": {
    "en": "Salary is recorded in UAH. Other currencies show an approximate equivalent using your manually entered rate. Amounts are still entered in UAH.",
    "ru": "Зарплата учитывается в гривнах. Другая валюта показывает приблизительный эквивалент по указанному вами курсу. Суммы по-прежнему вводятся в гривнах."
  },
  "ПЕРСОНАЛІЗАЦІЯ": {
    "en": "PERSONALIZATION",
    "ru": "ПЕРСОНАЛИЗАЦИЯ"
  },
  "Зовнішній вигляд, профіль та робочі простори.": {
    "en": "Appearance, profile and workspaces.",
    "ru": "Внешний вид, профиль и рабочие пространства."
  },
  "Тема оформлення": {
    "en": "Appearance",
    "ru": "Оформление"
  },
  "Обирай вигляд, який комфортний саме тобі.": {
    "en": "Choose a theme that works for you.",
    "ru": "Выбирай удобную тему оформления."
  },
  "Мій профіль": {
    "en": "My profile",
    "ru": "Мой профиль"
  },
  "Акаунт PayTakt": {
    "en": "PayTakt account",
    "ru": "Аккаунт PayTakt"
  },
  "Ім’я": {
    "en": "Name",
    "ru": "Имя"
  },
  "Електронна пошта": {
    "en": "Email address",
    "ru": "Электронная почта"
  },
  "Тип входу": {
    "en": "Sign-in method",
    "ru": "Способ входа"
  },
  "Демонстрація": {
    "en": "Demo",
    "ru": "Демонстрация"
  },
  "Деморежим": {
    "en": "Demo mode",
    "ru": "Деморежим"
  },
  "Робочі простори": {
    "en": "Workspaces",
    "ru": "Рабочие пространства"
  },
  "Особисті записи та компанії не змішуються.": {
    "en": "Personal records and company data stay separate.",
    "ru": "Личные записи и данные компаний не смешиваются."
  },
  "Компанія": {
    "en": "Company",
    "ru": "Компания"
  },
  "Особистий простір": {
    "en": "Personal workspace",
    "ru": "Личное пространство"
  },
  "Активний": {
    "en": "Active",
    "ru": "Активный"
  },
  "Додати компанію": {
    "en": "Add company",
    "ru": "Добавить компанию"
  },
  "Підтвердь електронну пошту": {
    "en": "Verify your email",
    "ru": "Подтвердите email"
  },
  "Електронну пошту підтверджено": {
    "en": "Email verified",
    "ru": "Email подтверждён"
  },
  "Надіслати лист": {
    "en": "Send email",
    "ru": "Отправить письмо"
  },
  "Я підтвердив": {
    "en": "I've verified",
    "ru": "Я подтвердил"
  },
  "Нова компанія": {
    "en": "New company",
    "ru": "Новая компания"
  },
  "Назва компанії": {
    "en": "Company name",
    "ru": "Название компании"
  },
  "Створити простір": {
    "en": "Create workspace",
    "ru": "Создать пространство"
  },
  "Денна": {
    "en": "Light",
    "ru": "Дневная"
  },
  "Нічна": {
    "en": "Dark",
    "ru": "Ночная"
  },
  "Авто": {
    "en": "Auto",
    "ru": "Авто"
  },
  "Світла й повітряна": {
    "en": "Bright and airy",
    "ru": "Светлая и воздушная"
  },
  "Глибокі темні відтінки": {
    "en": "Deep dark colors",
    "ru": "Глубокие тёмные оттенки"
  },
  "Як на твоєму пристрої": {
    "en": "Match your device",
    "ru": "Как на вашем устройстве"
  },
  "Реєстрація": {
    "en": "Sign up",
    "ru": "Регистрация"
  },
  "Вхід": {
    "en": "Sign in",
    "ru": "Вход"
  },
  "Пароль": {
    "en": "Password",
    "ru": "Пароль"
  },
  "Ваше ім’я": {
    "en": "Your name",
    "ru": "Ваше имя"
  },
  "Забули пароль?": {
    "en": "Forgot password?",
    "ru": "Забыли пароль?"
  },
  "Переглянути демоверсію": {
    "en": "View demo",
    "ru": "Посмотреть демоверсию"
  },
  "Вийти з акаунта": {
    "en": "Sign out",
    "ru": "Выйти из аккаунта"
  },
  "Повернутися до календаря": {
    "en": "Return to calendar",
    "ru": "Вернуться к календарю"
  },
  "Підсумок місяця": {
    "en": "Monthly summary",
    "ru": "Итоги месяца"
  },
  "КОРОТКИЙ ОГЛЯД": {
    "en": "OVERVIEW",
    "ru": "ОБЗОР"
  },
  "ПЛАНУЙ · ПРАЦЮЙ · ЗАРОБЛЯЙ": {
    "en": "PLAN · WORK · EARN",
    "ru": "ПЛАНИРУЙ · РАБОТАЙ · ЗАРАБАТЫВАЙ"
  },
  "Перейти до календаря": {
    "en": "Open calendar",
    "ru": "Открыть календарь"
  },
  "Заплановано змін": {
    "en": "Planned shifts",
    "ru": "Запланировано смен"
  },
  "Відпрацьовано": {
    "en": "Worked",
    "ru": "Отработано"
  },
  "Нараховано": {
    "en": "Accrued",
    "ru": "Начислено"
  },
  "Понаднормові години": {
    "en": "Overtime hours",
    "ru": "Сверхурочные часы"
  },
  "Попередня зарплата": {
    "en": "Estimated salary",
    "ru": "Предварительная зарплата"
  },
  "Динаміка робочих годин": {
    "en": "Work hours trend",
    "ru": "Динамика рабочих часов"
  },
  "Найближчі зміни": {
    "en": "Upcoming shifts",
    "ru": "Ближайшие смены"
  },
  "Твої наступні робочі дні": {
    "en": "Your next working days",
    "ru": "Твои следующие рабочие дни"
  },
  "Створити компанію": {
    "en": "Create company",
    "ru": "Создать компанию"
  },
  "Цей місяць": {
    "en": "This month",
    "ru": "Этот месяц"
  },
  "План на місяць — під контролем": {
    "en": "Your monthly plan at a glance",
    "ru": "План на месяц — под контролем"
  },
  "МІЙ КАЛЕНДАР": {
    "en": "MY CALENDAR",
    "ru": "МОЙ КАЛЕНДАРЬ"
  },
  "Мій план": {
    "en": "My target",
    "ru": "Мой план"
  },
  "Статистика": {
    "en": "Statistics",
    "ru": "Статистика"
  },
  "Моя статистика": {
    "en": "My statistics",
    "ru": "Моя статистика"
  },
  "ОБРАНИЙ ДЕНЬ": {
    "en": "SELECTED DAY",
    "ru": "ВЫБРАННЫЙ ДЕНЬ"
  },
  "Який це день?": {
    "en": "Day type",
    "ru": "Тип дня"
  },
  "Робочий": {
    "en": "Workday",
    "ru": "Рабочий"
  },
  "Вихідний": {
    "en": "Day off",
    "ru": "Выходной"
  },
  "Заплановано": {
    "en": "Scheduled",
    "ru": "Запланировано"
  },
  "Відпрацював цю зміну?": {
    "en": "Did you work this shift?",
    "ru": "Отработали эту смену?"
  },
  "Заробіток і каса": {
    "en": "Earnings and cash",
    "ru": "Заработок и касса"
  },
  "Додаткові параметри": {
    "en": "Additional options",
    "ru": "Дополнительные параметры"
  },
  "Примітка до дня": {
    "en": "Day note",
    "ru": "Примечание к дню"
  },
  "Застосувати до всіх робочих днів": {
    "en": "Apply to all workdays",
    "ru": "Применить ко всем рабочим дням"
  },
  "Заплановані виплати": {
    "en": "Scheduled payouts",
    "ru": "Запланированные выплаты"
  },
  "Видалити запис дня": {
    "en": "Delete day record",
    "ru": "Удалить запись дня"
  },
  "Швидкі понаднормові для календаря": {
    "en": "Quick overtime for calendar",
    "ru": "Быстрые сверхурочные для календаря"
  },
  "МІЙ ЕКРАН": {
    "en": "MY LAYOUT",
    "ru": "МОЙ ЭКРАН"
  },
  "Налаштуй календар під себе": {
    "en": "Customize your calendar",
    "ru": "Настрой календарь под себя"
  },
  "Блоки й порядок": {
    "en": "Blocks and order",
    "ru": "Блоки и порядок"
  },
  "Редактор дня": {
    "en": "Day editor",
    "ru": "Редактор дня"
  },
  "Графік під твої правила": {
    "en": "Schedule your way",
    "ru": "График по твоим правилам"
  },
  "Правила оплати": {
    "en": "Pay rules",
    "ru": "Правила оплаты"
  },
  "Пройти майстер": {
    "en": "Run setup wizard",
    "ru": "Пройти мастер"
  },
  "Деталі нарахувань": {
    "en": "Earnings details",
    "ru": "Детали начислений"
  },
  "Графік роботи": {
    "en": "Work schedule",
    "ru": "Рабочий график"
  },
  "Налаштування твоєї роботи": {
    "en": "Your work settings",
    "ru": "Настройки вашей работы"
  },
  "Інші можливості, якщо вони потрібні": {
    "en": "Extra features if needed",
    "ru": "Дополнительные возможности"
  },
  "План і премії": {
    "en": "Targets and bonuses",
    "ru": "План и премии"
  },
  "Оплата за день": {
    "en": "Daily pay",
    "ru": "Оплата за день"
  },
  "Каса за день": {
    "en": "Daily cash",
    "ru": "Касса за день"
  },
  "Понаднормові": {
    "en": "Overtime",
    "ru": "Сверхурочные"
  },
  "Увімкнено": {
    "en": "Enabled",
    "ru": "Включено"
  },
  "Вимкнено": {
    "en": "Disabled",
    "ru": "Выключено"
  },
  "Відкрити правила оплати": {
    "en": "Open pay rules",
    "ru": "Открыть правила оплаты"
  },
  "КОНСТРУКТОР ОПЛАТИ": {
    "en": "PAY RULE BUILDER",
    "ru": "КОНСТРУКТОР ОПЛАТЫ"
  },
  "Мої правила зарплати": {
    "en": "My pay rules",
    "ru": "Мои правила зарплаты"
  },
  "Основна оплата": {
    "en": "Base pay",
    "ru": "Основная оплата"
  },
  "Постійні доплати": {
    "en": "Recurring bonuses",
    "ru": "Постоянные доплаты"
  },
  "Нічні години": {
    "en": "Night hours",
    "ru": "Ночные часы"
  },
  "Відпрацьованих змін": {
    "en": "Completed shifts",
    "ru": "Отработанных смен"
  },
  "Деталізація нарахувань": {
    "en": "Earnings breakdown",
    "ru": "Детализация начислений"
  },
  "Загалом": {
    "en": "Total",
    "ru": "Итого"
  },
  "Попередньо нараховано": {
    "en": "Estimated gross pay",
    "ru": "Предварительно начислено"
  },
  "До утримань і податків": {
    "en": "Before deductions and taxes",
    "ru": "До удержаний и налогов"
  },
  "Виручка за місяць": {
    "en": "Monthly revenue",
    "ru": "Выручка за месяц"
  },
  "Зарплатні нарахування": {
    "en": "Salary accruals",
    "ru": "Начисления зарплаты"
  },
  "Премії": {
    "en": "Bonuses",
    "ru": "Премии"
  },
  "Особистий заробіток за днями": {
    "en": "Daily earnings",
    "ru": "Личный заработок по дням"
  },
  "Каса за день · журнал": {
    "en": "Daily cash · ledger",
    "ru": "Касса за день · журнал"
  },
  "Нараховано до податків": {
    "en": "Accrued before taxes",
    "ru": "Начислено до налогов"
  },
  "Налаштувати оплату": {
    "en": "Configure pay",
    "ru": "Настроить оплату"
  },
  "План виручки": {
    "en": "Revenue target",
    "ru": "План выручки"
  },
  "План виконано": {
    "en": "Target achieved",
    "ru": "План выполнен"
  },
  "Початок": {
    "en": "Start",
    "ru": "Начало"
  },
  "Кінець": {
    "en": "End",
    "ru": "Конец"
  },
  "Зберегти": {
    "en": "Save",
    "ru": "Сохранить"
  },
  "Видалити": {
    "en": "Delete",
    "ru": "Удалить"
  },
  "Додати": {
    "en": "Add",
    "ru": "Добавить"
  },
  "Сьогодні": {
    "en": "Today",
    "ru": "Сегодня"
  },
  "Зміни": {
    "en": "Shifts",
    "ru": "Смены"
  },
  "Підробіток / додаткова": {
    "en": "Extra shift",
    "ru": "Подработка / дополнительная"
  },
  "Заміна": {
    "en": "Replacement",
    "ru": "Замена"
  },
  "Відпустка": {
    "en": "Vacation",
    "ru": "Отпуск"
  },
  "Лікарняний": {
    "en": "Sick leave",
    "ru": "Больничный"
  }
}

function validLanguage(value: unknown): value is Language {
  return value === 'uk' || value === 'en' || value === 'ru'
}
function validCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === 'string' && currencies.some(currency => currency === value)
}
export function readPresentation(): PresentationSettings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (typeof value === 'object' && value !== null) {
        const obj = value as Partial<PresentationSettings>
        return {
          language: validLanguage(obj.language) ? obj.language : 'uk',
          currency: validCurrency(obj.currency) && (obj.currency === 'UAH' || (typeof obj.uahPerUnit === 'number' && Number.isFinite(obj.uahPerUnit) && obj.uahPerUnit > 0)) ? obj.currency : 'UAH',
          uahPerUnit: typeof obj.uahPerUnit === 'number' && Number.isFinite(obj.uahPerUnit) && obj.uahPerUnit > 0 ? obj.uahPerUnit : 1,
        }
      }
    }
  } catch {/* localStorage can be unavailable in private mode */}
  return { language: 'uk', currency: 'UAH', uahPerUnit: 1 }
}
let current: PresentationSettings = readPresentation()
export function getPresentation(): PresentationSettings { return current }
export function savePresentation(value: PresentationSettings): PresentationSettings {
  const safe: PresentationSettings = {
    language: validLanguage(value.language) ? value.language : 'uk',
    currency: validCurrency(value.currency) ? value.currency : 'UAH',
    uahPerUnit: Number.isFinite(value.uahPerUnit) && value.uahPerUnit > 0 ? value.uahPerUnit : 1,
  }
  if (safe.currency !== 'UAH' && (!Number.isFinite(value.uahPerUnit) || value.uahPerUnit <= 0)) throw Error('Exchange rate must be positive')
  current = safe
  try { localStorage.setItem(key, JSON.stringify(current)) } catch {/* keeps working in-memory */}
  if (typeof document !== 'undefined') document.documentElement.lang = current.language
  return current
}
export function tr(ukrainianText: string): string {
  if (current.language === 'uk') return ukrainianText
  return translations[ukrainianText]?.[current.language] ?? ukrainianText
}
export function locale(): string { return localeForLanguage[current.language] }
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}
export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(date)
}
export function formatMoney(kopeks: number): string {
  const rate = current.currency === 'UAH' ? 1 : current.uahPerUnit
  const amount = kopeks / 100 / rate
  const result = new Intl.NumberFormat(locale(), {
    style: 'currency', currency: current.currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
  return current.currency === 'UAH' ? result : '≈ ' + result
}
