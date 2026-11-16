'use client';

import { BookmarkFilterPage } from '@/components/bookmark-filter-page';
import { useI18n } from '@/lib/i18n';

export default function BrokenLinksPage() {
  const { t } = useI18n();

  return (
    <BookmarkFilterPage
      title={t.filterPage.broken.title}
      desc={t.filterPage.broken.desc}
      emptyTitle={t.filterPage.broken.emptyTitle}
      emptyDesc={t.filterPage.broken.emptyDesc}
      query={{ status: 'broken' }}
      badgeLabel={t.filterPage.broken.badge}
    />
  );
}
