import { redirect } from 'next/navigation';

import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/server/queries/auth';

import { PaymentReturnClient } from './PaymentReturnClient';

/**
 * Страница возврата после оплаты ЮKassa (return_url).
 * Доступ выдаётся вебхуком асинхронно, поэтому клиент поллит статус,
 * пока платёж не станет succeeded/canceled.
 */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Оплата' };

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: { p?: string };
}) {
  const user = await requireUser('/profile');
  const paymentId = searchParams.p;
  if (!paymentId) redirect('/profile');

  // RLS-bound клиент: политика payments_self_select отдаёт только свои платежи.
  const supabase = createServerSupabase();
  const { data: payment } = await supabase
    .from('payments')
    .select('id, user_id, status, course_id')
    .eq('id', paymentId)
    .maybeSingle();

  // Платёж обязан принадлежать текущему пользователю (RLS уже это гарантирует).
  if (!payment || payment.user_id !== user.id) redirect('/profile');

  let courseSlug: string | null = null;
  if (payment.course_id) {
    const { data: course } = await supabase
      .from('courses')
      .select('slug')
      .eq('id', payment.course_id)
      .maybeSingle();
    courseSlug = course?.slug ?? null;
  }

  return (
    <PaymentReturnClient
      status={payment.status}
      kind={payment.course_id ? 'course' : 'subscription'}
      courseSlug={courseSlug}
    />
  );
}
