'use client';

import * as React from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t, type Lang } from '@/lib/i18n';
import { telHref, whatsappHref } from '@/lib/phone';
import { buttonVariants } from './button';
import { useLang } from '@/components/shell/lang-provider';

export interface PhoneActionsProps {
  phone: string | null | undefined;
  /** prefilled WhatsApp text, already in the right language */
  message?: string | null;
  /** icon = two 48px round buttons; full = two h-12 buttons with words */
  size?: 'icon' | 'full';
  lang?: Lang;
  className?: string;
}

/** Call + WhatsApp. Both disabled (grey, with a hint) when the number is unusable. */
export function PhoneActions({ phone, message, size = 'icon', lang, className }: PhoneActionsProps) {
  const ctxLang = useLang();
  const l = lang ?? ctxLang;
  const tel = telHref(phone);
  const wa = whatsappHref(phone, message);
  const disabled = !tel;
  const hint = disabled ? t(l, 'msg.whatsapp_no_phone') : undefined;
  const isIcon = size === 'icon';

  const callClasses = buttonVariants({ variant: 'outline', size: isIcon ? 'icon' : 'default', fullWidth: !isIcon });
  const waClasses = buttonVariants({ variant: 'whatsapp', size: isIcon ? 'icon' : 'default', fullWidth: !isIcon });

  return (
    <div className={cn('flex items-center gap-2', !isIcon && 'w-full', className)}>
      <a
        href={tel ?? undefined}
        aria-label={t(l, 'btn.call')}
        aria-disabled={disabled || undefined}
        title={hint}
        tabIndex={disabled ? -1 : undefined}
        className={cn(callClasses, disabled && 'border-slate-300 text-slate-400')}
        onClick={disabled ? (e) => e.preventDefault() : undefined}
      >
        <Phone aria-hidden="true" />
        {!isIcon && <span>{t(l, 'btn.call')}</span>}
      </a>
      <a
        href={wa ?? undefined}
        target={wa ? '_blank' : undefined}
        rel={wa ? 'noopener noreferrer' : undefined}
        aria-label={t(l, 'btn.whatsapp')}
        aria-disabled={disabled || undefined}
        title={hint}
        tabIndex={disabled ? -1 : undefined}
        className={cn(waClasses, disabled && 'bg-slate-300 text-slate-500 hover:bg-slate-300')}
        onClick={disabled ? (e) => e.preventDefault() : undefined}
      >
        <MessageCircle aria-hidden="true" />
        {!isIcon && <span>{t(l, 'btn.whatsapp')}</span>}
      </a>
    </div>
  );
}
