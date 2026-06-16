import { GlassCard } from '@/components/shared/GlassCard';

export const metadata = {
  title: 'Политика конфиденциальности',
  description:
    'Как Artum Academy собирает, использует и защищает персональные данные пользователей.',
};

/**
 * /privacy — Политика обработки персональных данных.
 *
 * ⚠️ ВАЖНО: Это скелет с типовым шаблоном для соответствия 152-ФЗ.
 * Перед публичным запуском ОБЯЗАТЕЛЬНО показать юристу:
 *   - подставить реальные реквизиты Оператора (ИП ФИО / ИНН / адрес)
 *   - добавить специфику обработки (платежи, видео, аналитика)
 *   - сверить с актуальной версией 152-ФЗ
 *
 * Для финального запуска нужно опубликовать в Реестре операторов ПДн
 * (rkn.gov.ru) — уведомление о начале обработки.
 */
export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <GlassCard className="space-y-6 p-7 sm:p-10">
        <header>
          <div className="text-xs uppercase tracking-widest text-primary-light">152-ФЗ</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Политика конфиденциальности
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Дата вступления в силу: 1 января 2026 г.
          </p>
        </header>

        <Section title="1. Общие положения">
          <p>
            Настоящая Политика определяет порядок обработки персональных данных
            (далее — «ПДн») пользователей сервиса Artum Academy (далее — «Сервис»),
            доступного по адресу{' '}
            <a href="https://artumacademy.ru" className="text-primary hover:underline">
              artumacademy.ru
            </a>
            . Оператор обработки ПДн — Самозанятый Абдулкадыров Ясин Дагаевич,
            ИНН <b>201302285050</b>. Полные реквизиты:{' '}
            <a href="/contacts" className="text-primary hover:underline">
              artumacademy.ru/contacts
            </a>
            .
          </p>
          <p>
            Используя Сервис, вы соглашаетесь с условиями настоящей Политики.
            Если вы не согласны — не используйте Сервис.
          </p>
        </Section>

        <Section title="2. Какие данные мы собираем">
          <ul>
            <li>email и пароль (для доступа к аккаунту)</li>
            <li>имя (отображается в профиле и сертификатах)</li>
            <li>история покупок, прогресс прохождения уроков, сертификаты</li>
            <li>технические данные: IP-адрес, user-agent браузера, время визитов</li>
            <li>cookie-файлы для авторизации и аналитики</li>
          </ul>
        </Section>

        <Section title="3. Цели обработки">
          <ul>
            <li>предоставление доступа к курсам и сертификатам</li>
            <li>обработка платежей через платёжного провайдера (ЮKassa)</li>
            <li>отправка системных писем (восстановление пароля, чеки)</li>
            <li>улучшение работы Сервиса и аналитика использования</li>
            <li>выполнение требований законодательства РФ</li>
          </ul>
        </Section>

        <Section title="4. Правовые основания">
          <p>
            Обработка осуществляется на основании п. 5 ч. 1 ст. 6 152-ФЗ
            (исполнение договора) и при наличии согласия пользователя при
            регистрации. Финансовые операции — на основании 54-ФЗ.
          </p>
        </Section>

        <Section title="5. Передача данных третьим лицам">
          <p>Мы передаём минимально необходимые данные:</p>
          <ul>
            <li><b>Supabase</b> — облачное хранилище БД и аутентификация</li>
            <li><b>ЮKassa</b> — обработка платежей (54-ФЗ операции)</li>
            <li><b>Kinescope</b> — доставка видеоконтента уроков</li>
            <li><b>Сервис рассылки писем</b> — транзакционные письма</li>
          </ul>
          <p>
            Мы не продаём и не передаём ваши данные третьим лицам в маркетинговых
            целях.
          </p>
        </Section>

        <Section title="6. Срок хранения">
          <p>
            ПДн хранятся до удаления аккаунта пользователем или 3 года с момента
            последней активности. Финансовые документы — 5 лет (ст. 29 ФЗ
            «О бухгалтерском учёте»).
          </p>
        </Section>

        <Section title="7. Ваши права">
          <ul>
            <li>запрашивать сведения об обработке ваших ПДн</li>
            <li>требовать уточнения, блокировки или уничтожения ваших ПДн</li>
            <li>отозвать согласие на обработку (приведёт к удалению аккаунта)</li>
            <li>обжаловать действия Оператора в Роскомнадзоре</li>
          </ul>
          <p>
            Запросы направляйте на{' '}
            <a href="mailto:privacy@artumacademy.ru" className="text-primary hover:underline">
              privacy@artumacademy.ru
            </a>
            . Срок ответа — 30 дней.
          </p>
        </Section>

        <Section title="8. Удаление аккаунта">
          <p>
            Вы можете удалить аккаунт в личном кабинете. После удаления все ПДн
            обезличиваются в течение 30 дней. Финансовые данные (платежи, чеки)
            хранятся согласно требованиям 54-ФЗ.
          </p>
        </Section>

        <Section title="9. Изменения политики">
          <p>
            Мы можем обновлять настоящую Политику. Актуальная версия всегда
            доступна по адресу{' '}
            <a href="https://artumacademy.ru/privacy" className="text-primary hover:underline">
              artumacademy.ru/privacy
            </a>
            . О существенных изменениях уведомим по email.
          </p>
        </Section>

        <footer className="border-t border-border/40 pt-4 text-xs text-muted-foreground">
          <p>
            Контакты Оператора: [ИП/ООО, ИНН, юридический адрес, телефон, email].
          </p>
          <p className="mt-2">
            ⚠️ Это скелет документа. Окончательную версию утверждает юрист с
            учётом специфики деятельности.
          </p>
        </footer>
      </GlassCard>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
