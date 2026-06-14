import { describe, it, expect } from 'vitest';

import { decideLessonAccess } from './lesson-access';

const base = {
  lessonExists: true,
  isPreview: false,
  isAdmin: false,
  subscriptionCoversCourse: false,
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
  it('подписка ПОКРЫВАЕТ этот курс → доступ', () => {
    expect(decideLessonAccess({ ...base, subscriptionCoversCourse: true }).allowed).toBe(true);
  });
  it('ДЫРА ЗАКРЫТА: есть подписка, но курс НЕ в её наборе → denied', () => {
    // subscriptionCoversCourse=false моделирует «подписан на другой план»
    expect(decideLessonAccess({ ...base, subscriptionCoversCourse: false })).toEqual({
      allowed: false,
      reason: 'denied',
    });
  });
  it('покупка курса даёт доступ', () => {
    expect(decideLessonAccess({ ...base, hasPurchase: true }).allowed).toBe(true);
  });
});
