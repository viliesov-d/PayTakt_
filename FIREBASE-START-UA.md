> **Оновлення v0.9.4:** після перенесення `.env` обов'язково опублікуй `firestore.rules` з цього архіву, щоб дозволити власнику робочого простору зберігати план і премії (`settings/performance`, `monthlyTargets`, `dailyWages`). Старий Firebase не потрібно замінювати. Докладніше — `PATCH-INSTRUCTIONS-UA.md`.

> **Для v0.8.6 дивіться спочатку `PATCH-INSTRUCTIONS-UA.md` і `FIRESTORE-RULES-SAFETY-UA.md`: перевірку запису `paySettings` змінено.**

# PayTakt v0.8.2 — важлива зміна

Після оновлення обов’язково опублікуйте **весь файл firestore.rules з v0.8.2**. Додана гілка `/workspaces/{workspaceId}/settings/overtime` і поле `overtimeExtra` в документі зміни. Деталі діагностики `paySettings/current` — `FIREBASE-RULES-CHECK-UA.md`.

# PayTakt v0.8.1 — перевірка Firestore при «Немає доступу до даних»

Починаючи з v0.8.1, після вибору будь-якого шаблону застосунок **не записує** `paySettings/current` автоматично. Вибір лише відкриває календар; налаштування оплати треба зберегти окремо у «Правилах оплати». Це дозволяє обирати шаблони без зайвого запису. Якщо помилка з’являється під час збереження правил або графіка, виконайте діагностику нижче.

1. Перевірте `.env` у корені нового архіву: `VITE_FIREBASE_PROJECT_ID` повинен збігатися з **Project ID** у Firebase Console. Не копіюйте до чатів приватні ключі або service account JSON.
2. Firebase Console → потрібний проєкт → **Firestore Database → обрати базу (default) → Rules**. Замініть **весь** текст правилами з файлу `firestore.rules` цього архіву, натисніть **Publish**. Заміна локального файлу не публікує правила автоматично.
3. Дочекайтеся оновлення правил; повторно відкрийте сайт. Перевірте, що ви залогінені у правильний акаунт.
4. У Firestore Database → Data знайдіть `workspaces/{workspaceId}`. Поле `ownerUid` повинно збігатися з UID користувача з Firebase Authentication. Не змінюйте чужі `ownerUid` і не вимикайте захист бази.
5. Спробуйте ще раз обрати рекомендований шаблон. Повідомлення PayTakt тепер відрізняє проблеми з доступом до `workspaces/{workspaceId}` від відхилення запису `workspaces/{workspaceId}/paySettings/current`.
6. Якщо власник підтверджений, але запис все ще заборонено: Firestore Database → Rules → **Rules Playground**, авторизований запит `create`/`update` для `workspaces/{workspaceId}/paySettings/current`, UID власника, поля документа версії 5. Перевірте, яке правило відхиляє запис. Playground перевіряє правила в редакторі, а не обов'язково опубліковані правила.

У новому архіві схема paySettings **не змінювалася** порівняно з v0.8; переписувати дані користувача не потрібно. Причину відмови саме вашого Firebase-проєкту неможливо підтвердити без тестування опублікованих правил та конкретного документа.

## Запуск

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Файл `.env` з попередньої версії переносьте у корінь папки нового проєкту. Не завантажуйте `.env` у GitHub.
