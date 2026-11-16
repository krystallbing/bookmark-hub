'use client';

import { BookmarkFilterPage } from '@/components/bookmark-filter-page';
import { useI18n } from '@/lib/i18n';

export default function TrashPage() {
  const { t } = useI18n();

  return (
    <BookmarkFilterPage
      title={t.filterPage.trash.title}
      desc={t.filterPage.trash.desc}
      emptyTitle={t.filterPage.trash.emptyTitle}
      emptyDesc={t.filterPage.trash.emptyDesc}
      query={{ status: 'deleted' }}
      trashMode
    />
  );
}
