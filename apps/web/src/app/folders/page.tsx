'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface FolderItem {
  id: string;
  path: string;
  name: string;
  parentPath: string | null;
  count: number;
}

interface BookmarkItem {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  folderPath: string | null;
  status: string;
  isDuplicate: boolean;
  tags: string[];
}

export default function FoldersPage() {
  const { t } = useI18n();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [query, setQuery] = useState('');
  const [localPendingCount, setLocalPendingCount] = useState(0);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.path === selectedPath) ?? null,
    [folders, selectedPath]
  );

  const filteredFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((folder) => `${folder.path} ${folder.name}`.toLowerCase().includes(q));
  }, [folders, query]);

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch('/api/folders?scope=chrome');
      const data = await res.json();
      const nextFolders: FolderItem[] = data.folders ?? [];
      setFolders(nextFolders);
      setLocalPendingCount(Number(data.localPendingCount ?? 0));
      setSelectedPath((current) => current && nextFolders.some((folder) => folder.path === current)
        ? current
        : nextFolders[0]?.path ?? null
      );
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const loadBookmarks = useCallback(async (folderPath: string | null) => {
    if (!folderPath) {
      setBookmarks([]);
      setTotal(0);
      return;
    }

    setLoadingBookmarks(true);
    try {
      const params = new URLSearchParams({ folder: folderPath, limit: '100', offset: '0', chromeLinked: 'true' });
      const res = await fetch(`/api/bookmarks?${params}`);
      const data = await res.json();
      setBookmarks(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoadingBookmarks(false);
    }
  }, []);

  useEffect(() => {
    // Existing app pages hydrate local API state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    // Existing app pages hydrate local API state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBookmarks(selectedPath);
  }, [loadBookmarks, selectedPath]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#23372B]">{t.folders.title}</h1>
          <p className="mt-1 text-xs text-[#59634F]">{t.folders.desc}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-md border border-[#E1D9C9] bg-white px-3 py-1.5 text-xs">
          <span className="text-[#59634F]">{t.folders.chromeFolders}</span>
            <span className="ml-2 font-bold text-[#23372B]">{folders.length}</span>
          </div>
          {localPendingCount > 0 && (
            <Link
              href="/rescue"
              className="rounded-md border border-[#48664E] bg-[#F1EBDD] px-3 py-1.5 text-xs font-semibold text-[#48664E] transition hover:bg-[#E1D9C9]"
            >
              {t.folders.pendingSync(localPendingCount)}
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-[#E1D9C9] bg-white">
          <div className="border-b border-[#E1D9C9] p-4">
            <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider">{t.folders.sidebarTitle}</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.folders.placeholder}
              className="mt-3 h-8 w-full rounded border border-[#E1D9C9] bg-[#F8F7F2] px-2.5 text-xs outline-none focus:border-[#48664E]"
            />
          </div>
          <div className="max-h-[640px] overflow-auto p-2">
            {loadingFolders ? (
            <div className="p-6 text-center text-xs text-[#59634F]">{t.folders.loading}</div>
            ) : filteredFolders.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#59634F]">{t.folders.noFolders}</div>
            ) : (
              filteredFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedPath(folder.path)}
                  className={`mb-1 flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-xs transition ${
                    selectedPath === folder.path
                      ? 'bg-[#EDE6D6] text-[#59634F] font-bold'
                      : 'text-[#26372D] hover:bg-[#eeeeec]'
                  }`}
                  title={folder.path}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{folder.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#59634F]">{folder.path}</span>
                  </span>
                  <span className="shrink-0 rounded border border-[#E1D9C9] px-1.5 py-0.5 text-xs text-[#59634F]">{folder.count}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-[#E1D9C9] bg-white">
          <div className="border-b border-[#E1D9C9] p-5">
              <h2 className="text-sm font-semibold text-[#23372B]">{selectedFolder?.name ?? t.folders.selectFolder}</h2>
            <p className="mt-1 text-xs text-[#59634F]">
                {selectedFolder ? t.folders.stats(selectedFolder.path, total) : t.folders.selectDesc}
            </p>
          </div>

          {loadingBookmarks ? (
            <div className="p-10 text-center text-xs text-[#59634F]">{t.folders.loadingBookmarks}</div>
          ) : bookmarks.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center p-8 text-center text-muted">
              <div>
                <h3 className="text-xs font-semibold text-[#23372B]">{t.folders.emptyTitle}</h3>
                <p className="mt-2 text-xs text-[#59634F]">{t.folders.emptyDesc}</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#E1D9C9]">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="p-4 hover:bg-[#EEE9DF]/30 transition">
                  <Link href={`/bookmarks/${bookmark.id}`} className="font-semibold text-sm text-[#23372B] hover:text-[#48664E] transition-colors">
                      {bookmark.title || t.folders.untitled}
                  </Link>
                  <a href={bookmark.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-[#59634F] hover:text-[#48664E] transition-colors">
                    {bookmark.url}
                  </a>
                  {bookmark.summary && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#59634F]">{bookmark.summary}</p>}
                  {bookmark.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {bookmark.tags.slice(0, 6).map((tag) => (
                        <span key={tag} className="rounded bg-[#F1EBDD] px-1.5 py-0.5 text-xs font-medium text-[#48664E]">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
