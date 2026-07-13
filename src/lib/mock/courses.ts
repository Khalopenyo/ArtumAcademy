/**
 * Mock-каталог курсов Artum Academy для этапа 1 ТЗ (скелет).
 *
 * Источник: ТЗ §6 (категории + примеры курсов). Данные изобретены
 * для визуала; реальный контент попадёт через CMS / админку на этапе 6.
 *
 * Когда появится Supabase БД (этап 3), этот файл удаляется и заменяется
 * на server queries (`src/server/queries/courses.ts`).
 */

import { MOCK_CURRENT_USER } from './user';

// ────────────────────────────────────────────────────────────────────
// КАТЕГОРИИ (ТЗ §2 + §6)
// ────────────────────────────────────────────────────────────────────

export type CategoryId =
  | 'ai'
  | 'photo'
  | 'video'
  | 'editing'
  | 'design'
  | 'visual'
  | 'copy';

export interface Category {
  id: CategoryId;
  label: string;
  /** Цвет тега — Tailwind utility class, обращается к --tag-* CSS var */
  tagBgClass: string;
  tagTextClass: string;
  /** Иконка-emoji для пилюли (быстрый визуал; SVG-логотипы — этап позже) */
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: 'ai',      label: 'Нейросети / AI',  tagBgClass: 'bg-tag-ai/20',      tagTextClass: 'text-tag-ai',      emoji: '🧠' },
  { id: 'photo',   label: 'Фото',            tagBgClass: 'bg-tag-photo/15',   tagTextClass: 'text-tag-photo',   emoji: '📷' },
  { id: 'video',   label: 'Видео',           tagBgClass: 'bg-tag-video/15',   tagTextClass: 'text-tag-video',   emoji: '🎬' },
  { id: 'editing', label: 'Монтаж',          tagBgClass: 'bg-tag-editing/15', tagTextClass: 'text-tag-editing', emoji: '✂️' },
  { id: 'design',  label: 'Дизайн',          tagBgClass: 'bg-tag-design/15',  tagTextClass: 'text-tag-design',  emoji: '🎨' },
  { id: 'visual',  label: 'Визуал',          tagBgClass: 'bg-tag-visual/15',  tagTextClass: 'text-tag-visual',  emoji: '✨' },
  { id: 'copy',    label: 'Копирайтинг',     tagBgClass: 'bg-tag-copy/15',    tagTextClass: 'text-tag-copy',    emoji: '✍️' },
];

export function getCategory(id: CategoryId): Category {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}

// ────────────────────────────────────────────────────────────────────
// КУРСЫ
// ────────────────────────────────────────────────────────────────────

export interface Lesson {
  id: string;
  title: string;
  /** Длительность в секундах */
  durationSec: number;
  /** Прошёл ли пользователь этот урок (только для текущего mock user) */
  completed: boolean;
  /** Был ли превью-доступ (открыт без покупки) */
  preview: boolean;
  /**
   * URL видео (YouTube / Vimeo / прямой mp4). null = placeholder.
   * На стадии скелета используем publicly-available YouTube видео
   * по теме каждого курса. На реальной БД заменим на signed URLs
   * Mux/Kinescope.
   */
  videoUrl: string | null;
  /** HTML-контент урока (текст + картинки), санитизированный. null = нет. */
  content?: string | null;
  /** Есть ли у урока тест. Сами вопросы грузятся отдельно (админ — полный,
   *  студент — без правильных ответов), в этот тип они НЕ кладутся. */
  hasQuiz?: boolean;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  category: CategoryId;
  /** Кол-во студентов (для соц. proof в карточке) */
  studentsCount: number;
  /** Цена в копейках/центах — отображается через formatPrice */
  priceMinor: number;
  /** Гладиент для placeholder обложки (когда нет реального cover) */
  coverGradient: string;
  /** URL медиа-обложки (картинка / GIF / видео). null = показываем градиент. */
  coverUrl?: string | null;
  /** Опубликован ли курс (виден в каталоге). false = черновик. */
  published?: boolean;
  /** Автор/преподаватель — блок доверия на странице курса. */
  authorName?: string | null;
  authorTitle?: string | null;
  authorBio?: string | null;
  authorAvatarUrl?: string | null;
  /** «Чему вы научитесь» — список результатов (буллеты). */
  learningOutcomes?: string[];
  modules: Module[];
  /** Является ли курс купленным текущим пользователем (mock) */
  purchased: boolean;
  /** Дата покупки в ISO (только для купленных) */
  purchasedAt: string | null;
  /** Сертификат уже выдан? */
  certificateIssued: boolean;
}

/**
 * Помощник для генерации mock-уроков.
 * Tuple: [title, durationSec, videoUrl?, preview?]
 *
 * Lesson ID — latin-only (`lesson-{moduleSlug}-{idx}`).
 * videoUrl — публичный YouTube URL (Creative Commons / NoticeOK для демо).
 *   Будет заменён на signed URLs (Mux/Kinescope) при переходе на БД.
 */
function lessons(
  moduleSlug: string,
  items: Array<[string, number, string?, boolean?]>,
  completedCount = 0,
): Lesson[] {
  return items.map(([title, durationSec, videoUrl, preview], idx) => ({
    id: `lesson-${moduleSlug}-${idx + 1}`,
    title,
    durationSec,
    completed: idx < completedCount,
    preview: preview ?? idx === 0,
    videoUrl: videoUrl ?? null,
  }));
}

export const COURSES: Course[] = [
  // ─── AI ────────────────────────────────────────────────────────────
  {
    id: 'course-mj-promptcraft',
    slug: 'midjourney-promptcraft',
    title: 'Midjourney от нуля до промптинга',
    shortDescription: 'Освойте генерацию изображений в Midjourney v7',
    longDescription:
      'Полный курс по работе с Midjourney v7: от базовых команд до сложных prompt-инженерных приёмов. Научитесь генерировать качественные изображения для соцсетей, презентаций, моодбордов и коммерческих проектов.',
    category: 'ai',
    studentsCount: 2847,
    priceMinor: 1_990_000,
    coverGradient: 'from-purple-600 via-fuchsia-500 to-pink-500',
    modules: [
      {
        id: 'mod-mj-1',
        title: 'Введение в Midjourney',
        description: 'Установка, аккаунт Discord, первые команды',
        lessons: lessons('mod-mj-1', 
          [
            ['Что такое Midjourney и для чего он нужен', 720, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', true],
            ['Регистрация и подключение к Discord', 480, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'],
            ['Первый промпт: команда /imagine', 900, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'],
          ],
          3,
        ),
      },
      {
        id: 'mod-mj-2',
        title: 'Промпт-инжиниринг',
        description: 'Структура запросов, параметры, стили',
        lessons: lessons('mod-mj-2', 
          [
            ['Анатомия эффективного промпта', 1080, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'],
            ['Параметры --ar, --stylize, --chaos', 960, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'],
            ['Стилизация: художники, фотореализм, аниме', 1320, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'],
            ['Использование reference-изображений', 1140, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'],
          ],
          1,
        ),
      },
    ],
    purchased: true,
    purchasedAt: '2026-04-12',
    certificateIssued: false,
  },
  {
    id: 'course-chatgpt-pro',
    slug: 'chatgpt-for-creators',
    title: 'ChatGPT для авторов и креаторов',
    shortDescription: 'Продвинутый промптинг для текстовых задач',
    longDescription:
      'Как использовать ChatGPT в ежедневной работе: написание сценариев, идеация, исследование тем, форматирование контента и автоматизация рутины через Custom GPTs.',
    category: 'ai',
    studentsCount: 1923,
    priceMinor: 1_490_000,
    coverGradient: 'from-violet-600 via-purple-500 to-indigo-500',
    modules: [
      {
        id: 'mod-cgpt-1',
        title: 'Основы работы с ChatGPT',
        description: 'Интерфейс, лимиты, базовые приёмы',
        lessons: lessons('mod-cgpt-1', 
          [
            ['Введение и принципы LLM', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', true],
            ['Структура хорошего промпта', 840, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4'],
            ['Custom Instructions и память', 540, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4'],
          ],
          0,
        ),
      },
    ],
    purchased: false,
    purchasedAt: null,
    certificateIssued: false,
  },

  // ─── Photo ─────────────────────────────────────────────────────────
  {
    id: 'course-mobile-photo',
    slug: 'mobile-photography-basics',
    title: 'Мобильная фотография: композиция и свет',
    shortDescription: 'Снимайте на телефон как профи',
    longDescription:
      'Курс о том, как делать сильные фото на iPhone и Android. Работа со светом, композиция, цвет, базовая ретушь в Lightroom Mobile, портфолио в Instagram.',
    category: 'photo',
    studentsCount: 4127,
    priceMinor: 990_000,
    coverGradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    modules: [
      {
        id: 'mod-mp-1',
        title: 'Основы композиции',
        description: 'Правило третей, направляющие линии, ритм',
        lessons: lessons('mod-mp-1', 
          [
            ['Правило третей и золотое сечение', 780, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4', true],
            ['Направляющие линии и перспектива', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'],
            ['Симметрия и асимметрия', 540, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'],
          ],
          2,
        ),
      },
      {
        id: 'mod-mp-2',
        title: 'Свет в кадре',
        description: 'Естественный свет, золотой час, силуэты',
        lessons: lessons('mod-mp-2', 
          [
            ['Жёсткий и мягкий свет', 720, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'],
            ['Золотой час и синий час', 900, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'],
            ['Контровой свет и силуэты', 600, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'],
          ],
          0,
        ),
      },
    ],
    purchased: true,
    purchasedAt: '2026-03-20',
    certificateIssued: false,
  },
  {
    id: 'course-lightroom',
    slug: 'lightroom-essentials',
    title: 'Lightroom Mobile: ретушь и пресеты',
    shortDescription: 'Цветокоррекция на телефоне',
    longDescription:
      'Полный воркфлоу обработки фото в Lightroom Mobile: импорт, базовая коррекция, локальные правки, создание собственных пресетов и публикация.',
    category: 'photo',
    studentsCount: 3216,
    priceMinor: 1_290_000,
    coverGradient: 'from-green-500 via-emerald-400 to-lime-500',
    modules: [
      {
        id: 'mod-lr-1',
        title: 'Интерфейс и базовая коррекция',
        description: 'Знакомство, экспозиция, баланс белого',
        lessons: lessons('mod-lr-1', [['Установка и интерфейс', 600, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', true], ['Экспозиция и контраст', 720, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4']], 2),
      },
    ],
    purchased: true,
    purchasedAt: '2026-02-05',
    certificateIssued: true,
  },

  // ─── Video ─────────────────────────────────────────────────────────
  {
    id: 'course-mobile-video',
    slug: 'mobile-video-storytelling',
    title: 'Видеосъёмка на телефон: сторителлинг',
    shortDescription: 'Снимайте сильные видео для соцсетей',
    longDescription:
      'Полный курс по съёмке видео на смартфон: стабилизация, свет, звук, кадрирование, базовый монтаж, экспорт под Reels/Shorts/TikTok.',
    category: 'video',
    studentsCount: 1849,
    priceMinor: 1_790_000,
    coverGradient: 'from-amber-500 via-yellow-500 to-orange-500',
    modules: [
      {
        id: 'mod-mv-1',
        title: 'Подготовка к съёмке',
        description: 'Сценарий, раскадровка, оборудование',
        lessons: lessons('mod-mv-1', 
          [
            ['Идея и сценарий', 540, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', true],
            ['Раскадровка', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4'],
            ['Оборудование на телефоне', 480, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4'],
          ],
          0,
        ),
      },
    ],
    purchased: false,
    purchasedAt: null,
    certificateIssued: false,
  },

  // ─── Editing ───────────────────────────────────────────────────────
  {
    id: 'course-davinci-resolve',
    slug: 'davinci-resolve-fundamentals',
    title: 'DaVinci Resolve: основы монтажа',
    shortDescription: 'Бесплатный профессиональный монтаж',
    longDescription:
      'Курс по DaVinci Resolve для начинающих: интерфейс, импорт, базовая склейка, транзишены, цветокор, экспорт. Альтернатива Premiere Pro без подписки.',
    category: 'editing',
    studentsCount: 2384,
    priceMinor: 1_990_000,
    coverGradient: 'from-orange-500 via-red-500 to-pink-500',
    modules: [
      {
        id: 'mod-dv-1',
        title: 'Введение в DaVinci Resolve',
        description: 'Установка, интерфейс, первый проект',
        lessons: lessons('mod-dv-1', 
          [
            ['Установка и системные требования', 540, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4', true],
            ['Обзор интерфейса: Media / Edit / Color', 780, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'],
            ['Создание первого проекта', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'],
          ],
          1,
        ),
      },
      {
        id: 'mod-dv-2',
        title: 'Базовый монтаж',
        description: 'Резка, склейка, транзишены, синхронизация',
        lessons: lessons('mod-dv-2', 
          [
            ['Резка и склейка клипов', 900, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'],
            ['Базовые транзишены', 720, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'],
            ['Синхронизация со звуком', 840, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'],
          ],
          0,
        ),
      },
    ],
    purchased: true,
    purchasedAt: '2026-04-30',
    certificateIssued: false,
  },

  // ─── Design ────────────────────────────────────────────────────────
  {
    id: 'course-figma-essentials',
    slug: 'figma-essentials',
    title: 'Figma: дизайн от макета до прототипа',
    shortDescription: 'UX/UI-дизайн на современном инструменте',
    longDescription:
      'Полный курс по Figma: фреймы, компоненты, варианты, авто-лейаут, прототипирование, design tokens, плагины, экспорт в Dev-mode.',
    category: 'design',
    studentsCount: 5471,
    priceMinor: 2_490_000,
    coverGradient: 'from-blue-500 via-sky-500 to-cyan-500',
    modules: [
      {
        id: 'mod-fig-1',
        title: 'Введение в Figma',
        description: 'Установка, интерфейс, базовая навигация',
        lessons: lessons('mod-fig-1', 
          [
            ['Зачем Figma и кому она нужна', 480, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', true],
            ['Установка и интерфейс', 600, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'],
          ],
          0,
        ),
      },
    ],
    purchased: false,
    purchasedAt: null,
    certificateIssued: false,
  },

  // ─── Visual ────────────────────────────────────────────────────────
  {
    id: 'course-instagram-visual',
    slug: 'instagram-visual-aesthetic',
    title: 'Эстетика Instagram-ленты',
    shortDescription: 'Визуальный язык для бренда',
    longDescription:
      'Как создавать цельную визуальную ленту в Instagram: цветовая палитра, типографика, ритм, контент-планнинг, шаблоны.',
    category: 'visual',
    studentsCount: 1267,
    priceMinor: 1_190_000,
    coverGradient: 'from-pink-500 via-rose-500 to-fuchsia-500',
    modules: [
      {
        id: 'mod-vis-1',
        title: 'Цвет и типографика',
        description: 'Палитра, шрифты, контраст',
        lessons: lessons('mod-vis-1', [['Цветовая палитра бренда', 660, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', true]], 0),
      },
    ],
    purchased: false,
    purchasedAt: null,
    certificateIssued: false,
  },

  // ─── Copy ──────────────────────────────────────────────────────────
  {
    id: 'course-copy-social',
    slug: 'copywriting-for-social-media',
    title: 'Копирайтинг для соцсетей',
    shortDescription: 'Тексты, которые продают и удерживают',
    longDescription:
      'Курс по написанию постов, рилсов, рекламы и сторителлинга для Instagram / Telegram / VK. Структуры, hooks, CTA, тестирование текстов.',
    category: 'copy',
    studentsCount: 943,
    priceMinor: 990_000,
    coverGradient: 'from-teal-500 via-cyan-500 to-emerald-500',
    modules: [
      {
        id: 'mod-cp-1',
        title: 'Основы',
        description: 'Структуры текстов, hooks, CTA',
        lessons: lessons('mod-cp-1', [['Зачем структура и hooks', 480, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', true]], 0),
      },
    ],
    purchased: false,
    purchasedAt: null,
    certificateIssued: false,
  },
];

// ────────────────────────────────────────────────────────────────────
// ВЫЧИСЛЯЕМЫЕ ХЕЛПЕРЫ
// ────────────────────────────────────────────────────────────────────

export function getCourseBySlug(slug: string): Course | null {
  return COURSES.find((c) => c.slug === slug) ?? null;
}

export function getCoursesByCategory(categoryId: CategoryId | 'all'): Course[] {
  if (categoryId === 'all') return COURSES;
  return COURSES.filter((c) => c.category === categoryId);
}

export function getPurchasedCourses(): Course[] {
  return COURSES.filter((c) => c.purchased);
}

export function getCertificatedCourses(): Course[] {
  return COURSES.filter((c) => c.certificateIssued);
}

export function getCourseProgress(course: Course): {
  totalLessons: number;
  completedLessons: number;
  /** Целое число от 0 до 100 */
  percent: number;
} {
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const completed = allLessons.filter((l) => l.completed).length;
  const total = allLessons.length;
  return {
    totalLessons: total,
    completedLessons: completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function getCourseTotalDuration(course: Course): number {
  return course.modules
    .flatMap((m) => m.lessons)
    .reduce((sum, l) => sum + l.durationSec, 0);
}

export function getCourseLessonsCount(course: Course): number {
  return course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
}

/** Найти следующий не пройденный урок (для CTA «Продолжить») */
export function getNextLesson(course: Course): { module: Module; lesson: Lesson; lessonIndex: number; total: number } | null {
  let absoluteIndex = 0;
  const total = getCourseLessonsCount(course);
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (!lesson.completed) {
        return { module: mod, lesson, lessonIndex: absoluteIndex, total };
      }
      absoluteIndex += 1;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
// СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ (для блока ТЗ §4.1)
// ────────────────────────────────────────────────────────────────────

export interface UserStats {
  activeCourses: number;
  certificates: number;
  /** Время обучения в часах (округлено) */
  studyHoursTotal: number;
  /** Общий прогресс — среднее по купленным курсам */
  overallProgressPercent: number;
}

export function getUserStats(): UserStats {
  const purchased = getPurchasedCourses();
  const certificates = getCertificatedCourses().length;
  const active = purchased.filter((c) => {
    const p = getCourseProgress(c);
    return p.percent > 0 && p.percent < 100;
  }).length;

  const studySeconds = purchased.reduce((sum, c) => {
    const p = getCourseProgress(c);
    const totalDur = getCourseTotalDuration(c);
    return sum + totalDur * (p.percent / 100);
  }, 0);
  const studyHours = Math.round(studySeconds / 3600);

  const overall =
    purchased.length === 0
      ? 0
      : Math.round(
          purchased.reduce((sum, c) => sum + getCourseProgress(c).percent, 0) /
            purchased.length,
        );

  return {
    activeCourses: active,
    certificates,
    studyHoursTotal: studyHours,
    overallProgressPercent: overall,
  };
}

// ────────────────────────────────────────────────────────────────────
// ИСТОРИЯ ПЛАТЕЖЕЙ (для ЛК ТЗ §4.5)
// ────────────────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  courseSlug: string;
  courseTitle: string;
  amountMinor: number;
  /** Дата платежа ISO */
  paidAt: string;
  method: 'card' | 'sbp' | 'subscription';
  status: 'succeeded' | 'refunded';
}

export const MOCK_PAYMENTS: Payment[] = getPurchasedCourses().map((c, idx) => ({
  id: `pay-${idx + 1}`,
  courseSlug: c.slug,
  courseTitle: c.title,
  amountMinor: c.priceMinor,
  paidAt: c.purchasedAt ?? '2026-01-01',
  method: idx === 0 ? 'card' : idx === 1 ? 'sbp' : 'card',
  status: 'succeeded',
}));

// ────────────────────────────────────────────────────────────────────
// ФОРМАТТЕРЫ
// ────────────────────────────────────────────────────────────────────

/** Цена → "19 900 ₽" в русской локали */
export function formatPrice(priceMinor: number, currency: string = '₽'): string {
  const major = priceMinor / 100;
  return `${new Intl.NumberFormat('ru-RU').format(major)} ${currency}`;
}

/** Длительность в секундах → "1 ч 23 мин" / "45 мин" */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

/** "47 уроков" / "1 урок" / "2 урока" — правильное склонение */
export function formatLessonsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} урок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} урока`;
  return `${count} уроков`;
}

/** "2 847 студентов" — с пробелами как тысячный разделитель + правильное склонение */
export function formatStudentsCount(count: number): string {
  const formatted = new Intl.NumberFormat('ru-RU').format(count);
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${formatted} студент`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${formatted} студента`;
  return `${formatted} студентов`;
}

// ────────────────────────────────────────────────────────────────────
// СЕРТИФИКАТЫ (ТЗ §4.5 + §5.4)
// ────────────────────────────────────────────────────────────────────

export interface Certificate {
  id: string;
  /** Уникальный номер для верификации */
  verificationNumber: string;
  courseSlug: string;
  courseTitle: string;
  studentName: string;
  /** Дата выдачи ISO */
  issuedAt: string;
}

export const MOCK_CERTIFICATES: Certificate[] = getCertificatedCourses().map((c, idx) => ({
  id: `cert-${idx + 1}`,
  verificationNumber: `ART-2026-${String(idx + 1).padStart(6, '0')}`,
  courseSlug: c.slug,
  courseTitle: c.title,
  studentName: MOCK_CURRENT_USER.name,
  issuedAt: c.purchasedAt ?? '2026-01-01',
}));
