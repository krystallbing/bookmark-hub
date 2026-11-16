'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export function WelcomeCard() {
  const { t, locale } = useI18n();
  return (
    <div className="rounded-lg border border-[#E1D9C9] bg-white p-7 md:p-8">
      <h1 className={locale === 'en'
        ? 'max-w-[760px] font-serif text-[clamp(2rem,3.2vw,2.75rem)] font-normal leading-[1.06] tracking-[-0.035em] text-[#23372B]'
        : 'max-w-[760px] font-sans text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.18] tracking-[0.01em]'}>
        {locale === 'en' ? (
          <><span className="block text-[#23372B]">{t.dashboard.heroTitleLines.lead}</span><em className="block text-balance font-normal italic text-[#48664E]">{t.dashboard.heroTitleLines.emphasis}</em></>
        ) : (
          <><span className="block text-balance font-bold text-[#23372B]">{t.dashboard.heroTitleLines.lead}</span><span className="block text-balance font-medium tracking-[0.04em] text-[#48664E]">{t.dashboard.heroTitleLines.emphasis}</span></>
        )}
      </h1>
      <p className="mt-4 text-sm leading-6 text-[#59634F]">{t.dashboard.heroDesc}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/rescue" className="inline-flex h-9 items-center justify-center rounded-md bg-[#294435] px-5 text-sm font-medium text-white transition hover:bg-[#1F3228]">{t.dashboard.startOrganize}</Link>
      </div>
    </div>
  );
}
