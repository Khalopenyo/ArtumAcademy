/**
 * MVP-фаза: один курс. Финальный slug — на executor этапе (UI-SPEC §10.8).
 * Тот же slug используется в Hero CTA + PricingBlock CTA + supabase/seed.sql (plan-04).
 * Цена тоже синхронизирована с seed для consistency (real source of truth — БД, но MVP жёстко привязан).
 */
export const MVP_COURSE_SLUG = 'videoedit-mvp';
export const MVP_COURSE_PRICE_MINOR = 1_990_000; // 19 900 ₽ in копейках
