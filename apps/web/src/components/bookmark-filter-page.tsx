'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface BookmarkItem {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  folderPath: string | null;
  status: string;
  isDuplicate: boolean;
  tags: string[];
  importedAt?: string;
  updatedAt?: string;
}

interface BookmarkFilterPageProps {
  title: string;
  desc: string;
  emptyTitle: string;
  emptyDesc: string;
  query: Record<string, string>;
  badgeLabel?: string;
  trashMode?: boolean;
}

export function BookmarkFilterPage({
  title,
  desc,
  emptyTitle,
  emptyDesc,
  query,
  badgeLabel,
  trashMode = false,
}: BookmarkFilterPageProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const next = new URLSearchParams({ limit: '100', offset: '0', ...query });
    return next.toString();
  }, [query]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/bookmarks?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError(t.filterPage.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [params, t]);

  useEffect(() => {
    // Existing app pages hydrate local API state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
  }, [fetchItems]);

  async function restoreBookmark(bookmark: BookmarkItem) {
    setWorkingId(bookmark.id);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/bookmarks/${encodeURIComponent(bookmark.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ok' }),
      });
      if (!res.ok) throw new Error('restore failed');
      setNotice(t.filterPage.restored);
      await fetchItems();
    } catch {
      setError(t.filterPage.restoreFailed);
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteForever(bookmark: BookmarkItem) {
    if (!window.confirm(t.filterPage.deleteConfirm(bookmark.title || bookmark.url))) return;

    setWorkingId(bookmark.id);
    setError('');
      setNotice('');
      try {
      const res = await fetch(`/api/bookmarks/${encodeURIComponent(bookmark.id)}?permanent=true`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('delete failed');
      setNotice(t.filterPage.deletedForever);
      await fetchItems();
    } catch {
      setError(t.filterPage.deleteFailed);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#101828]">{title}</h1>
          <p className="mt-1 text-sm text-[#475467]">{desc}</p>
        </div>
        <div className="rounded-xl border border-[#E1D9C9] bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <span className="text-[#667085]">{t.filterPage.totalCount}</span>
          <span className="ml-2 font-bold text-[#101828]">{total}</span>
        </div>
      </header>

      {(notice || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          error ? 'border-[#ffd2d2] bg-[#fff8f8] text-[#b42318]' : 'border-[#b7ebc6] bg-[#f0fff4] text-[#157347]'
        }`}>
          {error || notice}
        </div>
      )}

      <section className="rounded-xl border border-[#E1D9C9] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#667085]">{t.filterPage.loading}</div>
        ) : items.length === 0 ? (
          <div className="grid min-h-[360px] place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#F1EBDD] text-[#48664E]">—</div>
              <h2 className="mt-4 text-lg font-semibold text-[#101828]">{emptyTitle}</h2>
              <p className="mt-2 text-sm text-[#667085]">{emptyDesc}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-[#EEE9DF] bg-white text-xs font-semibold text-[#667085]">
                <tr>
                  <th className="px-4 py-3 text-left">{t.filterPage.table.bookmark}</th>
                  <th className="w-44 px-4 py-3 text-left">{t.filterPage.table.folder}</th>
                  <th className="w-36 px-4 py-3 text-left">{t.filterPage.table.status}</th>
                  <th className="w-40 px-4 py-3 text-left">{t.filterPage.table.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE9DF]">
                {items.map((bookmark) => (
                  <tr key={bookmark.id} className="hover:bg-white">
                    <td className="min-w-0 px-4 py-4">
                      <Link href={`/bookmarks/${bookmark.id}`} className="block min-w-0 font-semibold text-[#101828] hover:text-[#48664E]">
                        <span className="block truncate">{bookmark.title || t.filterPage.table.untitled}</span>
                      </Link>
                      <a href={bookmark.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-[#667085] hover:text-[#48664E]">
                        {bookmark.url}
                      </a>
                      {bookmark.summary && <p className="mt-1 line-clamp-1 text-xs text-[#667085]">{bookmark.summary}</p>}
                      {bookmark.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {bookmark.tags.slice(0, 5).map((tag) => (
                            <span key={tag} className="rounded bg-[#F1EBDD] px-1.5 py-0.5 text-xs font-medium text-[#48664E]">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-[#667085]">
                      <span className="block max-w-40 truncate" title={bookmark.folderPath ?? ''}>
                        {bookmark.folderPath || t.filterPage.table.uncategorized}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded-full border border-[#E1D9C9] px-2 py-0.5 text-xs text-[#475467]">
                          {bookmark.status}
                        </span>
                        {bookmark.isDuplicate && (
                          <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs text-[#c2410c]">{t.filterPage.table.duplicate}</span>
                        )}
                        {badgeLabel && (
                          <span className="rounded-full bg-[#F1EBDD] px-2 py-0.5 text-xs text-[#48664E]">{badgeLabel}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {trashMode ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => restoreBookmark(bookmark)}
                            disabled={workingId === bookmark.id}
                            className="rounded-lg bg-[#294435] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {t.filterPage.actions.restore}
                          </button>
                          <button
                            onClick={() => deleteForever(bookmark)}
                            disabled={workingId === bookmark.id}
                            className="rounded-lg border border-[#ffd2d2] px-3 py-1.5 text-xs font-semibold text-[#b42318] disabled:opacity-50"
                          >
                            {t.filterPage.actions.deleteForever}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Link href={`/bookmarks/${bookmark.id}`} className="rounded-lg border border-[#E1D9C9] px-3 py-1.5 text-xs font-semibold text-[#344054]">
                            {t.filterPage.actions.view}
                          </Link>
                          <a href={bookmark.url} target="_blank" rel="noreferrer" className="rounded-lg border border-[#E1D9C9] px-3 py-1.5 text-xs font-semibold text-[#344054]">
                            {t.filterPage.actions.open}
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
