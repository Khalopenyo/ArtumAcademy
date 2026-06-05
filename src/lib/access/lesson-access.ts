/**
 * Чистая логика решения о доступе к уроку — для записи прогресса и выдачи
 * сертификата. Без БД и секретов, поэтому юнит-тестируется. DB-флаги собирает
 * вызывающий код (Server Action под service_role).
 *
 * Закрывает дыру: Server Action — открытый POST-эндпоинт. Без этой проверки
 * залогиненный пользователь мог отметить уроки чужого (неоплаченного) курса
 * и получить сертификат без покупки.
 */

export interface LessonAccessFlags {
  lessonExists: boolean;
  isPreview: boolean;
  isAdmin: boolean;
  hasActiveSubscription: boolean;
  hasPurchase: boolean;
}

export type AccessReason = 'ok' | 'not_found' | 'denied';

export interface AccessDecision {
  allowed: boolean;
  reason: AccessReason;
}

/**
 * Доступ к уроку есть, если урок — preview, либо пользователь admin,
 * либо активна подписка, либо курс куплен.
 */
export function decideLessonAccess(f: LessonAccessFlags): AccessDecision {
  if (!f.lessonExists) return { allowed: false, reason: 'not_found' };
  if (f.isPreview || f.isAdmin || f.hasActiveSubscription || f.hasPurchase) {
    return { allowed: true, reason: 'ok' };
  }
  return { allowed: false, reason: 'denied' };
}
