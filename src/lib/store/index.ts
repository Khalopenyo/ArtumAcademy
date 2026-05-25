/**
 * Artum Academy — global mock store (этап 2 ТЗ §9, моки до реальной БД).
 *
 * Архитектура:
 *   - Read-only константы (CATEGORIES, COURSES) — в src/lib/mock/courses.ts
 *   - Все мутации (auth, прогресс, покупки, сертификаты, админка) — здесь
 *   - Persistence: localStorage через zustand `persist` middleware
 *
 * Когда появится Supabase (этап 3), этот файл удаляется и заменяется
 * на server queries + Server Actions. Сигнатуры helpers (markLessonComplete,
 * buyCourse, registerUser, etc.) специально совпадают с теми, что будут
 * у server actions — pages не придётся переписывать.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import {
  type Category,
  type Course,
  type Lesson,
  CATEGORIES,
  COURSES,
} from '@/lib/mock/courses';

// ────────────────────────────────────────────────────────────────────
// ТИПЫ
// ────────────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  /** Хранится в plain text (это mock). Реальный auth = bcrypt в БД на этапе 2. */
  password: string;
  initials: string;
  registeredAt: string;
  isAdmin: boolean;
}

export interface StoredPayment {
  id: string;
  userId: string;
  courseSlug: string;
  amountMinor: number;
  paidAt: string;
  method: 'card' | 'sbp' | 'subscription';
  status: 'succeeded' | 'refunded';
}

export interface StoredCertificate {
  id: string;
  verificationNumber: string;
  userId: string;
  courseSlug: string;
  studentName: string;
  issuedAt: string;
}

export type LessonProgressKey = `${string}:${string}`; // `${userId}:${lessonId}`
export type PurchaseKey = `${string}:${string}`; // `${userId}:${courseSlug}`

/** Промокод (скидка при покупке) — ТЗ §1.5 явно «без сложных промокодов»,
 *  но базовый mock с фикс/процент-скидкой для админки и demo-валидации */
export interface Promocode {
  id: string;
  /** Уникальный код в верхнем регистре (для удобства ввода) */
  code: string;
  type: 'percent' | 'fixed';
  /** Для percent: 0-100. Для fixed: сумма в копейках */
  value: number;
  /** ISO срок действия; null = бессрочный */
  validUntil: string | null;
  /** Кол-во оставшихся использований; null = безлимит */
  usesLeft: number | null;
  /** Заметка для админа (внутреннее имя) */
  note: string;
  createdAt: string;
}

/** Подписка пользователя на «все курсы» — ТЗ §5.3 */
export interface Subscription {
  userId: string;
  /** Тариф (на скелете: один тариф 'all_courses') */
  tier: 'all_courses';
  /** ISO дата начала */
  startedAt: string;
  /** ISO дата окончания (через 30 дней / 365 дней) */
  expiresAt: string;
  /** Стоимость в копейках */
  amountMinor: number;
  /** monthly / yearly */
  period: 'monthly' | 'yearly';
  /** Активна сейчас? Вычисляется через expiresAt > now */
  cancelled: boolean;
}

/** Mock recovery-token: связывает random string с user id + expiresAt */
export interface RecoveryToken {
  token: string;
  userId: string;
  /** ISO; 1 час с момента создания */
  expiresAt: string;
  used: boolean;
}

interface ArtumState {
  // ─── AUTH ─────────────────────────────────────────────────────────
  /** Все зарегистрированные пользователи (включая seed) */
  users: StoredUser[];
  /** ID активной сессии (null = гость) */
  currentUserId: string | null;
  /** Mock recovery tokens — на демо отображается inline (toast + ссылка) */
  recoveryTokens: RecoveryToken[];

  // ─── CATALOG (mutations поверх COURSES const) ─────────────────────
  /**
   * Курсы, добавленные через админку. Объединяются с base COURSES
   * через `getAllCourses()` ниже.
   */
  customCourses: Course[];
  /** Slug'и base-курсов, удалённых через админку. Скрывает их из каталога. */
  hiddenSlugs: string[];

  // ─── PROGRESS / PURCHASES / CERTS ─────────────────────────────────
  /** Set lessonProgressKey → true: пройдено */
  lessonProgress: Record<LessonProgressKey, true>;
  /** Set purchaseKey → true: куплено */
  purchases: Record<PurchaseKey, true>;
  payments: StoredPayment[];
  certificates: StoredCertificate[];
  subscriptions: Subscription[];
  /** {userId:courseSlug → true} избранное / wishlist */
  wishlist: Record<string, true>;
  promocodes: Promocode[];

  // ─── ACTIONS ──────────────────────────────────────────────────────
  // Auth
  registerUser: (input: { name: string; email: string; password: string }) =>
    | { ok: true; user: StoredUser }
    | { ok: false; error: string };
  loginUser: (input: { email: string; password: string }) =>
    | { ok: true; user: StoredUser }
    | { ok: false; error: string };
  logoutUser: () => void;
  updateProfile: (input: { name?: string; email?: string }) =>
    | { ok: true }
    | { ok: false; error: string };
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    | { ok: true }
    | { ok: false; error: string };
  /** Создать recovery-token и вернуть его (на демо UI показывает inline) */
  requestPasswordReset: (email: string) =>
    | { ok: true; token: string; userName: string }
    | { ok: false; error: string };
  /** Установить новый пароль по token */
  resetPasswordWithToken: (token: string, newPassword: string) =>
    | { ok: true; email: string }
    | { ok: false; error: string };
  // Catalog mutations (admin)
  addCourse: (course: Course) => void;
  updateCourse: (slug: string, patch: Partial<Course>) => void;
  deleteCourse: (slug: string) => void;
  addLesson: (courseSlug: string, moduleId: string, lesson: Lesson) => void;
  updateLesson: (courseSlug: string, moduleId: string, lessonId: string, patch: Partial<Lesson>) => void;
  deleteLesson: (courseSlug: string, moduleId: string, lessonId: string) => void;
  reorderLessons: (courseSlug: string, moduleId: string, lessonIds: string[]) => void;
  // Progress / Purchase / Cert
  markLessonComplete: (lessonId: string) => void;
  unmarkLesson: (lessonId: string) => void;
  buyCourse: (
    courseSlug: string,
    options?: { promocode?: string },
  ) => { ok: true; discountMinor: number } | { ok: false; error: string };
  validatePromocode: (
    code: string,
    courseSlug: string,
  ) => { ok: true; promocode: Promocode; discountMinor: number } | { ok: false; error: string };
  addPromocode: (input: Omit<Promocode, 'id' | 'createdAt'>) =>
    | { ok: true }
    | { ok: false; error: string };
  updatePromocode: (id: string, patch: Partial<Omit<Promocode, 'id'>>) => void;
  deletePromocode: (id: string) => void;
  /** Оформление подписки на все курсы */
  buySubscription: (period: 'monthly' | 'yearly') =>
    | { ok: true }
    | { ok: false; error: string };
  cancelSubscription: () => void;
  toggleWishlist: (courseSlug: string) => void;
  /** Полная переинициализация (для тестов / админ-сброса) */
  reset: () => void;
}

// ────────────────────────────────────────────────────────────────────
// SEED — встроенный admin + дефолтный demo user
// ────────────────────────────────────────────────────────────────────

const SEED_USERS: StoredUser[] = [
  {
    id: 'user-seed-admin',
    name: 'Администратор',
    email: 'admin@artum.academy',
    password: 'admin123', // mock; в реальности — bcrypt
    initials: 'АА',
    registeredAt: '2026-01-01',
    isAdmin: true,
  },
  {
    id: 'user-mock-001',
    name: 'Иван Петров',
    email: 'ivan.petrov@example.com',
    password: 'demo1234',
    initials: 'ИП',
    registeredAt: '2026-01-15',
    isAdmin: false,
  },
];

const initialState = (): Omit<ArtumState, keyof Actions> => ({
  users: SEED_USERS,
  currentUserId: null, // По умолчанию гость; залогиниться через /login
  recoveryTokens: [],
  customCourses: [],
  hiddenSlugs: [],
  lessonProgress: {},
  purchases: {},
  payments: [],
  certificates: [],
  subscriptions: [],
  wishlist: {},
  promocodes: SEED_PROMOCODES,
});

const SEED_PROMOCODES: Promocode[] = [
  {
    id: 'promo-seed-welcome',
    code: 'WELCOME10',
    type: 'percent',
    value: 10,
    validUntil: null,
    usesLeft: null,
    note: 'Скидка 10% на первый курс',
    createdAt: '2026-01-01',
  },
  {
    id: 'promo-seed-blackfriday',
    code: 'BLACKFRIDAY',
    type: 'percent',
    value: 30,
    validUntil: '2026-12-01',
    usesLeft: 100,
    note: 'Чёрная пятница — скидка 30%',
    createdAt: '2026-01-01',
  },
];

// Helper-тип для отделения данных от actions при типизации
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Actions = Pick<
  ArtumState,
  | 'registerUser'
  | 'loginUser'
  | 'logoutUser'
  | 'updateProfile'
  | 'changePassword'
  | 'requestPasswordReset'
  | 'resetPasswordWithToken'
  | 'addCourse'
  | 'updateCourse'
  | 'deleteCourse'
  | 'addLesson'
  | 'updateLesson'
  | 'deleteLesson'
  | 'reorderLessons'
  | 'markLessonComplete'
  | 'unmarkLesson'
  | 'buyCourse'
  | 'buySubscription'
  | 'cancelSubscription'
  | 'toggleWishlist'
  | 'validatePromocode'
  | 'addPromocode'
  | 'updatePromocode'
  | 'deletePromocode'
  | 'reset'
>;

/** Цены тарифов подписки на все курсы (в копейках) */
export const SUBSCRIPTION_PRICES = {
  monthly: 99_000, // 990 ₽/мес
  yearly: 990_000, // 9 900 ₽/год (экономия 20%)
} as const;

// ────────────────────────────────────────────────────────────────────
// STORE
// ────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCertNumber(): string {
  const n = Math.floor(Math.random() * 900_000) + 100_000;
  return `ART-2026-${String(n).padStart(6, '0')}`;
}

export const useArtumStore = create<ArtumState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      // ─── AUTH ─────────────────────────────────────────────────────
      registerUser: ({ name, email, password }) => {
        const normalized = email.trim().toLowerCase();
        const exists = get().users.some((u) => u.email.toLowerCase() === normalized);
        if (exists) {
          return { ok: false, error: 'Пользователь с таким email уже зарегистрирован' };
        }
        if (password.length < 8) {
          return { ok: false, error: 'Пароль должен быть минимум 8 символов' };
        }
        const user: StoredUser = {
          id: makeId('user'),
          name: name.trim(),
          email: normalized,
          password,
          initials: getInitials(name),
          registeredAt: new Date().toISOString().slice(0, 10),
          isAdmin: false,
        };
        set((state) => ({
          users: [...state.users, user],
          currentUserId: user.id, // автологин после регистрации
        }));
        return { ok: true, user };
      },

      loginUser: ({ email, password }) => {
        const normalized = email.trim().toLowerCase();
        const user = get().users.find((u) => u.email.toLowerCase() === normalized);
        if (!user) {
          return { ok: false, error: 'Пользователь с таким email не найден' };
        }
        if (user.password !== password) {
          return { ok: false, error: 'Неверный пароль' };
        }
        set({ currentUserId: user.id });
        return { ok: true, user };
      },

      logoutUser: () => set({ currentUserId: null }),

      updateProfile: ({ name, email }) => {
        const { currentUserId } = get();
        if (!currentUserId) return { ok: false, error: 'Сначала войдите в аккаунт' };
        const me = get().users.find((u) => u.id === currentUserId);
        if (!me) return { ok: false, error: 'Пользователь не найден' };
        const normalizedEmail = email?.trim().toLowerCase();
        if (normalizedEmail && normalizedEmail !== me.email) {
          const taken = get().users.some(
            (u) => u.id !== currentUserId && u.email.toLowerCase() === normalizedEmail,
          );
          if (taken) {
            return { ok: false, error: 'Этот email уже занят другим пользователем' };
          }
        }
        const newName = name?.trim();
        set((state) => ({
          users: state.users.map((u) =>
            u.id === currentUserId
              ? {
                  ...u,
                  name: newName && newName.length > 0 ? newName : u.name,
                  email: normalizedEmail || u.email,
                  initials: newName && newName.length > 0 ? getInitials(newName) : u.initials,
                }
              : u,
          ),
        }));
        return { ok: true };
      },

      changePassword: ({ currentPassword, newPassword }) => {
        const { currentUserId } = get();
        if (!currentUserId) return { ok: false, error: 'Сначала войдите в аккаунт' };
        const me = get().users.find((u) => u.id === currentUserId);
        if (!me) return { ok: false, error: 'Пользователь не найден' };
        if (me.password !== currentPassword) {
          return { ok: false, error: 'Текущий пароль неверный' };
        }
        if (newPassword.length < 8) {
          return { ok: false, error: 'Новый пароль должен быть минимум 8 символов' };
        }
        if (newPassword === currentPassword) {
          return { ok: false, error: 'Новый пароль должен отличаться от текущего' };
        }
        set((state) => ({
          users: state.users.map((u) =>
            u.id === currentUserId ? { ...u, password: newPassword } : u,
          ),
        }));
        return { ok: true };
      },

      requestPasswordReset: (email) => {
        const normalized = email.trim().toLowerCase();
        const user = get().users.find((u) => u.email.toLowerCase() === normalized);
        if (!user) {
          return { ok: false, error: 'Пользователь с таким email не найден' };
        }
        const token = makeId('rec').replace('rec-', '');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        set((state) => ({
          recoveryTokens: [
            ...state.recoveryTokens.filter((t) => t.userId !== user.id),
            { token, userId: user.id, expiresAt, used: false },
          ],
        }));
        return { ok: true, token, userName: user.name };
      },

      resetPasswordWithToken: (token, newPassword) => {
        const rec = get().recoveryTokens.find((t) => t.token === token);
        if (!rec) return { ok: false, error: 'Ссылка неверна или устарела' };
        if (rec.used) return { ok: false, error: 'Эта ссылка уже использована' };
        if (new Date(rec.expiresAt) < new Date()) {
          return { ok: false, error: 'Срок действия ссылки истёк (1 час)' };
        }
        if (newPassword.length < 8) {
          return { ok: false, error: 'Пароль должен быть минимум 8 символов' };
        }
        const user = get().users.find((u) => u.id === rec.userId);
        if (!user) return { ok: false, error: 'Пользователь не найден' };
        set((state) => ({
          users: state.users.map((u) =>
            u.id === rec.userId ? { ...u, password: newPassword } : u,
          ),
          recoveryTokens: state.recoveryTokens.map((t) =>
            t.token === token ? { ...t, used: true } : t,
          ),
        }));
        return { ok: true, email: user.email };
      },

      // ─── CATALOG (admin actions) ──────────────────────────────────
      addCourse: (course) => {
        set((state) => ({
          customCourses: [...state.customCourses, course],
          // Если slug совпадает со скрытым base-курсом, разблокируем заодно
          hiddenSlugs: state.hiddenSlugs.filter((s) => s !== course.slug),
        }));
      },

      updateCourse: (slug, patch) => {
        set((state) => {
          // 1) В customCourses?
          const inCustom = state.customCourses.find((c) => c.slug === slug);
          if (inCustom) {
            return {
              customCourses: state.customCourses.map((c) =>
                c.slug === slug ? { ...c, ...patch } : c,
              ),
            };
          }
          // 2) Это base-курс: копируем в customCourses и применяем patch
          const baseCourse = COURSES.find((c) => c.slug === slug);
          if (!baseCourse) return state;
          return {
            customCourses: [...state.customCourses, { ...baseCourse, ...patch }],
            hiddenSlugs: [...state.hiddenSlugs.filter((s) => s !== slug), slug],
          };
        });
      },

      deleteCourse: (slug) => {
        set((state) => ({
          customCourses: state.customCourses.filter((c) => c.slug !== slug),
          hiddenSlugs: COURSES.some((c) => c.slug === slug)
            ? Array.from(new Set([...state.hiddenSlugs, slug]))
            : state.hiddenSlugs,
        }));
      },

      addLesson: (courseSlug, moduleId, lesson) => {
        const { updateCourse } = get();
        const course = getCourseEffective(get(), courseSlug);
        if (!course) return;
        const updatedModules = course.modules.map((m) =>
          m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m,
        );
        updateCourse(courseSlug, { modules: updatedModules });
      },

      updateLesson: (courseSlug, moduleId, lessonId, patch) => {
        const { updateCourse } = get();
        const course = getCourseEffective(get(), courseSlug);
        if (!course) return;
        const updatedModules = course.modules.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === lessonId ? { ...l, ...patch } : l,
                ),
              }
            : m,
        );
        updateCourse(courseSlug, { modules: updatedModules });
      },

      deleteLesson: (courseSlug, moduleId, lessonId) => {
        const { updateCourse } = get();
        const course = getCourseEffective(get(), courseSlug);
        if (!course) return;
        const updatedModules = course.modules.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
            : m,
        );
        updateCourse(courseSlug, { modules: updatedModules });
      },

      reorderLessons: (courseSlug, moduleId, lessonIds) => {
        const { updateCourse } = get();
        const course = getCourseEffective(get(), courseSlug);
        if (!course) return;
        const updatedModules = course.modules.map((m) => {
          if (m.id !== moduleId) return m;
          const byId = new Map(m.lessons.map((l) => [l.id, l]));
          const reordered = lessonIds
            .map((id) => byId.get(id))
            .filter((l): l is NonNullable<typeof l> => !!l);
          // Гарантируем что не теряем уроков (если frontend дал неполный список)
          for (const l of m.lessons) {
            if (!reordered.find((r) => r.id === l.id)) reordered.push(l);
          }
          return { ...m, lessons: reordered };
        });
        updateCourse(courseSlug, { modules: updatedModules });
      },

      // ─── PROGRESS ─────────────────────────────────────────────────
      markLessonComplete: (lessonId) => {
        const { currentUserId } = get();
        if (!currentUserId) return;
        const key: LessonProgressKey = `${currentUserId}:${lessonId}`;
        if (get().lessonProgress[key]) return; // уже отмечено
        set((state) => ({
          lessonProgress: { ...state.lessonProgress, [key]: true },
        }));
        // После обновления прогресса проверяем — не пройден ли весь курс?
        // Логика certs handled инфо извне через subscribe / explicit call.
        maybeIssueCertificate(lessonId, currentUserId);
      },

      unmarkLesson: (lessonId) => {
        const { currentUserId } = get();
        if (!currentUserId) return;
        const key: LessonProgressKey = `${currentUserId}:${lessonId}`;
        set((state) => {
          const next = { ...state.lessonProgress };
          delete next[key];
          return { lessonProgress: next };
        });
      },

      // ─── PURCHASE ─────────────────────────────────────────────────
      buyCourse: (courseSlug, options) => {
        const { currentUserId } = get();
        if (!currentUserId) {
          return { ok: false, error: 'Сначала войдите в аккаунт' };
        }
        const course = getCourseEffective(get(), courseSlug);
        if (!course) return { ok: false, error: 'Курс не найден' };
        const key: PurchaseKey = `${currentUserId}:${courseSlug}`;
        if (get().purchases[key]) return { ok: false, error: 'Курс уже куплен' };

        let discountMinor = 0;
        let usedPromocodeId: string | null = null;
        if (options?.promocode) {
          const validation = get().validatePromocode(options.promocode, courseSlug);
          if (!validation.ok) {
            return { ok: false, error: validation.error };
          }
          discountMinor = validation.discountMinor;
          usedPromocodeId = validation.promocode.id;
        }
        const amountMinor = Math.max(0, course.priceMinor - discountMinor);

        const payment: StoredPayment = {
          id: makeId('pay'),
          userId: currentUserId,
          courseSlug,
          amountMinor,
          paidAt: new Date().toISOString(),
          method: 'card',
          status: 'succeeded',
        };
        set((state) => ({
          purchases: { ...state.purchases, [key]: true },
          payments: [payment, ...state.payments],
          promocodes: usedPromocodeId
            ? state.promocodes.map((p) =>
                p.id === usedPromocodeId && p.usesLeft !== null
                  ? { ...p, usesLeft: Math.max(0, p.usesLeft - 1) }
                  : p,
              )
            : state.promocodes,
        }));
        return { ok: true, discountMinor };
      },

      validatePromocode: (code, _courseSlug) => {
        const normalized = code.trim().toUpperCase();
        const promo = get().promocodes.find((p) => p.code.toUpperCase() === normalized);
        if (!promo) return { ok: false, error: 'Промокод не найден' };
        if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
          return { ok: false, error: 'Срок действия промокода истёк' };
        }
        if (promo.usesLeft !== null && promo.usesLeft <= 0) {
          return { ok: false, error: 'Промокод закончился' };
        }
        const course = getCourseEffective(get(), _courseSlug);
        if (!course) return { ok: false, error: 'Курс не найден' };
        const discount =
          promo.type === 'percent'
            ? Math.round((course.priceMinor * promo.value) / 100)
            : Math.min(promo.value, course.priceMinor);
        return { ok: true, promocode: promo, discountMinor: discount };
      },

      addPromocode: (input) => {
        const normalized = input.code.trim().toUpperCase();
        if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) {
          return { ok: false, error: 'Код: только латиница/цифры/-_, 3-32 символа' };
        }
        if (get().promocodes.some((p) => p.code.toUpperCase() === normalized)) {
          return { ok: false, error: 'Промокод с таким кодом уже существует' };
        }
        if (input.type === 'percent' && (input.value < 1 || input.value > 100)) {
          return { ok: false, error: 'Процент должен быть 1-100' };
        }
        if (input.type === 'fixed' && input.value < 100) {
          return { ok: false, error: 'Фикс. скидка должна быть >= 1 ₽ (100 копеек)' };
        }
        const promo: Promocode = {
          ...input,
          code: normalized,
          id: makeId('promo'),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ promocodes: [...state.promocodes, promo] }));
        return { ok: true };
      },

      updatePromocode: (id, patch) => {
        set((state) => ({
          promocodes: state.promocodes.map((p) =>
            p.id === id ? { ...p, ...patch, code: (patch.code ?? p.code).toUpperCase() } : p,
          ),
        }));
      },

      deletePromocode: (id) => {
        set((state) => ({ promocodes: state.promocodes.filter((p) => p.id !== id) }));
      },

      buySubscription: (period) => {
        const { currentUserId } = get();
        if (!currentUserId) return { ok: false, error: 'Сначала войдите в аккаунт' };
        const active = getActiveSubscription(get(), currentUserId);
        if (active) return { ok: false, error: 'У вас уже есть активная подписка' };

        const days = period === 'monthly' ? 30 : 365;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const amountMinor = SUBSCRIPTION_PRICES[period];

        const sub: Subscription = {
          userId: currentUserId,
          tier: 'all_courses',
          startedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          amountMinor,
          period,
          cancelled: false,
        };
        const payment: StoredPayment = {
          id: makeId('pay'),
          userId: currentUserId,
          courseSlug: '__subscription__',
          amountMinor,
          paidAt: now.toISOString(),
          method: 'subscription',
          status: 'succeeded',
        };
        set((state) => ({
          subscriptions: [...state.subscriptions, sub],
          payments: [payment, ...state.payments],
        }));
        return { ok: true };
      },

      cancelSubscription: () => {
        const { currentUserId } = get();
        if (!currentUserId) return;
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.userId === currentUserId && !s.cancelled ? { ...s, cancelled: true } : s,
          ),
        }));
      },

      toggleWishlist: (courseSlug) => {
        const { currentUserId } = get();
        if (!currentUserId) return;
        const key = `${currentUserId}:${courseSlug}`;
        set((state) => {
          const next = { ...state.wishlist };
          if (next[key]) {
            delete next[key];
          } else {
            next[key] = true;
          }
          return { wishlist: next };
        });
      },

      reset: () => set(initialState()),
    }),
    {
      name: 'artum-academy-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // currentUserId сохраняется в store, но не в localStorage — это session token;
      // На моках просто перезагружаемся в гостя? Нет — для convenience оставляем
      // в persisted state, чтобы приёлось сохраняться между перезагрузками.
      partialize: (state) => ({
        users: state.users,
        currentUserId: state.currentUserId,
        recoveryTokens: state.recoveryTokens,
        customCourses: state.customCourses,
        hiddenSlugs: state.hiddenSlugs,
        lessonProgress: state.lessonProgress,
        purchases: state.purchases,
        payments: state.payments,
        certificates: state.certificates,
        subscriptions: state.subscriptions,
        wishlist: state.wishlist,
        promocodes: state.promocodes,
      }),
    },
  ),
);

// ────────────────────────────────────────────────────────────────────
// READ-HELPERS (используют текущий state)
// ────────────────────────────────────────────────────────────────────

/**
 * Effective COURSES list = base COURSES − hiddenSlugs + customCourses.
 * customCourses имеют приоритет над одноимёнными base (правка через админку).
 */
function getCourseEffective(state: ArtumState, slug: string): Course | null {
  const custom = state.customCourses.find((c) => c.slug === slug);
  if (custom) return custom;
  if (state.hiddenSlugs.includes(slug)) return null;
  return COURSES.find((c) => c.slug === slug) ?? null;
}

export function getAllCoursesEffective(state: ArtumState): Course[] {
  // 1) Base COURSES minus hidden, with custom overrides applied
  const customSlugs = new Set(state.customCourses.map((c) => c.slug));
  const baseWithoutHidden = COURSES.filter(
    (c) => !state.hiddenSlugs.includes(c.slug) && !customSlugs.has(c.slug),
  );
  return [...baseWithoutHidden, ...state.customCourses];
}

export function getCourseEffectiveBySlug(state: ArtumState, slug: string): Course | null {
  return getCourseEffective(state, slug);
}

export function isLessonComplete(
  state: ArtumState,
  userId: string,
  lessonId: string,
): boolean {
  return state.lessonProgress[`${userId}:${lessonId}`] === true;
}

export function isCoursePurchased(
  state: ArtumState,
  userId: string,
  courseSlug: string,
): boolean {
  if (state.purchases[`${userId}:${courseSlug}`] === true) return true;
  // Активная подписка даёт доступ ко всем курсам
  return getActiveSubscription(state, userId) !== null;
}

export function isInWishlist(
  state: ArtumState,
  userId: string,
  courseSlug: string,
): boolean {
  return state.wishlist[`${userId}:${courseSlug}`] === true;
}

/** Возвращает активную (не истёкшую, не отменённую) подписку или null */
export function getActiveSubscription(
  state: ArtumState,
  userId: string,
): Subscription | null {
  const now = new Date();
  return (
    state.subscriptions.find(
      (s) =>
        s.userId === userId &&
        !s.cancelled &&
        new Date(s.expiresAt) > now,
    ) ?? null
  );
}

export function getCourseProgressFromStore(
  state: ArtumState,
  userId: string | null,
  course: Course,
): { totalLessons: number; completedLessons: number; percent: number } {
  const all = course.modules.flatMap((m) => m.lessons);
  const total = all.length;
  if (!userId) {
    return { totalLessons: total, completedLessons: 0, percent: 0 };
  }
  const completed = all.filter((l) => isLessonComplete(state, userId, l.id)).length;
  return {
    totalLessons: total,
    completedLessons: completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function getCurrentUser(state: ArtumState): StoredUser | null {
  if (!state.currentUserId) return null;
  return state.users.find((u) => u.id === state.currentUserId) ?? null;
}

// ────────────────────────────────────────────────────────────────────
// CERTIFICATE AUTO-ISSUE
// ────────────────────────────────────────────────────────────────────

/**
 * Вызывается после markLessonComplete. Проверяет — пройден ли весь курс
 * целиком — и если да, выдаёт сертификат (если ещё не выдан).
 */
function maybeIssueCertificate(lessonId: string, userId: string): void {
  const state = useArtumStore.getState();
  // Найти курс, к которому принадлежит lesson
  let owningCourse: Course | null = null;
  for (const c of getAllCoursesEffective(state)) {
    if (c.modules.some((m) => m.lessons.some((l) => l.id === lessonId))) {
      owningCourse = c;
      break;
    }
  }
  if (!owningCourse) return;

  // Проверка: все ли уроки этого курса пройдены текущим юзером?
  const allLessons = owningCourse.modules.flatMap((m) => m.lessons);
  const allDone = allLessons.every((l) => isLessonComplete(state, userId, l.id));
  if (!allDone) return;

  // Сертификат уже выдан?
  const already = state.certificates.find(
    (c) => c.userId === userId && c.courseSlug === owningCourse!.slug,
  );
  if (already) return;

  const user = state.users.find((u) => u.id === userId);
  if (!user) return;

  const cert: StoredCertificate = {
    id: makeId('cert'),
    verificationNumber: getCertNumber(),
    userId,
    courseSlug: owningCourse.slug,
    studentName: user.name,
    issuedAt: new Date().toISOString(),
  };
  useArtumStore.setState((s) => ({ certificates: [cert, ...s.certificates] }));
}

// ────────────────────────────────────────────────────────────────────
// CATEGORY/COURSE selectors для удобства в Client Components
// ────────────────────────────────────────────────────────────────────

export function getCategories(): Category[] {
  return CATEGORIES;
}
