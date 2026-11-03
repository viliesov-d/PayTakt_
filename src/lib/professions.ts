/** Profession suggestions are editable starting points, never legal/payroll defaults. */
import type {PayMode} from './salary.ts'
import type {TemplatePreset} from './schedule.ts'
export type Sector =
  | 'office' | 'retail' | 'hospitality' | 'manufacturing' | 'logistics'
  | 'healthcare' | 'service' | 'freelance' | 'education' | 'construction'
  | 'agriculture' | 'security' | 'beauty' | 'cleaning' | 'transport'
  | 'events' | 'other'
export type JobPreset={id:string;name:string;description:string;shift:TemplatePreset;mode:PayMode;unitName:string}
export const sectors:{id:Sector;label:string;description:string}[]=[
  {id:'office',label:'Офіс / IT',description:'Оклад, гнучкий час, проєкти'},
  {id:'retail',label:'Магазин / торгівля',description:'Каса, зміни, погодинна оплата'},
  {id:'hospitality',label:'Готель / ресторан',description:'Ранкові, вечірні й нічні зміни'},
  {id:'manufacturing',label:'Виробництво / склад',description:'Бригади, виробіток, позмінна робота'},
  {id:'logistics',label:'Логістика / доставка',description:'Кур’єри, склади, маршрутні зміни'},
  {id:'healthcare',label:'Медицина / догляд',description:'Чергування, нічні, гнучкий графік'},
  {id:'education',label:'Освіта / репетиторство',description:'Години, уроки й оклад'},
  {id:'construction',label:'Будівництво / монтаж',description:'Бригади, об’єкти, відрядна оплата'},
  {id:'agriculture',label:'Сільське господарство',description:'Сезонні та довгі зміни'},
  {id:'security',label:'Охорона / чергування',description:'Добові, денні та нічні зміни'},
  {id:'beauty',label:'Краса / здоров’я',description:'Послуги, клієнти, відсотки'},
  {id:'cleaning',label:'Прибирання / сервіс',description:'Об’єкти, години, завдання'},
  {id:'transport',label:'Транспорт / таксі',description:'Рейси, години, зміни'},
  {id:'events',label:'Події / сезонна робота',description:'Разові зміни й проєкти'},
  {id:'service',label:'Ремонт / інші послуги',description:'Погодинна, за замовлення чи оклад'},
  {id:'freelance',label:'Фриланс / віддалено',description:'Власний ритм, задачі, проєкти'},
  {id:'other',label:'Інше / власні правила',description:'Усе налаштовується вручну'},
]
const p=(id:string,name:string,description:string,shift:TemplatePreset,mode:PayMode,unitName='завдання'):JobPreset=>({id,name,description,shift,mode,unitName})
/** Several choices per industry; no rates or bonuses are silently imposed. */
export const suggestions:Record<Sector,JobPreset[]>={
  office:[
    p('office-salary','5/2 Пн–Пт · Оклад','Стандартні 8-годинні зміни','5/2-weekdays','monthly'),
    p('office-hourly','5/2 Пн–Пт · Погодинна','Ставка за фактичні години','5/2-weekdays','hourly'),
    p('office-6-1','6/1 · Оклад','Робота шість днів на тиждень','6/1','monthly'),
    p('office-flex','2/2 · Погодинна','Гнучкий змінний графік','2/2','hourly'),
    p('office-project','5/2 Пн–Пт · За проєкт','Оплата за завершену роботу','5/2-weekdays','per_unit','проєкт'),
  ],
  retail:[
    p('retail-salary','2/2 · Оклад','Оклад та власні надбавки','2/2','monthly','продаж'),
    p('retail-hourly','2/2 · Погодинна','Оплата за відпрацьовані години','2/2','hourly'),
    p('retail-shift','4/2 · За зміну','Фіксована оплата за зміну','4/2','per_shift'),
    p('retail-five','5/2 Пн–Пт · Оклад','П’ятиденний графік','5/2-weekdays','monthly'),
    p('retail-three','3/3 · Позмінна','Три робочі, три вихідні','3/3','per_shift'),
  ],
  hospitality:[
    p('hotel-2-2','2/2 · За зміну','Готель, ресторан або кафе','2/2','per_shift','замовлення'),
    p('hotel-hours','5/2 Пн–Пт · Погодинна','Оплата за години роботи','5/2-weekdays','hourly','замовлення'),
    p('hotel-3-3','3/3 · Оклад','Три робочі / три вихідні','3/3','monthly'),
    p('hotel-night','Нічні 2/2 · За годину','Нічний час можна відредагувати','night-2/2','hourly'),
    p('hotel-unit','2/2 · За послугу','Відрядна оплата за роботу','2/2','per_unit','послуга'),
  ],
  manufacturing:[
    p('factory-hours','4/2 · За годину','Змінна оплата й понаднормові','4/2','hourly','виріб'),
    p('factory-salary','5/2 Пн–Пт · Оклад','Стандартний виробничий тиждень','5/2-weekdays','monthly','виріб'),
    p('factory-night','День / ніч / 48 · Оклад','Послідовність денних і нічних змін','day-night-48','monthly','виріб'),
    p('factory-shift','3/3 · За зміну','Три робочі / три вихідні','3/3','per_shift','виріб'),
    p('factory-unit','2/2 · За виріб','Оплата за обсяг виконаної роботи','2/2','per_unit','виріб'),
  ],
  logistics:[
    p('log-unit','5/2 Пн–Пт · За доставку','Оплата за виконані доставки','5/2-weekdays','per_unit','доставка'),
    p('log-hours','2/2 · Погодинна','Облік часу на маршруті','2/2','hourly','доставка'),
    p('log-shift','4/2 · За зміну','Позмінна робота','4/2','per_shift','рейс'),
    p('log-salary','5/2 Пн–Пт · Оклад','Фіксований оклад','5/2-weekdays','monthly'),
    p('log-3-3','3/3 · Погодинна','Плаваючі зміни','3/3','hourly'),
  ],
  healthcare:[
    p('med-night','День / ніч / 48 · Оклад','Чергування з нічною зміною','day-night-48','monthly','процедура'),
    p('med-day','5/2 Пн–Пт · Оклад','Денна робота','5/2-weekdays','monthly','процедура'),
    p('med-hours','2/2 · Погодинна','Позмінні години','2/2','hourly','процедура'),
    p('med-duty','Добова / 3 вихідних','24-годинне чергування, перевір перерви','duty-24-72','per_shift','чергування'),
    p('med-unit','5/2 Пн–Пт · За послугу','Оплата за виконані послуги','5/2-weekdays','per_unit','послуга'),
  ],
  education:[
    p('edu-salary','5/2 Пн–Пт · Оклад','Планові робочі дні','5/2-weekdays','monthly','заняття'),
    p('edu-lesson','5/2 Пн–Пт · За урок','Оплата за проведене заняття','5/2-weekdays','per_unit','заняття'),
    p('edu-hour','5/2 Пн–Пт · Погодинна','Оплата за години викладання','5/2-weekdays','hourly','заняття'),
    p('edu-six','6/1 · За заняття','Шість робочих днів','6/1','per_unit','заняття'),
  ],
  construction:[
    p('build-hour','5/2 Пн–Пт · За годину','Зміни на будмайданчику','5/2-weekdays','hourly','об’єкт'),
    p('build-six','6/1 · За день/зміну','Шість робочих, один вихідний','6/1','per_shift','об’єкт'),
    p('build-project','5/2 Пн–Пт · За обсяг','Відрядна оплата','5/2-weekdays','per_unit','завдання'),
    p('build-seven','7/7 · Оклад','Вахтовий цикл','7/7','monthly','об’єкт'),
  ],
  agriculture:[
    p('agri-six','6/1 · Погодинна','Сезонна робота','6/1','hourly','тонна'),
    p('agri-shift','4/2 · За зміну','Робота змінами','4/2','per_shift','тонна'),
    p('agri-unit','5/2 Пн–Пт · За виробіток','Оплата за одиницю продукції','5/2-weekdays','per_unit','одиниця'),
    p('agri-seven','7/7 · Погодинна','Циклічна робота','7/7','hourly'),
  ],
  security:[
    p('guard-24','Добова / 3 вихідних','24 години чергування','duty-24-72','per_shift','чергування'),
    p('guard-night','День / ніч / 48','Денні й нічні чергування','day-night-48','monthly','чергування'),
    p('guard-2','2/2 · За годину','Позмінна охорона','2/2','hourly','чергування'),
    p('guard-3','3/3 · Оклад','Три зміни, три вихідні','3/3','monthly','чергування'),
  ],
  beauty:[
    p('beauty-units','2/2 · За послугу','Оплата за клієнта чи процедуру','2/2','per_unit','послуга'),
    p('beauty-hour','5/2 Пн–Пт · Погодинна','Оплата за зайняті години','5/2-weekdays','hourly','клієнт'),
    p('beauty-shift','3/3 · За зміну','Фіксована оплата зміни','3/3','per_shift','послуга'),
    p('beauty-salary','2/2 · Оклад','Фіксована база та додаткові виплати','2/2','monthly','послуга'),
  ],
  cleaning:[
    p('clean-hours','5/2 Пн–Пт · Погодинна','Оплата за відпрацьований час','5/2-weekdays','hourly','об’єкт'),
    p('clean-unit','5/2 Пн–Пт · За об’єкт','Оплата за завершені прибирання','5/2-weekdays','per_unit','об’єкт'),
    p('clean-shift','2/2 · За зміну','Позмінна робота','2/2','per_shift','об’єкт'),
    p('clean-six','6/1 · За об’єкт','Шестиденний тиждень','6/1','per_unit','об’єкт'),
  ],
  transport:[
    p('drive-hour','2/2 · За годину','Врахування часу рейсів','2/2','hourly','рейс'),
    p('drive-unit','5/2 Пн–Пт · За рейс','Оплата за кожен виконаний рейс','5/2-weekdays','per_unit','рейс'),
    p('drive-shift','4/2 · За зміну','Циклічний графік','4/2','per_shift','рейс'),
    p('drive-week','7/7 · Оклад','Вахтовий графік','7/7','monthly','рейс'),
  ],
  events:[
    p('event-hour','2/2 · Погодинна','Подієві зміни, дати можна змінити','2/2','hourly','подія'),
    p('event-shift','1/1 · За зміну','Чергуються робочий і вихідний','1/1','per_shift','подія'),
    p('event-unit','5/2 Пн–Пт · За подію','Відрядна робота','5/2-weekdays','per_unit','подія'),
    p('event-week','3/3 · Погодинна','Сезонний змінний графік','3/3','hourly'),
  ],
  service:[
    p('service-hour','5/2 Пн–Пт · Погодинна','Оплата за години','5/2-weekdays','hourly','послуга'),
    p('service-unit','2/2 · За послугу','За клієнта чи завдання','2/2','per_unit','послуга'),
    p('service-shift','3/3 · За зміну','Змінна робота','3/3','per_shift','послуга'),
    p('service-salary','5/2 Пн–Пт · Оклад','Фіксована ставка за місяць','5/2-weekdays','monthly','послуга'),
  ],
  freelance:[
    p('free-project','5/2 Пн–Пт · За проєкт','Власні завдання й облік','5/2-weekdays','per_unit','проєкт'),
    p('free-hour','5/2 Пн–Пт · Погодинна','Клієнтські години','5/2-weekdays','hourly','проєкт'),
    p('free-shift','2/2 · За зміну','Для підробітків','2/2','per_shift','завдання'),
    p('free-week','3/3 · За завдання','Власний змінний ритм','3/3','per_unit','завдання'),
  ],
  other:[
    p('other-hour','5/2 Пн–Пт · Погодинна','Простий стартовий графік','5/2-weekdays','hourly'),
    p('other-salary','5/2 Пн–Пт · Оклад','Оклад за планом роботи','5/2-weekdays','monthly'),
    p('other-shift','2/2 · За зміну','Циклічні зміни','2/2','per_shift'),
    p('other-unit','4/2 · За одиницю','Оплата за результат','4/2','per_unit','завдання'),
    p('other-night','День / ніч / 48','Чергування з нічним часом','day-night-48','hourly'),
  ],
}
/** No implied rates: user can start with an empty cycle and configure payment later. */
export const createSelfPreset:JobPreset = p('create-self','Створи сам','Порожній старт: сам обираєш послідовність днів, час, оплату й бонуси. Нічого з чинних правил не перезаписується.','custom','hourly')
export const allSuggestions = Object.values(suggestions).flat()
export function suggestedPresets(sector:Sector):JobPreset[]{return suggestions[sector]}
