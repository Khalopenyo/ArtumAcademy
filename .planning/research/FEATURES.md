# Feature Research

**Domain:** Платная LMS для одного автора курсов (single-instructor course platform), РФ/СНГ рынок
**Researched:** 2026-05-24
**Confidence:** HIGH (для критического пути «landing → register → pay → watch» подтверждено по 8 конкурентам и нормативным источникам; MEDIUM для эджевых UX-фич типа watermark, certificates)

## Контекст и scope

Этот документ описывает feature landscape для VideoEdit Academy. **Жёсткое ограничение:** M1 = single-course MVP за 4–6 недель соло. Архитектура поддерживает несколько курсов (БД нормализована), но в v1 продаётся ровно один курс, создаваемый через миграцию + seed, без админки.

Все альтернативы оценены в плоскости «РФ/СНГ-рынок»: западные паттерны (Stripe Checkout, OAuth Google, magic links, Vimeo Pro) либо неприменимы юридически, либо отрезаны санкциями, либо вызывают культурное недоверие у целевой аудитории.

## Feature Landscape

### Table Stakes v1 — Must-Have (без этого продукт не работает)

Это то, без чего критический путь «зашёл → купил → смотрит» физически не выполним, либо нарушается закон, либо пользователь обоснованно требует возврат денег.

| Feature | Why Expected | Complexity | Зависимости | Notes |
|---|---|---|---|---|
| Публичный лендинг курса (hero, программа, цена, CTA) | Без посадочной нет конверсии — пользователь приходит из рекламы/SEO | S | — | Server Component, статика, OG-теги для VK/Telegram preview. Один файл `(marketing)/page.tsx` + `(marketing)/course/[slug]/page.tsx` |
| Регистрация email + пароль + verify email | Доступ к платному контенту требует уникальной учётной записи; verify нужен для доставки чека по 54-ФЗ | S | Supabase Auth | Supabase Auth с email confirmation включен по умолчанию. Чекбокс согласия 152-ФЗ — обязателен (см. ниже) |
| Логин + сохранение сессии + logout | Очевидно | S | Supabase Auth + middleware | Уже есть `updateSession()` в `src/lib/supabase/middleware.ts` |
| Восстановление пароля по email | Пользователь забудет пароль на 2-й день, без recovery — потеря клиента и негатив | S | Supabase Auth | Встроено в Supabase Auth, нужен только UI form + redirect route |
| Согласие на обработку перс. данных (152-ФЗ) | **Юридическое требование РФ.** Без явного согласия чекбоксом сбор данных = штраф (для ИП до 100k₽, повторно до 300k₽). Согласие должно быть до отправки формы, не предзаполнено | S | Privacy Policy страница `/privacy` | Чекбокс «Я согласен с [Политикой обработки персональных данных]» отдельно от чекбокса оферты. Хранить факт согласия (timestamp, версия документа, IP) в БД |
| Публичная оферта (договор-оферта) | **Юридическое требование РФ.** Без оферты онлайн-продажа = неоформленная сделка. ЮKassa при подключении требует ссылку на оферту в заявке | S | Страница `/oferta` + реквизиты ИП/самозанятого | Содержит: реквизиты продавца (ИНН, ОГРНИП, банк), предмет договора, цена, порядок оказания услуги, возврат, ответственность. Шаблоны есть на info-hit.ru, getcourse.ru/oferta. Юрист на одну консультацию (~5–15k₽) рекомендуется |
| Страница курса с детальной программой и кнопкой «Купить» | Конверсия зависит от прозрачности «что я получаю» | S | Каталог в БД (есть) | Один Server Component, читает `getCourseBySlug()` |
| Создание платежа через ЮKassa (server action) | Без приёма денег нет бизнеса. ЮKassa = только реалистичный провайдер для РФ (Stripe/Paddle отрезаны санкциями) | M | server action, секреты в env | Карта visa/mc/мир + СБП в одной форме оплаты ЮKassa. Server action, никогда service_role в браузер. `Idempotence-Key` обязателен |
| Передача данных чека в ЮKassa (54-ФЗ) | **Юридическое требование РФ.** При продаже физ.лицу нужен фискальный чек. ЮKassa печатает чек если передать email/phone + позицию товара в payment.create | S | ЮKassa create payment | В `receipt.customer.email` = email пользователя; `receipt.items` = название курса, сумма, ставка НДС (обычно «без НДС» для самозанятого/УСН-6%), payment_subject = `service`, payment_mode = `full_prepayment`. Без этого — штраф по 54-ФЗ |
| Webhook `payment.succeeded` с проверкой подписи и идемпотентностью | Без webhook нельзя надёжно выдать доступ — клиент может закрыть вкладку до redirect. Подпись HMAC обязательна, иначе любой может подделать выдачу | M | Route Handler, БД таблица `webhook_events` | Уникальный constraint на `event_id` → дубликат = 200 OK без побочных эффектов. Только webhook выдаёт доступ, redirect страница — для UX |
| Запись покупки в БД + выдача доступа | Очевидно | S | таблица `purchases` или `enrollments` | Транзакция в webhook: insert purchase + insert enrollment (user_id, course_id, granted_at). RLS: пользователь видит только свои покупки |
| Success / failure страницы после оплаты | Без них юзер видит белый экран и не понимает что произошло | S | — | Success: «Спасибо за покупку, доступ откроется через минуту, проверьте почту» + ссылка в кабинет. Failure: «Что-то пошло не так, деньги не списаны, попробуйте снова» |
| Защищённый layout кабинета (auth gate) | Без auth gate любой URL открывается всем | S | `(app)/layout.tsx` | Уже описано в STRUCTURE.md — `requireUser()` в layout, redirect на `/login` |
| Дашборд «Мои курсы» | Без него купивший не понимает где смотреть | S | server query `getMyEnrollments` | Карточка курса с кнопкой «Продолжить просмотр». Для MVP — простой список |
| Страница урока с защищённым плеером Kinescope | Это **core value** проекта | M | Kinescope embed + signed URL/private link | См. ниже отдельный разбор Kinescope. Server-side проверка `hasAccess(userId, courseId)` перед рендером iframe |
| Server-side authorization для видео | Без этого любой залогиненный юзер увидит чужой курс через подбор URL | M | server query + middleware | На каждый запрос страницы урока: `requireUser()` → `hasAccess()` → fetch signed URL/sign embed. Никогда не доверять клиенту |
| Право на удаление аккаунта (152-ФЗ) | **Юридическое требование РФ.** Субъект перс. данных вправе требовать удаления. По регламенту — в течение 30 дней | S | server action `deleteAccount` | Кнопка в профиле «Удалить аккаунт» → подтверждение → soft delete (анонимизация email/имени, сохранение purchases для бухучёта 4 года по 54-ФЗ) |
| HTTPS + security headers | Очевидно | S | next.config.js (есть) | HSTS, X-Frame-Options DENY, CSP без `unsafe-inline` в production |
| Rate limiting на auth + payment endpoints | Без него — brute force паролей, спам регистраций, бомбардировка ЮKassa | S | Upstash/Vercel KV или Supabase Edge | На /login, /register, /reset-password, /create-payment. 5 req/min/IP минимум |

**ИТОГО v1 — 18 фич, оценка ~3–4 недели разработки соло. Это и есть real MVP scope.**

### Table Stakes v2 — Users Expect, Tolerable с минимальной альтернативой

Это то, что пользователи ожидают, но в MVP можно обойтись минимальным вариантом без потери критического пути. Полная реализация — в M2.

| Feature | Why Expected | MVP alt | Complexity full | Зависимости | Notes |
|---|---|---|---|---|---|
| Email о покупке (welcome + ссылка на курс) | После оплаты юзер ждёт письма «всё ок, вот доступ». Чек от ЮKassa приходит отдельно и выглядит как госуслуги — не заменяет welcome | Webhook отправляет письмо через Supabase Auth SMTP (бесплатно, 3/hr лимит) или Resend free tier; HTML минимальный — заголовок + ссылка в кабинет | M | Email provider (Resend/Unisender в M2) | Supabase Auth дефолтный SMTP **категорически нельзя** для production (rate limit 3/hr, домен `supabase.co` в спам). В MVP — Resend free tier (3000/mo) с custom domain + SPF/DKIM. Unisender — в M2 для маркетинга. **Mail.ru/Yandex деливерабельность критична для РФ-аудитории** — без SPF+DKIM+DMARC письма уйдут в спам |
| Email подтверждения регистрации | См. выше — нужен для confirm flow | Тот же Resend, шаблон от Supabase Auth | S | Email provider | Supabase Auth генерирует ссылку и передаёт в SMTP кастомный |
| Email сброса пароля | Очевидно | Тот же Resend | S | Email provider | См. выше |
| Прогресс просмотра урока (started / completed) | Юзер хочет видеть «где я остановился», переключаясь между устройствами | Только бинарная отметка «начато / завершено», без точки времени | S full / S alt | Kinescope events + БД `lesson_progress` | Kinescope SDK даёт `play`, `pause`, `ended` события. В MVP — слушаем `ended` → upsert в `lesson_progress`. «Continue from N seconds» — в M2 |
| Список уроков в курсе с прогрессом | Чтобы видеть структуру и где я нахожусь | Простой список с галочкой «просмотрено» | S | server query + progress данные | Sidebar или верх страницы курса. Один query `getLessonsWithProgress(courseId, userId)` |
| Видеоплеер с adaptive bitrate + полноэкранным режимом | Юзер на мобильном/слабом интернете не сможет смотреть без ABR | Kinescope даёт ABR из коробки | — | Kinescope | Не делаем сами, это часть Kinescope |
| Профиль с именем и email (минимум) | Юзер хочет видеть «как меня зовут» и сменить пароль | Read-only имя + email + кнопка «Сменить пароль» (redirect на forgot-flow) | S | server action update profile | Имя сохраняется при регистрации. Аватар, телефон — M2 |
| Чек как электронный документ доступен в кабинете | Юзер хочет «где мой чек / документ об оплате» для бухгалтерии | Достаточно письма от ЮKassa со ссылкой на чек на ofd.yookassa.ru (приходит автоматически) | M full / 0 alt | — | В M2 — страница «Мои покупки» со списком чеков по ссылке от ОФД. Свою генерацию чеков **не делаем никогда** (это 54-ФЗ ответственность ЮKassa) |
| FAQ на лендинге | Юзер хочет ответы на «как оплатить», «когда доступ», «возврат» | Статический FAQ блок на лендинге, 6–10 вопросов | S | — | Server Component с массивом QA. Snippets для SEO |
| Контакты поддержки (email или Telegram-бот) | При проблеме с оплатой юзер должен знать куда писать | mailto: ссылка + Telegram contact в футере | S | — | Telegram = культурный стандарт РФ для саппорта мелких школ. WhatsApp — для regions/CIS. Чат-виджет (Jivo/Carrot) — M2 |
| Адаптивная мобильная вёрстка | 60%+ трафика РФ EdTech идёт с мобайла | Tailwind responsive утилиты с самого начала | M (всё время) | — | Не отдельная фича, а сквозное требование. Playwright проект `mobile-chrome` уже настроен |
| Loading states + error states | Без них продукт ощущается «сломанным» | shadcn Skeleton + error.tsx в каждом route group | S | shadcn | Уже учтено в архитектуре (loading.tsx, error.tsx App Router паттерн) |
| Базовая SEO (title, description, OG) | Без OG картинки превью в VK/Telegram выглядит мёртво — конверсия из соц-сетей нулевая | Metadata API в `layout.tsx` + OG image статика | S | — | Один static OG image (1200×630) для всех страниц курса в MVP. Динамические OG на курс — M2 |
| Sentry или аналог для error tracking | Production без error tracking = слепое управление | Sentry free tier (5k events/mo) | S | — | См. STACK.md, но решение «да, нужно в M1» — без него после деплоя любая ошибка =  тикет от юзера в Telegram |

### Differentiators — Worth Considering (не в M1, но обсудить в M2+)

Это то, что отличает продукт от GetCourse / Skillbox и может оправдать выбор именно VideoEdit Academy. **Все вынесены за M1**, в этом исследовании только для контекста roadmap.

| Feature | Value Proposition | Complexity | Зависимости | Когда добавлять |
|---|---|---|---|---|
| Persona watermark на видео (email/имя пользователя поверх кадра) | Сильно снижает желание сливать курс — слив идентифицируется. Kinescope поддерживает из коробки | S (включить в Kinescope) | Kinescope Pro tariff | M2, сразу когда видео начнут утекать. Стоит запасть в архитектуру: передаём userId в Kinescope embed |
| Резюме (recap) автогенерация урока через LLM | Юзер быстрее ориентируется «о чём урок», SEO-friendly | M | LLM API (GPT-4/Claude) | M3+, когда курсов будет 3+. Один раз сгенерировать, человек правит |
| Конспект / pdf-материалы к уроку | Стандартная фича авторских курсов («скачайте чеклист, шаблон проекта DaVinci») | S | Supabase Storage | M2. Уже есть Storage в Supabase. Просто `materials` таблица + UI |
| Домашние задания с проверкой куратором | Главное отличие «школы» от «видеокурса». Skillbox/Нетология строят на этом весь бизнес | L | Submission flow, role curator, файлы в Storage, очереди ревью | M3+. Слишком много инфраструктуры для M2. Каркас уже есть (`user_roles` enum включает `curator`) |
| Сертификат после завершения курса | Эмоциональный value, повод для соц-доказательства (поделиться в VK/LinkedIn) | M | PDF generation (`@react-pdf/renderer` или Edge function) | M3+. Без подтверждения спроса (минимум 50 продаж) — overengineering |
| Telegram-бот для уведомлений и саппорта | Культурный стандарт РФ. Push-уведомлений на web нет в Safari iOS, email медленный, Telegram = norm | M | Telegram Bot API + связка user→chatId | M2. Уведомления: «новый урок открыт», «осталась 1 неделя курса». Саппорт — позже |
| Промокоды и реферальная программа | Стандартный РФ-инструмент привлечения через блогеров/партнёров | M | таблица `promocodes`, валидация в payment flow | M2 после подтверждения спроса. ЮKassa поддерживает динамическую цену в payment.create |
| Подписка вместо разовой оплаты курса | Тренд EdTech (Coursera Plus, Skillbox Premium, GetCourse подписки) | L | ЮKassa recurring + автосписания + reactivation flow | M3+. Только если контент-каталог >10 курсов и есть retention данные |
| Сообщество выпускников (форум / Telegram-чат с авто-инвайтом) | Удержание, доп.ценность, word-of-mouth | M | Telegram invite link generation + bot для kick неоплативших | M2. Telegram-канал с инвайт-ссылкой генерируемой при покупке = 1 день работы |
| Налоговый вычет messaging (для физ.лиц получающих образование) | **РФ-specific:** социальный налоговый вычет 13% с расходов на обучение возможен если у школы лицензия на образовательную деятельность. У ИП без лицензии — НЕТ вычета | S (только текст) | Лицензия Рособрнадзора | **Только если есть лицензия.** Без лицензии — не упоминать вообще, иначе обман потребителя (закон о рекламе). Большинство мелких авторских школ работают без лицензии и явно пишут «не является образовательной услугой» |
| English UI / multilingual | Рынок СНГ (Казахстан, Беларусь) — русский ок. Армения, Грузия — английский плюс | M | i18n setup (next-intl) | M3+. В MVP — только русский. Архитектура должна допускать i18n (не хардкодить строки разбросанно), но не делать сейчас |
| A/B тестирование лендинга | Конверсия — главный рычаг роста | M | Vercel Edge Config или PostHog | M2. До 1000 уников в месяц A/B бессмысленен (нет статзначимости) |

### Anti-Features — Deliberately NOT Building

Это то, что выглядит хорошей идеей, но создаёт больше проблем чем решает. **Каждый пункт с причиной, чтобы не возвращался без явного решения.**

| Feature | Why Requested / Surface Appeal | Why Problematic | Alternative |
|---|---|---|---|
| **OAuth Google / Apple / Facebook login** | «Все так делают на Западе, удобнее» | (1) Google/Apple OAuth требует verified domain + privacy policy на английском, для РФ ИП — головная боль с App Store dev account. (2) Facebook заблокирован в РФ. (3) ЦА доверяет email больше чем OAuth (Google = «утекут данные»). (4) Замена 1 формы регистрации на 4 кнопки = больше bugs, больше edge cases (account linking, conflicting emails) | Email+password в M1. **VK OAuth** в M2 если массовый запрос (но VK API нестабилен). Yandex ID — спорно, аудитория не любит «Яндекс знает обо мне всё» |
| **Magic link login (без пароля)** | «UX лучше, как у Substack/Notion» | (1) Mail.ru/Yandex задерживают письма от незнакомых доменов 5–60 мин — юзер уйдёт. (2) Magic link в спаме = клиент потерян. (3) Привычка РФ-аудитории к паролям. (4) Если основной канал email сломан (deliverability), magic link ломает 100% логинов | Email+пароль с recovery по email. Magic link добавить опционально после стабилизации deliverability (M3+) |
| **Мобильное приложение (iOS/Android native)** | «Все курсовые платформы имеют приложение» | (1) App Store / Play Store dev accounts заблокированы для РФ-разработчиков с 2022. (2) RuStore — отдельная экосистема, 0 органики. (3) Web push на iOS появился только в 2023 и работает плохо. (4) Поддержка native app = 3-кратный объём разработки | PWA-манифест уже добавлен (`public/manifest.json`). На Android = «добавить на главный экран» работает. На iOS — Safari open. **Никогда** не делать native. Зафиксировано в PROJECT.md как «never» |
| **Скачивание видео для offline** | «Я в дороге, хочу смотреть в самолёте» | **Прямо противоречит Core Value** (защита контента). Любой download = слив на торренты. Технически Kinescope DRM не даёт скачать, но если сделаем download — потеряем смысл DRM | Encourage online watching. Скачивание материалов (PDF, шаблоны проектов) — да; видео — никогда |
| **Свой кастомный видеоплеер (HLS.js / Video.js)** | «Дешевле чем Kinescope, контролируем UI» | (1) Защита от download через свой плеер = иллюзия (любой js-плеер скачивается через DevTools или yt-dlp). (2) DRM (Widevine/FairPlay) требует лицензий и стоит >$1000/mo. (3) Adaptive bitrate, мульти-CDN, региональная доставка — сами не сделаем без 6 человеко-месяцев | Kinescope (private + DRM). RuTube embed — fallback если Kinescope тариф станет неподъёмным. **Никогда** — свой HLS-сервер |
| **Real-time чат урок-чат (live)** | «Хочу видеть кто ещё смотрит, общаться» | (1) Требует WebSocket-инфраструктуры (Supabase Realtime поддерживает, но scaling спорный). (2) Чат пустой = «продукт мёртвый», чат активный = модерация = команда людей. (3) К теме видеомонтажа не относится | Telegram-канал/чат отдельно (M2) — низкая модерация, культурный стандарт |
| **Stripe / PayPal / Apple Pay через third-party** | «Принимать платежи от заграничных учеников» | (1) Stripe / PayPal не работают с РФ ИП с 2022. (2) Серые схемы (Stripe Atlas через делавэрский LLC) — налоговое преступление в РФ (нерезидентский счёт без декларирования). (3) Целевой рынок РФ/СНГ — у них рублёвые карты | ЮKassa (visa/mc/мир + СБП). Для СНГ-клиентов: карты других стран работают через мерчанта-эмитента (Tinkoff/Сбер часто пропускают). Криптовалюта — нет (легализована частично, не cargo cult) |
| **Курсовый форум / комментарии под уроками** | «Like Coursera, обсуждение между студентами» | (1) Нужна модерация (русскоязычный спам = катастрофа). (2) Курс на 10 студентов = пустой форум = социальное доказательство «никого нет». (3) Привычки РФ-аудитории — общаются в Telegram, не на сайтах | Telegram-чат выпускников (M2). Под видео — только лайк/реакция (M3+ если запросят) |
| **Видеоконференции (Zoom-like) для лекций** | «Live-мастер-классы, как у Нетологии» | (1) Не записанный курс ≠ MVP формат. (2) WebRTC своими руками = провал. (3) Интеграция Zoom = месяц работы | Запись лекции загружается в Kinescope как обычный урок. Live = повод для отдельного продукта позже |
| **Геймификация (баллы, бейджи, левелы)** | «Engagement, как Duolingo» | (1) Работает только при контент-каталоге >50 уроков и регулярных push. (2) Дешёвая геймификация = инфантильно для профессиональной аудитории (видеомонтажёры 25–40). (3) Сильно усложняет схему БД и UI | Прогресс-бар по курсу — да (это не геймификация, это навигация). Бейджи — нет |
| **AI-ассистент / chatbot для вопросов по урокам** | «Тренд 2025–2026» | (1) LLM-ответы по чужому курсу = риск некорректного совета, репутация автора страдает. (2) Стоимость API в production непредсказуема. (3) RAG-индексация уроков = недели работы | FAQ страница вручную (M1). LLM-recap уроков — может быть M3+, но как контент-помощник автору, не пользователю |
| **Мульти-валютность ($ / €)** | «Для СНГ-клиентов удобнее в долларах» | (1) ЮKassa принимает только рубли (резидент РФ). (2) Конвертация по курсу ЦБ + комиссия банка ≠ удобство, ≠ прозрачность. (3) Цена в рублях для СНГ-клиента норма (Казахстан, Армения, Грузия привыкли) | Цена в ₽. Подсказка «примерно $X / KZT Y» — может быть в M3+, не критично |
| **Email-маркетинговые рассылки (newsletter, drip-campaigns)** | «Прогревать аудиторию, продавать допы» | Это **отдельный домен** (CRM, сегментация, deliverability, отписки 152-ФЗ). Не критический путь оплаты. **Зафиксировано в PROJECT.md как M2 через Unisender** | Транзакционные письма через Resend в M1. Маркетинг через Unisender в M2 |
| **Админ-панель курсов в M1** | «Чтобы автор сам мог менять описание, цену» | Полноценный CMS = 2+ недели CRUD + RBAC + audit log + UI. **Зафиксировано в PROJECT.md как M2** | M1: курс создаётся через SQL миграцию + seed. Изменение цены/описания = новая миграция (для 1 курса допустимо). M2: админка |
| **Multi-tier тарифы курса (Basic / Pro / VIP)** | «Стандарт EdTech, выше средний чек» | (1) Усложняет схему БД (`tier` колонка в purchases + access control per-tier). (2) В MVP — один курс, одна цена = простота тестирования воронки. (3) Tier’ы оправданы когда есть differentiators (личная встреча с автором в VIP) — в M1 их нет | Один курс — одна цена. Промокоды и скидки — M2 |
| **Сертификаты в M1** | «Студент хочет показать достижение» | Полноценные сертификаты = PDF generation + хранение + verification page + дизайн шаблона. **Зафиксировано в PROJECT.md как deferred** | M3+ после подтверждения спроса. До этого — поздравительное письмо «вы прошли курс» (М2) |
| **Подписка на платформу (recurring)** | «Pricing model тренд» | Один курс = один платёж, очевидно. Subscription — для каталога курсов | M3+ когда курсов будет 5+ |
| **Reviews / отзывы внутри платформы с модерацией** | «Социальное доказательство на лендинге» | (1) Модерация. (2) Накрутка собственными аккаунтами = недоверие. (3) Юридический риск (отзыв с матом → негатив автору) | Статичные testimonials на лендинге (тексты, скриншоты соц-сетей с разрешения) в M1. UGC-отзывы — M3+ если вообще |
| **Видео-приветствие автора на лендинге (autoplay с звуком)** | «Engaging, личный контакт» | Браузеры блокируют autoplay со звуком (Chrome/Safari). Без звука — бессмысленно. Замедляет страницу | Видео в hero **с кнопкой play** (без autoplay) — да. Autoplay видео в hero — нет |
| **Прохождение курса в строгом порядке (lock следующего урока)** | «Чтобы не перескакивали» | (1) Раздражает взрослую аудиторию профессионалов (хочу смотреть DaVinci сразу, теория — потом). (2) Сложная логика разблокировки + UX-индикация. (3) Если урок не открывается — юзер думает «я заплатил, а доступа нет» = тикет в саппорт | Свободный доступ ко всем урокам после покупки. Рекомендованный порядок — нумерация модулей |

## Feature Dependencies

```
[ЮKassa create payment]
    └──requires──> [ЮKassa receipt в payload (54-ФЗ)]
                       └──requires──> [Email от пользователя при checkout]
                                          └──requires──> [Registration с verify email]
                                                             └──requires──> [152-ФЗ consent checkbox]
                                                             └──requires──> [Privacy Policy /privacy]

[ЮKassa webhook payment.succeeded]
    └──requires──> [HMAC signature verification]
    └──requires──> [Идемпотентность через webhook_events table]
    └──requires──> [Запись purchase + enrollment]
                       └──enables──> [Доступ к страницам урока]
                                          └──requires──> [Server-side hasAccess() guard]
                                                             └──requires──> [Защищённый Kinescope embed (signed URL or backend auth)]

[Welcome email после оплаты]
    └──requires──> [Email provider с custom domain (Resend recommended)]
                       └──requires──> [SPF + DKIM + DMARC настройка домена]
                                          └──enables──> [Deliverability на mail.ru / yandex.ru]

[Прогресс просмотра]
    └──requires──> [Kinescope player events (play/pause/ended)]
    └──requires──> [lesson_progress таблица + RLS]
    └──enables──> [Continue watching карточка в дашборде]
    └──enables──> [Сертификат после 100% прогресса (M3+)]

[Публичная оферта]
    └──requires──> [Реквизиты ИП/самозанятого]
    └──requires──> [Юр.консультация или шаблон с проверкой]
    └──enables──> [ЮKassa подключение (требует ссылку на оферту в заявке)]
    └──enables──> [Чекбокс «согласен с офертой» на checkout]

[Право на удаление аккаунта]
    └──requires──> [Soft delete с анонимизацией (нельзя hard delete: purchases хранятся 4 года по 54-ФЗ)]
    └──conflicts──> [Hard delete user]

[Persona watermark (M2 differentiator)]
    └──requires──> [Передача userId в Kinescope embed config]
                       └──должно быть учтено в архитектуре M1 (даже если фича в M2)
```

### Dependency Notes (что роадмап обязан учесть)

- **152-ФЗ consent + Privacy Policy ДОЛЖНЫ быть в той же фазе что и Registration.** Нельзя выкатить регистрацию без них — это нарушение закона с первого юзера.
- **Публичная оферта ДОЛЖНА быть готова до подключения ЮKassa.** ЮKassa в заявке требует ссылку на оферту. Без оферты — нет приёма платежей. Параллелить: пока разработчик пишет код оплаты, юрист готовит оферту (1–2 недели lead time).
- **Email provider с custom domain настраивается с lead time 24–48ч** (DNS propagation для SPF/DKIM). Учесть в роадмапе — заказать домен и настроить DNS на неделю раньше чем нужны письма.
- **Webhook ОБЯЗАН быть идемпотентным до записи в purchases.** Двойная выдача доступа = бесплатный второй курс. Двойной email = недоверие. Сначала `webhook_events` insert (unique constraint на event_id), потом purchase + email.
- **Server-side hasAccess() — единственная защита контента.** Любая клиент-сайд проверка обходится. Должна быть в server query / server component, никогда в client component.
- **Persona watermark в M2 — но архитектура M1 должна допускать передачу userId в Kinescope.** Иначе придётся переделывать embed во всех уроках.

## MVP Definition (M1 — 4–6 недель соло)

### Launch With (v1) — Table Stakes v1 only + минимум v2

Это **ровно то, что в Table Stakes v1 + критический минимум Table Stakes v2**. Никаких differentiators в M1.

**Critical path (без чего нельзя ship):**

- [ ] Лендинг + страница курса (Server Components)
- [ ] Регистрация + login + logout + recovery (Supabase Auth)
- [ ] **152-ФЗ consent checkbox + Privacy Policy `/privacy`**
- [ ] **Публичная оферта `/oferta` + реквизиты продавца**
- [ ] ЮKassa payment creation (server action)
- [ ] **ЮKassa receipt в payload (54-ФЗ — email + позиция товара)**
- [ ] ЮKassa webhook с HMAC + идемпотентностью
- [ ] Выдача доступа (purchase + enrollment)
- [ ] Success/failure страницы
- [ ] Auth gate для `(app)` layout
- [ ] Дашборд «Мои курсы»
- [ ] Страница урока с Kinescope (private/signed) + server-side hasAccess
- [ ] Право на удаление аккаунта (152-ФЗ)
- [ ] HTTPS + security headers (есть)
- [ ] Rate limiting на auth + payment

**Critical minimum поверх (без чего MVP неюзабелен):**

- [ ] Welcome email + verify email + reset password через Resend (custom domain, SPF/DKIM)
- [ ] FAQ блок на лендинге
- [ ] Контакты поддержки (Telegram + email в футере)
- [ ] Адаптивная мобильная вёрстка (сквозное)
- [ ] Loading + error states (sceleton + error.tsx)
- [ ] Базовая SEO (Metadata API + статический OG image)
- [ ] Sentry для error tracking
- [ ] Smoke E2E тесты критического пути (Playwright)

### Add After Validation (v1.x / M2) — Table Stakes v2 full + критические differentiators

Триггер: первые 10–50 продаж, либо явный запрос от клиентов.

- [ ] **Прогресс просмотра в полную силу** (started → in_progress (%) → completed)
- [ ] **Continue watching карточка** на дашборде
- [ ] **Список уроков с прогрессом** в сайдбаре курса
- [ ] **Профиль с редактируемым именем + смена пароля inline**
- [ ] **Страница «Мои покупки» с историей чеков** (ссылки на ОФД)
- [ ] **Админ-панель курсов** (CRUD courses/modules/lessons, RBAC уже частично готов через `user_roles`)
- [ ] **Маркетинговые email через Unisender** (newsletter, drip-campaigns)
- [ ] **PDF/материалы к уроку** (Supabase Storage уже доступен)
- [ ] **Telegram-канал/чат с auto-invite** при покупке
- [ ] **Persona watermark на видео** (Kinescope config)
- [ ] **Промокоды** (если есть план запускать партнёрку с блогерами)
- [ ] **Уведомление об окончании курса** (email + Telegram)

### Future Consideration (v2+ / M3+)

Триггер: подтверждённый product-market fit (100+ продаж стабильно), запрос от 20%+ клиентов.

- [ ] Домашние задания с проверкой куратором
- [ ] Сертификаты
- [ ] Несколько курсов одновременно + multi-tier тарифы
- [ ] Подписочная модель
- [ ] AI-рекомендации / chatbot
- [ ] A/B тестирование лендинга (после ~1000 уников/мес)
- [ ] Reviews / отзывы внутри платформы
- [ ] Multilingual UI (EN для не-русскоязычных СНГ)
- [ ] Mobile push через PWA (когда Safari iOS дорастёт)

## Feature Prioritization Matrix (M1 фокус)

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Регистрация + login | HIGH | LOW | P1 |
| 152-ФЗ consent + Privacy Policy | HIGH (юридически HIGH, юзер не заметит если есть) | LOW | P1 |
| Публичная оферта | HIGH (юридически и для ЮKassa) | MEDIUM (юр.консультация) | P1 |
| ЮKassa создание платежа | HIGH | MEDIUM | P1 |
| ЮKassa 54-ФЗ чек в payload | HIGH (юридически) | LOW (одно поле в payload) | P1 |
| ЮKassa webhook + идемпотентность | HIGH | MEDIUM | P1 |
| Выдача доступа | HIGH | LOW | P1 |
| Kinescope защищённый плеер | HIGH (core value) | MEDIUM | P1 |
| Server-side hasAccess guard | HIGH (без него нет защиты) | LOW | P1 |
| Дашборд «Мои курсы» | HIGH | LOW | P1 |
| Welcome / verify / reset email через Resend | HIGH | MEDIUM (домен + DNS + Resend setup) | P1 |
| Rate limiting на auth/payment | HIGH (безопасность) | LOW | P1 |
| Право на удаление аккаунта | MEDIUM (юзер редко использует, но юр. обязательно) | LOW | P1 |
| Sentry error tracking | MEDIUM | LOW | P1 |
| Smoke E2E тесты | HIGH (соло-dev не может позволить regression) | MEDIUM | P1 |
| FAQ блок + контакты | MEDIUM | LOW | P1 |
| Адаптивная вёрстка | HIGH | MEDIUM (сквозное) | P1 |
| Базовая SEO + OG | MEDIUM | LOW | P1 |
| Бинарная отметка «урок завершён» | MEDIUM | LOW | P1 |
| Continue watching with timestamp | MEDIUM | MEDIUM | P2 |
| Профиль с edit | LOW (юзер минимально пользуется) | LOW | P2 |
| Админ-панель | HIGH (для автора) | HIGH | P2 |
| Маркетинговый email Unisender | HIGH (retention) | HIGH | P2 |
| Telegram-канал auto-invite | MEDIUM | MEDIUM | P2 |
| Materials/PDF к уроку | MEDIUM | LOW | P2 |
| Persona watermark | HIGH (если видео начнут утекать) | LOW (Kinescope config) | P2 |
| Промокоды | MEDIUM (если есть партнёры) | MEDIUM | P2 |
| Сертификаты | LOW (до подтверждения спроса) | MEDIUM | P3 |
| ДЗ с проверкой | HIGH (отличие от GetCourse) | HIGH | P3 |
| Multi-tier тарифы | MEDIUM | MEDIUM | P3 |
| AI-recap / chatbot | LOW (тренд, не нужда) | HIGH | P3 |
| Multilingual EN | LOW (СНГ норм с русским) | HIGH | P3 |

**Priority key:**
- **P1:** Must have for M1 launch (Table Stakes v1 + critical минимум v2)
- **P2:** Should have, M2 — full Table Stakes v2 + первые differentiators
- **P3:** Nice to have, M3+ после product-market fit

## Competitor Feature Analysis (РФ EdTech)

| Feature | GetCourse | Skillbox / Нетология | Stepik | Udemy / Coursera (Запад) | Teachable / Thinkific | Наш подход (M1) |
|---|---|---|---|---|---|---|
| **Платежи** | GetCourse Pay (СБП, карты, юрлица); работает с ИП/самозанятыми | ЮKassa + кредит от Тинькоф/Сбер (рассрочка) | ЮKassa + Stripe для не-РФ | Stripe / PayPal | Stripe (для РФ не работает) | ЮKassa (visa/mc/мир + СБП) |
| **Оферта** | Школа предоставляет свою | Своя у каждой школы | Своя | EULA | Свой ToS | Своя `/oferta` с реквизитами ИП |
| **152-ФЗ consent** | Чекбокс встроен в формы GetCourse | Чекбокс + ссылка на политику | Чекбокс при регистрации | Не применимо (не РФ юрисдикция) | Не применимо | Чекбокс на регистрации + `/privacy` |
| **Email (welcome/transactional)** | Встроенный email-модуль через свой SMTP | UniSender / SendPulse / своё | Своё | SendGrid | Через своё | Resend в M1, Unisender в M2 |
| **Видеохостинг** | Свой + интеграция Kinescope/Vimeo | Своё + Kinescope | Своё | Свой CDN | Wistia | Kinescope (private) |
| **Защита видео от download** | Через интеграцию с Kinescope | Kinescope/своё DRM | Watermark + signed URL | DRM (Widevine) | Wistia DRM | Kinescope private + DRM (опц) |
| **Прогресс просмотра** | Авто для встроенного плеера (80% watched), для внешних — кнопка вручную | Полный (% + last position) | Полный + квизы | Полный + bookmarks | Полный | Бинарная отметка в M1, % в M2 |
| **Сертификаты** | Есть, шаблонизатор | Есть | Есть для платных курсов | Есть | Есть | M3+ |
| **ДЗ с проверкой** | Есть, ручная + автокурсы | Сильная сторона (кураторы) | Auto-grading + peer review | Auto + peer | Есть | M3+ |
| **Промокоды** | Есть | Есть | Есть | Есть | Есть | M2 |
| **Multi-tier тарифы** | Есть (тарифы тренинга) | Есть («с обратной связью» / без) | Есть (бесплатно / pro) | Есть (audit / certified) | Есть | M3+ |
| **OAuth-логины** | VK, Google, Facebook | VK, Google, Yandex | VK, Google, Yandex, FB | Google, Apple, FB | Google, FB | **НЕТ** (email/password, anti-feature) |
| **Мобильное приложение** | Да (iOS/Android, RuStore) | Да (iOS/Android) | Да | Да | Нет | **НЕТ** (anti-feature, PWA) |
| **Live-вебинары** | Встроены | Встроены | Нет | Coursera Specializations | Нет | **НЕТ** (anti-feature) |
| **Сообщество/форум** | Есть (внутренний) | Telegram-чаты + платформа | Комментарии под задачами | Discussion forums | Comments | Telegram-канал в M2 (anti-feature внутри платформы) |
| **Партнёрская/реф.программа** | Есть | Нет на лендингах, есть для блогеров | Нет публично | Affiliate program | Affiliate program | M2 (промокоды) |
| **Налоговый вычет 13%** | Если у школы лицензия — упоминается | Skillbox / Нетология имеют лицензии — это сильный аргумент в продажах | Часть курсов с лицензией | N/A | N/A | **НЕ упоминать в M1** (нет лицензии) |
| **Чат-саппорт (live)** | Встроен (онлайн-чат) | Jivo/Carrot Quest | Help center + tickets | Help center | Intercom | **Telegram + email mailto:** в M1 (anti-feature: live chat) |

## RU/CIS специфика — что обязательно

Сводка РФ-специфичных требований из исследования. Все P1 для M1.

### Юридические (нельзя ship без них)

1. **152-ФЗ — Согласие на обработку перс. данных.** Чекбокс на регистрации (отдельно от оферты), ссылка на `/privacy`, хранение факта согласия (когда, версия, IP). Без согласия = штраф ИП до 100k₽ первый раз, до 300k₽ повторно (статья 13.11 КоАП).
2. **152-ФЗ — Право на удаление.** Кнопка «Удалить аккаунт» в профиле, обработка в 30 дней. Soft delete с анонимизацией (purchases хранить 4 года по 54-ФЗ для налоговой).
3. **54-ФЗ — Фискальные чеки.** ЮKassa формирует и отправляет, но **только если в payment.create передано** `receipt.customer.email` + `receipt.items[]`. Без email чек не сформируется, продавец нарушает 54-ФЗ. Email на чеке = email пользователя из verify.
4. **Публичная оферта.** Ссылка обязательна в заявке ЮKassa при подключении. Содержит реквизиты ИП/самозанятого (ИНН, ОГРНИП), предмет договора, цену, порядок оказания услуги, возврат. Чекбокс «согласен с офертой» на checkout.
5. **Реквизиты продавца** (ИП ФИО, ИНН, ОГРНИП, адрес регистрации) в футере и оферте.

### Платёжные

6. **ЮKassa — единственный реалистичный провайдер.** Stripe / Paddle / PayPal не работают с РФ ИП с 2022.
7. **СБП обязателен.** Доля СБП в EdTech-чеках растёт, особенно для аудитории 25–35. ЮKassa СБП поддерживает встроенно — в payment.create достаточно `payment_method_data.type: 'sbp'` или показать выбор юзеру.
8. **Карты «Мир» обязательны.** ЮKassa поддерживает по умолчанию.
9. **Возврат денег (refund) — Закон о защите прав потребителей.** При оказании дистанционной услуги (курс) есть право вернуть в течение 14 дней, если услуга не оказана. Нужен механизм refund в ЮKassa (есть API). В M1 достаточно ручного refund через ЮKassa dashboard при тикете.

### Email deliverability

10. **mail.ru, yandex.ru, rambler.ru** — фильтруют агрессивно. Без **SPF + DKIM + DMARC** на custom domain письма уходят в спам или блокируются (mail.ru 421). Supabase Auth SMTP по умолчанию (домен `supabase.co`) — **не использовать в production**: rate limit 3/hr, отправитель в чёрных списках mail.ru.
11. **Resend.com** работает с РФ-доменами, есть free tier (3000/mo), поддерживает custom domain с SPF/DKIM в 1 клик. Альтернатива: Sendgrid (платный после 100/day), Postmark (платный). Unisender для маркетинга (M2) — отдельный bulk канал.
12. **Lead time на DNS:** SPF/DKIM/DMARC записи распространяются 24–48ч. Заказывать домен и настраивать DNS за неделю до момента когда нужны email.

### Культурные

13. **Без OAuth Google / Facebook.** Email/password — норма и доверие. VK OAuth — возможен в M2, но API нестабилен. Yandex ID — спорно.
14. **Telegram-контакт в футере.** Стандарт РФ для саппорта мелких школ. WhatsApp — для регионов и СНГ (Армения, Грузия, Узбекистан). Live-чат-виджет (Jivo, Carrot) — overkill для MVP.
15. **Цена в ₽.** СНГ-клиенты (Казахстан, Беларусь, Армения) привычны к рублёвым ценам, конвертация = недоверие.
16. **Никогда не обещать «налоговый вычет 13%»** без лицензии Рособрнадзора. Большинство мелких авторских школ работают без лицензии и явно пишут в оферте «не является образовательной услугой / лицензируемой деятельностью».
17. **Мобильный трафик 60%+** на РФ EdTech лендингах. Mobile-first design не optional.

## Опен-вопросы для решения до M1 plan-phase

- **Юр.форма:** ИП или самозанятый? От этого зависят реквизиты в оферте, какие операции возможны (самозанятый не может принимать от юрлиц), какой лимит (2.4M₽/год для самозанятого).
- **Лицензия Рособрнадзора:** есть/планируется? Влияет только на messaging налогового вычета. Не блокирует M1.
- **ЮKassa аккаунт:** уже подключён или нужно подключать? Lead time подключения 1–3 дня + заявка с офертой.
- **Custom domain:** уже куплен или нужно покупать? Lead time SPF/DKIM 24–48ч.
- **Resend.com vs альтернативы:** подтвердить выбор email-провайдера для M1 транзакционных писем (рекомендация исследования — Resend free tier с custom domain).
- **Юрист для оферты:** свой шаблон или консультация? Параллельный трек, не блокирует код, но блокирует ship.

## Sources

- [GetCourse Pay для самозанятых и ИП](https://getcourse.ru/blog/723739) — оферта обязательна в заявке, реквизиты ИП/самозанятого
- [GetCourse — Публичная оферта пример](https://getcourse.ru/oferta) — структура договора-оферты
- [Skillbox оферта пример](https://eng.skillbox.ru/oferta) — структура для школы английского
- [GetCourse Pay обзор для самозанятых](https://sedov.link/blog/1190267/getcourse-pay-platezhi-obzor-dlya-samozanyatyh-ip_2510) — payment flow самозанятого
- [ЮKassa — Чеки по 54-ФЗ](https://yookassa.ru/developers/payment-acceptance/receipts/54fz/yoomoney/basics) — формирование чека через ЮKassa
- [ЮKassa — Отправка чеков 54-ФЗ](https://yookassa.ru/docs/support/merchant/payments/implement/online-sales-register) — обязательные поля receipt в payment.create
- [ЮKassa для онлайн-школ](https://yookassa.ru/online-school-payments/) — позиционирование для EdTech
- [54-ФЗ — email/phone обязателен в электронном чеке](https://spasskiy.tatarstan.ru/22032022-prokuror-razyasnyaet-za-otsutstvie-v.htm) — прокурорское разъяснение, штраф за отсутствие
- [Kinescope DRM-шифрование](https://docs.kinescope.ru/zashita-kontenta/drm-shifrovanie-faylov/) — Widevine/FairPlay, защита от download
- [Kinescope — защита видео от копирования](https://kinescope.ru/blog/kak-zashchitit-video-ot-kopirovaniya-i-skachivaniya) — persona watermark, private links, backend auth
- [Kinescope для EdTech](https://kinescope.ru/solutions/edtech-elearning) — стандартное использование в курсах
- [Mail.ru / Yandex — SPF/DKIM/DMARC](https://openrate.us/posts/1360191/) — настройка deliverability для РФ-доменов
- [Postmaster — контроль доставляемости](https://enkod.io/blog/postmaster-kak-kontrolirovat-dostavljaemost-pisem-i-ne-popadat-v-spam/) — Yandex Postmaster закрыт в 2020, mail.ru Postmaster работает
- [GetCourse — отметка «Просмотрено»](https://getcourse.ru/chtm/q/kak-otobrazit-prosmotreno-pri-youtube-video-v-uroke) — авто только для встроенного видео, для внешних — кнопка
- [LMS прогресс просмотра — обзор](https://kontur.ru/talk/spravka/48285-lms_sistema) — стандарт прогресс-tracking в LMS

**Документы проекта:**

- `/Users/tkestkes/Desktop/repo/.planning/PROJECT.md` — Validated/Active/Out of Scope разделы, ключевые решения по ЮKassa/Kinescope/Unisender
- `/Users/tkestkes/Desktop/repo/.planning/codebase/STRUCTURE.md` — текущий каркас (auth helpers, route groups, миграции `profiles/courses/modules/lessons`)
- `/Users/tkestkes/Desktop/repo/docs/ТЗ_VideoEdit_Academy.docx` — первоисточник F-XX.XX требований (не прочитан в этом исследовании, нужен для plan-phase)

---
*Feature research for: Платная LMS для одного автора курсов (single-instructor EdTech), РФ/СНГ рынок*
*Researched: 2026-05-24*
