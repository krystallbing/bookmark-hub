'use client';

import { BookmarkFilterPage } from '@/components/bookmark-filter-page';
import { useI18n } from '@/lib/i18n';

export default function DuplicatesPage() {
  const { t } = useI18n();

  return (
    <BookmarkFilterPage
      title={t.filterPage.duplicates.title}
      desc={t.filterPage.duplicates.desc}
      emptyTitle={t.filterPage.duplicates.emptyTitle}
      emptyDesc={t.filterPage.duplicates.emptyDesc}
      query={{ isDuplicate: 'true' }}
      badgeLabel={t.filterPage.duplicates.badge}
    />
  );
}
