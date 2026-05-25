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

  // ─── ACTIONS ──────────────────────────────────────────────────────
  // Auth
  registerUser: (input: { name: string; email: string; password: string }) =>
    | { ok: true; user: StoredUser }
    | { ok: false; error: string };
  loginUser: (input: { email: string; password: string }) =>
    | { ok: true; user: StoredUser }
    | { ok: false; error: string };
  logoutUser: () => void;
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
  // Progress / Purchase / Cert
  markLessonComplete: (lessonId: string) => void;
  unmarkLesson: (lessonId: string) => void;
  buyCourse: (courseSlug: string) => { ok: true } | { ok: false; error: string };
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
});

// Helper-тип для отделения данных от actions при типизации
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Actions = Pick<
  ArtumState,
  | 'registerUser'
  | 'loginUser'
  | 'logoutUser'
  | 'requestPasswordReset'
  | 'resetPasswordWithToken'
  | 'addCourse'
  | 'updateCourse'
  | 'deleteCourse'
  | 'addLesson'
  | 'updateLesson'
  | 'deleteLesson'
  | 'markLessonComplete'
  | 'unmarkLesson'
  | 'buyCourse'
  | 'reset'
>;

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
      buyCourse: (courseSlug) => {
        const { currentUserId } = get();
        if (!currentUserId) {
          return { ok: false, error: 'Сначала войдите в аккаунт' };
        }
        const course = getCourseEffective(get(), courseSlug);
        if (!course) return { ok: false, error: 'Курс не найден' };
        const key: PurchaseKey = `${currentUserId}:${courseSlug}`;
        if (get().purchases[key]) return { ok: false, error: 'Курс уже куплен' };
        const payment: StoredPayment = {
          id: makeId('pay'),
          userId: currentUserId,
          courseSlug,
          amountMinor: course.priceMinor,
          paidAt: new Date().toISOString(),
          method: 'card',
          status: 'succeeded',
        };
        set((state) => ({
          purchases: { ...state.purchases, [key]: true },
          payments: [payment, ...state.payments],
        }));
        return { ok: true };
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
  return state.purchases[`${userId}:${courseSlug}`] === true;
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
