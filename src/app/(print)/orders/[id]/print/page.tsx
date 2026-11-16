import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { requireModule } from '@/lib/auth';

/**
 * contracts.md 6.1 form of the order papers: /orders/[id]/print?doc=pi|invoice|sdn&dispatch=<id>.
 * Sends the reader to the screens.md routes /orders/[id]/print/pi | invoice | slip.
 */
export default async function OrderPrintRedirect({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireModule('orders'); // Wall 2
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const docParam = typeof searchParams?.doc === 'string' ? searchParams.doc : 'pi';
  const doc = docParam === 'sdn' || docParam === 'slip' ? 'slip' : docParam === 'invoice' ? 'invoice' : 'pi';
  const dispatch = typeof searchParams?.dispatch === 'string' && z.string().uuid().safeParse(searchParams.dispatch).success ? searchParams.dispatch : null;
  redirect(`/orders/${params.id}/print/${doc}${dispatch ? `?dispatch=${dispatch}` : ''}`);
}

export const dynamic = 'force-dynamic';
