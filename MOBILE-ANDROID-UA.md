# PayTakt Mobile — Android (перший тестовий APK)

Це перший етап перенесення на Android через Capacitor 8. Ми **не переписуємо**
React/Vite/Firebase, не змінюємо Firestore Rules і не публікуємо застосунок у магазині.
Поточний результат — Android WebView з локально вбудованою зібраною версією PayTakt
та доступом до чинного Firebase через інтернет.

## Варіант А — APK через GitHub Actions (без Android Studio)

1. Увімкніть зміни з гілки `feature/android-capacitor-bootstrap` у `main` (merge pull request).
2. Відкрийте GitHub → **PayTakt_** → **Settings** →
   **Secrets and variables** → **Actions** → **New repository secret**.
3. Додайте з вашого локального `.env` окремими секретами:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
   - (за наявності) `VITE_FIREBASE_STORAGE_BUCKET`
   - (за наявності) `VITE_FIREBASE_MESSAGING_SENDER_ID`
   
   Значення можна взяти з конфігурації Web App у Firebase Console.
   Не додавайте сюди Admin SDK JSON, приватні ключі чи паролі користувачів!
4. Відкрийте **Actions** → **Android debug APK** → **Run workflow** → `main`.
5. Коли запуск успішно завершиться, відкрийте його результати → **Artifacts** →
   **PayTakt-Android-debug**. Завантажте ZIP і витягніть `app-debug.apk`.
6. Передайте APK на Android-телефон та відкрийте файл. За потреби Android
   попросить дозволити встановлення з цього джерела.

> Це **debug APK** для тесту, не підписаний стабільним ключем випуску. APK,
> зібрані в різних запускax GitHub Actions, можуть мати різні debug-підписи:
> наступну версію може знадобитися встановити після видалення попередньої.
> Важливі дані повинні бути синхронізовані з Firebase до видалення застосунку.
> Для постійних оновлень налаштуємо власний ключ підпису (release keystore).

## Варіант Б — APK на ПК з Windows

Вимоги:
- Node.js **22+** (`node -v`).
- Android Studio **2025.2.1+**, Android SDK Platform 36 / Build Tools 36.
- Робочий `.env` PayTakt (див. `.env.example`) з конфігурацією Firebase.
- Git, Java/Gradle встановлюються або налаштовуються через Android Studio.

Команди у PowerShell, у корені клонованого проєкту:

```powershell
git clone https://github.com/viliesov-d/PayTakt_.git
cd PayTakt_
# Якщо Android-зміни ще в окремій гілці:
git switch feature/android-capacitor-bootstrap

# Додайте ваш локальний .env перед збіркою. У GitHub його не завантажуйте.
npm.cmd ci
npm.cmd run android:setup
npm.cmd run android:open
```

Скрипт `android:setup` встановлює сумісні пакети Capacitor 8,
оновлює `package.json` та `package-lock.json`, збирає вебзастосунок і
створює директорію `android/` (повторний запуск робить sync).
У Android Studio дочекайтеся Gradle Sync і натисніть **Build → Build APK(s)**.
Локальний тестовий APK зазвичай розташований тут:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Після редагування React-коду:

```powershell
npm.cmd run android:sync
```

Це повторно виконає Vite/TypeScript-збірку і перенесе її до Android.
Для запуску на підключеному телефоні/емуляторі:

```powershell
npm.cmd run android:run
```

Директорію `android/` згодом потрібно зберегти у Git як частину проєкту
(не плутати з її тимчасовими файлами, які вже виключені `.gitignore`).
На початковому етапі скрипт та GitHub Actions генерують її автоматично.

## Що перевірити на телефоні

1. Відкривається PayTakt з іконки без адресного рядка браузера.
2. Працює реєстрація/вхід через email і пароль та вихід із системи.
3. Відкривається календар, змінюються місяці та редагуються робочі дні.
4. Після збереження та перезапуску видно ті самі дані з Firestore.
5. Працюють темна й світла теми, налаштування, розрахунок зарплати.
6. Немає горизонтального прокручування й перекриття системними панелями.
7. Після зникнення інтернету раніше відкриті дані можуть бути доступні з кешу;
   **повноцінне редагування офлайн наразі не реалізоване**.

## Обмеження першого етапу

- Вхід через email/password уже є у PayTakt. Вхід через Google та інші
  OAuth-провайдери потребуватиме окремої нативної інтеграції.
- Сповіщення, біометричний вхід, Android Back та безшовні оновлення ще не додані.
- Наявний Firestore IndexedDB-кеш не є гарантією надійного офлайн-редагування.
- Перед розповсюдженням за межами тестової групи потрібні перевірка правил
  безпеки Firebase, стабільний release-підпис, іконка та splash screen.
- Вебверсія PayTakt лишається окремою і працює як раніше.

Документація: https://capacitorjs.com/docs/getting-started
і https://capacitorjs.com/docs/android .
