import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Case } from '@/lib/cases';
import type { CategoryId } from '@/lib/mock/courses';

/**
 * Server queries для кейсов.
 *
 * Публичное чтение идёт под RLS-политикой `cases_public_select` —
 * анонимам/юзерам видны только published=true. Админ-запросы — service_role.
 */

interface CaseRow {
  id: string;
  title: string;
  student_name: string;
  description: string;
  result: string;
  category: CategoryId;
  cover_url: string | null;
  video_url: string | null;
  published: boolean;
  order_index: number;
}

function rowToCase(r: CaseRow): Case {
  return {
    id: r.id,
    title: r.title,
    studentName: r.student_name,
    description: r.description,
    result: r.result,
    category: r.category,
    coverUrl: r.cover_url,
    videoUrl: r.video_url,
    published: r.published,
    orderIndex: r.order_index,
  };
}

/** Публичные (опубликованные) кейсы — для /cases. RLS отдаёт только published. */
export async function getPublishedCases(): Promise<Case[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('published', true)
    .order('order_index', { ascending: true });
  if (error) {
    console.error('[cases.getPublishedCases] error:', error);
    return [];
  }
  return (data as CaseRow[]).map(rowToCase);
}

/** Админ: ВСЕ кейсы (включая черновики). service_role (мимо RLS). */
export async function getAllCasesForAdmin(): Promise<Case[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cases')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) {
    console.error('[cases.getAllCasesForAdmin] error:', error);
    return [];
  }
  return (data as CaseRow[]).map(rowToCase);
}

/** Админ: кейс по id (включая черновик) — для формы редактирования. service_role. */
export async function getCaseByIdForAdmin(id: string): Promise<Case | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('cases').select('*').eq('id', id).single();
  if (error || !data) return null;
  return rowToCase(data as CaseRow);
}
