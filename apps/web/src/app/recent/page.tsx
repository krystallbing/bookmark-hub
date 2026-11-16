'use client';

import { BookmarkFilterPage } from '@/components/bookmark-filter-page';
import { useI18n } from '@/lib/i18n';

export default function RecentBookmarksPage() {
  const { t } = useI18n();

  return (
    <BookmarkFilterPage
      title={t.filterPage.recent.title}
      desc={t.filterPage.recent.desc}
      emptyTitle={t.filterPage.recent.emptyTitle}
      emptyDesc={t.filterPage.recent.emptyDesc}
      query={{}}
      badgeLabel={t.filterPage.recent.badge}
    />
  );
}
