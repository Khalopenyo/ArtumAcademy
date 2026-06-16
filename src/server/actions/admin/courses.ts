'use server';

import { revalidatePath } from 'next/cache';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import type { CategoryId } from '@/lib/mock/courses';
import { getCurrentUser } from '@/server/queries/auth';

/**
 * Admin Server Actions для CRUD каталога курсов.
 *
 * SECURITY: каждый action в начале вызывает assertAdmin() — это server-side
 * проверка cookie/сессии + profiles.is_admin. Без её прохождения action
 * возвращает { ok: false, error: ... } и НЕ трогает БД.
 *
 * Service-role клиент (createAdminClient) обходит RLS, поэтому без этой
 * проверки залогиненный non-admin пользователь смог бы вызывать actions
 * напрямую (Server Action endpoint открыт всем, кто знает URL).
 */

async function assertAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Не авторизован' };
  if (!user.isAdmin) return { ok: false, error: 'Недостаточно прав' };
  return { ok: true };
}

const CATEGORY_VALUES = ['ai', 'photo', 'video', 'editing', 'design', 'visual', 'copy'] as const;

const CourseSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug: только латиница, цифры, дефис'),
  title: z.string().min(1),
  shortDescription: z.string().default(''),
  longDescription: z.string().default(''),
  category: z.enum(CATEGORY_VALUES),
  studentsCount: z.number().int().min(0).default(0),
  priceMinor: z.number().int().min(0).default(0),
  coverGradient: z.string().default('from-purple-600 via-fuchsia-500 to-pink-500'),
  coverUrl: z.string().nullable().optional(),
  published: z.boolean().default(true),
  orderIndex: z.number().int().default(100),
  authorName: z.string().nullable().optional(),
  authorTitle: z.string().nullable().optional(),
  authorBio: z.string().nullable().optional(),
  authorAvatarUrl: z.string().nullable().optional(),
  learningOutcomes: z.array(z.string()).default([]),
});

type CourseInput = z.infer<typeof CourseSchema>;
type ActionResult = { ok: true } | { ok: false; error: string };

// ─── COURSES ────────────────────────────────────────────────────────

export async function createCourseAction(
  input: CourseInput,
): Promise<ActionResult & { slug?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const parsed = CourseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const admin = createAdminClient();
  const { error } = await admin.from('courses').insert({
    slug: parsed.data.slug,
    title: parsed.data.title,
    short_description: parsed.data.shortDescription,
    long_description: parsed.data.longDescription,
    category: parsed.data.category as CategoryId,
    students_count: parsed.data.studentsCount,
    price_minor: parsed.data.priceMinor,
    cover_gradient: parsed.data.coverGradient,
    cover_url: parsed.data.coverUrl ?? null,
    published: parsed.data.published,
    order_index: parsed.data.orderIndex,
    author_name: parsed.data.authorName ?? null,
    author_title: parsed.data.authorTitle ?? null,
    author_bio: parsed.data.authorBio ?? null,
    author_avatar_url: parsed.data.authorAvatarUrl ?? null,
    learning_outcomes: parsed.data.learningOutcomes,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Курс с таким slug уже существует' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/');
  revalidatePath(`/courses/${parsed.data.slug}`);
  return { ok: true, slug: parsed.data.slug };
}

export async function updateCourseAction(
  slug: string,
  patch: Partial<CourseInput>,
): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.shortDescription !== undefined) row.short_description = patch.shortDescription;
  if (patch.longDescription !== undefined) row.long_description = patch.longDescription;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.studentsCount !== undefined) row.students_count = patch.studentsCount;
  if (patch.priceMinor !== undefined) row.price_minor = patch.priceMinor;
  if (patch.coverGradient !== undefined) row.cover_gradient = patch.coverGradient;
  if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
  if (patch.published !== undefined) row.published = patch.published;
  if (patch.orderIndex !== undefined) row.order_index = patch.orderIndex;
  if (patch.authorName !== undefined) row.author_name = patch.authorName;
  if (patch.authorTitle !== undefined) row.author_title = patch.authorTitle;
  if (patch.authorBio !== undefined) row.author_bio = patch.authorBio;
  if (patch.authorAvatarUrl !== undefined) row.author_avatar_url = patch.authorAvatarUrl;
  if (patch.learningOutcomes !== undefined) row.learning_outcomes = patch.learningOutcomes;
  const { error } = await admin
    .from('courses')
    .update(row as never)
    .eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  revalidatePath(`/courses/${slug}`);
  return { ok: true };
}

export async function deleteCourseAction(slug: string): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin.from('courses').delete().eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  revalidatePath(`/courses/${slug}`);
  return { ok: true };
}

// ─── MODULES ────────────────────────────────────────────────────────

const ModuleInputSchema = z.object({
  courseSlug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  orderIndex: z.number().int().default(100),
});

export async function createModuleAction(
  input: z.infer<typeof ModuleInputSchema>,
): Promise<ActionResult & { moduleId?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const parsed = ModuleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const admin = createAdminClient();
  const { data: course, error: courseError } = await admin
    .from('courses')
    .select('id')
    .eq('slug', parsed.data.courseSlug)
    .single();
  if (courseError || !course) return { ok: false, error: 'Курс не найден' };
  const { data, error } = await admin
    .from('modules')
    .insert({
      course_id: course.id,
      title: parsed.data.title,
      description: parsed.data.description,
      order_index: parsed.data.orderIndex,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
  return { ok: true, moduleId: data.id };
}

export async function deleteModuleAction(
  moduleId: string,
  courseSlug: string,
): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin.from('modules').delete().eq('id', moduleId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseSlug}`);
  return { ok: true };
}

// ─── LESSONS ────────────────────────────────────────────────────────

/**
 * Санитизация HTML урока (вывод TipTap) перед записью — XSS-защита (security §3).
 * sanitize-html: чистый JS без jsdom (надёжен в server-бандле Next).
 * Разрешаем только теги/атрибуты, которые реально выдаёт редактор.
 */
function sanitizeLessonHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li',
      'blockquote', 'a', 'img', 'code', 'pre',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    },
  }).trim();
  return clean.length ? clean : null;
}

const LessonInputSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1),
  durationSec: z.number().int().min(60),
  // Видео НЕобязательно (бывают текстовые уроки). URL / Kinescope id / null —
  // классификацией занимается parseLessonVideo() на стороне плеера.
  videoUrl: z.string().min(1).nullable(),
  content: z.string().nullable().optional(),
  preview: z.boolean().default(false),
  orderIndex: z.number().int().default(100),
});

export async function createLessonAction(
  input: z.infer<typeof LessonInputSchema>,
  courseSlug: string,
): Promise<ActionResult & { lessonId?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const parsed = LessonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Невалидные данные' };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('lessons')
    .insert({
      module_id: parsed.data.moduleId,
      title: parsed.data.title,
      duration_sec: parsed.data.durationSec,
      video_url: parsed.data.videoUrl,
      content: sanitizeLessonHtml(parsed.data.content),
      preview: parsed.data.preview,
      order_index: parsed.data.orderIndex,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseSlug}`);
  return { ok: true, lessonId: data.id };
}

export async function updateLessonAction(
  lessonId: string,
  patch: Partial<{
    title: string;
    durationSec: number;
    videoUrl: string | null;
    content: string | null;
    preview: boolean;
    orderIndex: number;
  }>,
  courseSlug: string,
): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.durationSec !== undefined) row.duration_sec = patch.durationSec;
  if (patch.videoUrl !== undefined) row.video_url = patch.videoUrl;
  if (patch.content !== undefined) row.content = sanitizeLessonHtml(patch.content);
  if (patch.preview !== undefined) row.preview = patch.preview;
  if (patch.orderIndex !== undefined) row.order_index = patch.orderIndex;
  const { error } = await admin
    .from('lessons')
    .update(row as never)
    .eq('id', lessonId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseSlug}`);
  return { ok: true };
}

export async function deleteLessonAction(
  lessonId: string,
  courseSlug: string,
): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin.from('lessons').delete().eq('id', lessonId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/courses/${courseSlug}`);
  return { ok: true };
}

export async function reorderLessonsAction(
  lessonIds: string[],
  courseSlug: string,
): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const updates = lessonIds.map((id, idx) =>
    admin.from('lessons').update({ order_index: idx }).eq('id', id),
  );
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return { ok: false, error: firstError.message };
  revalidatePath(`/courses/${courseSlug}`);
  return { ok: true };
}
