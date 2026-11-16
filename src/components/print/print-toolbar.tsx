'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { whatsappHref } from '@/lib/phone';
import { useT } from '@/components/shell/lang-provider';

export interface PrintToolbarProps {
  backHref?: string;
  /** Prefilled WhatsApp text (wa.* template); the PDF is attached by the user from the share sheet. */
  whatsapp?: { phone: string | null | undefined; message: string };
}

/** Sticky, hidden when printing: Back, Print, Share on WhatsApp. */
export function PrintToolbar({ backHref, whatsapp }: PrintToolbarProps) {
  const tt = useT();
  const router = useRouter();
  const wa = whatsapp ? whatsappHref(whatsapp.phone, whatsapp.message) : null;

  return (
    <div className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white p-3">
      <div className="mx-auto flex max-w-[190mm] flex-wrap items-center gap-2">
        {backHref ? (
          <Link href={backHref} className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft aria-hidden="true" />
            {tt('btn.back')}
          </Link>
        ) : (
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft aria-hidden="true" />
            {tt('btn.back')}
          </Button>
        )}
        <Button onClick={() => window.print()} className="flex-1">
          <Printer aria-hidden="true" />
          {tt('btn.print')}
        </Button>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'whatsapp' })}>
            <MessageCircle aria-hidden="true" />
            {tt('btn.share_whatsapp')}
          </a>
        )}
      </div>
    </div>
  );
}
