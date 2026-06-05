import { describe, it, expect } from 'vitest';

import { decideLessonAccess } from './lesson-access';

const base = {
  lessonExists: true,
  isPreview: false,
  isAdmin: false,
  hasActiveSubscription: false,
  hasPurchase: false,
};

describe('decideLessonAccess', () => {
  it('несуществующий урок → not_found', () => {
    expect(decideLessonAccess({ ...base, lessonExists: false })).toEqual({
      allowed: false,
      reason: 'not_found',
    });
  });

  it('КЛЮЧЕВОЙ ФИКС: нет ни покупки, ни подписки, ни preview → denied (сертификат без оплаты невозможен)', () => {
    expect(decideLessonAccess(base)).toEqual({ allowed: false, reason: 'denied' });
  });

  it('preview-урок открыт всем', () => {
    expect(decideLessonAccess({ ...base, isPreview: true }).allowed).toBe(true);
  });
  it('admin имеет доступ', () => {
    expect(decideLessonAccess({ ...base, isAdmin: true }).allowed).toBe(true);
  });
  it('активная подписка даёт доступ', () => {
    expect(decideLessonAccess({ ...base, hasActiveSubscription: true }).allowed).toBe(true);
  });
  it('покупка курса даёт доступ', () => {
    expect(decideLessonAccess({ ...base, hasPurchase: true }).allowed).toBe(true);
  });
});
