import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { requireUser } from '@/server/queries/auth';
import { getCourseBySlugFromDb, getLessonPublicQuiz } from '@/server/queries/catalog';
import {
  getMyCompletedLessonIds,
  getMyWatchPositions,
  hasAccessToCourse,
} from '@/server/queries/commerce';
import type { Course, Lesson, Module } from '@/lib/mock/courses';

import { LessonPageClient } from './LessonPageClient';

interface LessonPageProps {
  params: { courseSlug: string; lessonId: string };
}

export interface LessonContext {
  course: Course;
  module: Module;
  lesson: Lesson;
  absoluteIndex: number;
  total: number;
  prev: { courseSlug: string; lessonId: string } | null;
  next: { courseSlug: string; lessonId: string } | null;
}

function findLessonContext(course: Course, lessonId: string): LessonContext | null {
  const flat: Array<{ module: Module; lesson: Lesson }> = [];
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      flat.push({ module: mod, lesson });
    }
  }
  const total = flat.length;
  const idx = flat.findIndex((x) => x.lesson.id === lessonId);
  if (idx === -1) return null;

  const { module, lesson } = flat[idx]!;
  const prevFlat = idx > 0 ? flat[idx - 1] : null;
  const nextFlat = idx < total - 1 ? flat[idx + 1] : null;

  return {
    course,
    module,
    lesson,
    absoluteIndex: idx,
    total,
    prev: prevFlat ? { courseSlug: course.slug, lessonId: prevFlat.lesson.id } : null,
    next: nextFlat ? { courseSlug: course.slug, lessonId: nextFlat.lesson.id } : null,
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const user = await requireUser(`/learn/${params.courseSlug}/${params.lessonId}`);

  const course = await getCourseBySlugFromDb(params.courseSlug);
  if (!course) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Курс не найден.{' '}
        <Link href="/" className="text-primary hover:underline">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  const ctx = findLessonContext(course, params.lessonId);
  if (!ctx) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Урок не найден.{' '}
        <Link href={`/courses/${course.slug}`} className="text-primary hover:underline">
          К курсу
        </Link>
      </div>
    );
  }

  // Access check: либо купил, либо подписка, либо preview, либо admin
  const hasAccess = await hasAccessToCourse(course.slug);
  const lessonAccess = hasAccess || ctx.lesson.preview;

  if (!lessonAccess) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card/60 p-8 text-center backdrop-blur-xl">
          <h1 className="text-xl font-semibold">Доступ закрыт</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Этот урок доступен после покупки курса. Откройте страницу курса
            и нажмите «Купить курс», чтобы получить доступ ко всем урокам.
          </p>
          <Button asChild className="mt-6">
            <Link href={`/courses/${course.slug}`}>К курсу</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Совместимые данные с прогресс
  const [completedLessonIds, watchPositions] = await Promise.all([
    getMyCompletedLessonIds(),
    getMyWatchPositions(),
  ]);

  const startPositionSec = watchPositions[ctx.lesson.id]?.positionSec ?? 0;

  // Тест урока — только вопросы/варианты, БЕЗ правильных ответов.
  const quiz = ctx.lesson.hasQuiz ? await getLessonPublicQuiz(ctx.lesson.id) : null;

  return (
    <LessonPageClient
      ctx={ctx}
      completedLessonIds={Array.from(completedLessonIds)}
      startPositionSec={startPositionSec}
      watermarkText={user.email}
      quiz={quiz}
    />
  );
}
