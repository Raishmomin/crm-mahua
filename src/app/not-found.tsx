import Link from 'next/link';
import { cookies } from 'next/headers';
import { SearchX } from 'lucide-react';
import { LANG_COOKIE, t, toLang } from '@/lib/i18n';
import { buttonVariants } from '@/components/ui/button';

/** Unknown route: one sentence + Go Home, in the cookie language. */
export default function NotFound() {
  const lang = toLang(cookies().get(LANG_COOKIE)?.value);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
      <SearchX className="h-10 w-10 text-slate-300" aria-hidden="true" />
      <h1 className="text-xl font-bold text-slate-900">{t(lang, 'msg.error.not_found')}</h1>
      <Link href="/" className={buttonVariants({ className: 'mt-2 w-full max-w-xs' })}>
        {t(lang, 'btn.go_home')}
      </Link>
    </main>
  );
}
