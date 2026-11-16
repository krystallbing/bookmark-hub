'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  summary: string | null;
  folderPath: string | null;
  faviconUrl: string | null;
  status: string;
  httpStatus: number | null;
  isDuplicate: boolean;
  tags: string[];
  createdAt: string | null;
  importedAt: string;
  updatedAt: string | null;
  lastCheckedAt: string | null;
}

const ui = (locale: 'zh' | 'en', zh: string, en: string) => locale === 'en' ? en : zh;

type FilterType = 'all' | 'untagged' | 'duplicates' | 'broken' | 'missing-summary';

export default function LibraryPage() {
  const { t, locale } = useI18n();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [folders, setFolders] = useState<Array<{ path: string; count: number }>>([]);
  const [tags, setTags] = useState<Array<{ name: string; count: number }>>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 30;

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));

    if (filter === 'duplicates') params.set('isDuplicate', 'true');
    if (filter === 'broken') params.set('status', 'broken');
    if (selectedFolder) params.set('folder', selectedFolder);
    if (selectedTag) params.set('tag', selectedTag);

    const res = await fetch(`/api/bookmarks?${params}`);
    const data = await res.json() as { items?: Bookmark[]; total?: number };

    let items = Array.isArray(data.items) ? data.items : [];
    if (filter === 'untagged') {
      items = items.filter((b: Bookmark) => b.tags.length === 0);
    }
    if (filter === 'missing-summary') {
      items = items.filter((b: Bookmark) => !b.summary);
    }

    setBookmarks(items);
    setTotal(Number(data.total ?? items.length));
    setLoading(false);
  }, [filter, selectedFolder, selectedTag, page]);

  useEffect(() => {
    // Existing app pages hydrate local API state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookmarks();
  }, [fetchBookmarks]);

  useEffect(() => {
    fetch('/api/folders').then((r) => r.json()).then((d) => setFolders(d.folders));
    fetch('/api/tags').then((r) => r.json()).then((d) => setTags(d.tags));
  }, []);

  const selectedBookmark = useMemo(() => {
    if (!detailOpen) return null;
    return bookmarks.find((bookmark) => bookmark.id === selectedId) ?? bookmarks[0] ?? null;
  }, [bookmarks, detailOpen, selectedId]);

  async function copyBookmarkUrl(bookmark: Bookmark) {
    try {
      await navigator.clipboard.writeText(bookmark.url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = bookmark.url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopiedId(bookmark.id);
    window.setTimeout(() => {
      setCopiedId((current) => (current === bookmark.id ? null : current));
    }, 1600);
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: t.library.filters.all },
    { key: 'untagged', label: t.library.filters.untagged },
    { key: 'duplicates', label: t.library.filters.duplicates },
    { key: 'broken', label: t.library.filters.broken },
    { key: 'missing-summary', label: t.library.filters.missingSummary },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#23372B]">{t.library.title}</h1>
          <p className="mt-1 text-xs text-[#59634F]">
          {ui(locale, '点选左侧书签，在右侧快速查看摘要、文件夹、标签和操作入口。', 'Select a bookmark on the left to preview its summary, folder, tags, and actions on the right.')}
        </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-md border border-[#E1D9C9] bg-white px-3 py-1.5 text-xs">
            <span className="text-[#59634F]">{ui(locale, '当前结果', 'Results')}</span>
            <span className="ml-2 font-bold text-[#23372B]">{total}</span>
          </div>
          <div className="rounded-md border border-[#E1D9C9] bg-white px-3 py-1.5 text-xs">
          <span className="text-[#59634F]">{ui(locale, '已显示', 'Shown')}</span>
            <span className="ml-2 font-bold text-[#23372B]">{bookmarks.length}</span>
          </div>
        </div>
      </header>

      <div className="flex gap-4">
        {/* Sidebar */}
        <div className="hidden w-56 shrink-0 md:block">
          <div className="rounded-lg border border-[#E1D9C9] bg-white p-3">
            <h3 className="text-[10px] font-semibold text-[#6F7864] uppercase tracking-wider mb-2">{t.library.sidebar.status}</h3>
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(0); setDetailOpen(true); }}
                className={`block w-full rounded-md px-3 py-1.5 text-left text-xs transition ${
                  filter === f.key ? 'bg-[#EDE6D6] font-bold text-[#59634F]' : 'text-[#26372D] hover:bg-[#eeeeec]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {folders.length > 0 && (
            <div className="mt-3 rounded-lg border border-[#E1D9C9] bg-white p-3">
              <h3 className="text-[10px] font-semibold text-[#6F7864] uppercase tracking-wider mb-2">{t.library.sidebar.folders}</h3>
              <button
                onClick={() => { setSelectedFolder(null); setPage(0); setDetailOpen(true); }}
                className={`block w-full rounded-md px-3 py-1.5 text-left text-xs ${!selectedFolder ? 'bg-[#EDE6D6] font-bold text-[#59634F]' : 'text-[#26372D] hover:bg-[#eeeeec]'}`}
              >
                {t.library.sidebar.allFolders}
              </button>
              {folders.map((f) => (
                <button
                  key={f.path}
                  onClick={() => { setSelectedFolder(f.path); setPage(0); setDetailOpen(true); }}
                  className={`block w-full rounded-md px-3 py-1.5 text-left text-xs truncate ${
                    selectedFolder === f.path ? 'bg-[#EDE6D6] font-bold text-[#59634F]' : 'text-[#26372D] hover:bg-[#eeeeec]'
                  }`}
                  title={f.path}
                >
                  {f.path.split('/').pop()} ({f.count})
                </button>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-3 rounded-lg border border-[#E1D9C9] bg-white p-3">
              <h3 className="text-[10px] font-semibold text-[#6F7864] uppercase tracking-wider mb-2">{t.library.sidebar.tags}</h3>
              <button
                onClick={() => { setSelectedTag(null); setPage(0); setDetailOpen(true); }}
                className={`block w-full rounded-md px-3 py-1.5 text-left text-xs ${!selectedTag ? 'bg-[#EDE6D6] font-bold text-[#59634F]' : 'text-[#26372D] hover:bg-[#eeeeec]'}`}
              >
                {t.library.sidebar.allTags}
              </button>
              {tags.slice(0, 20).map((tg) => (
                <button
                  key={tg.name}
                  onClick={() => { setSelectedTag(tg.name); setPage(0); setDetailOpen(true); }}
                  className={`block w-full rounded-md px-3 py-1.5 text-left text-xs ${
                    selectedTag === tg.name ? 'bg-[#EDE6D6] font-bold text-[#59634F]' : 'text-[#26372D] hover:bg-[#eeeeec]'
                  }`}
                >
                  #{tg.name} ({tg.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-lg border border-[#E1D9C9] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#E1D9C9] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[#23372B]">{ui(locale, '书签列表', 'Bookmark list')}</h2>
                <p className="mt-0.5 text-xs text-[#59634F]">{t.library.bookmarksCount(total)}</p>
              </div>
              {selectedBookmark && (
                <span className="hidden rounded bg-[#F1EBDD] px-2.5 py-0.5 text-xs font-semibold text-[#48664E] sm:inline">
                  {ui(locale, '已选中', 'Selected')}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-10 text-center text-xs text-[#59634F] animate-pulse">{t.common.loading}</div>
            ) : bookmarks.length === 0 ? (
              <div className="grid min-h-[360px] place-items-center p-8 text-center text-muted">
                <div className="text-xs text-[#59634F] space-y-1.5">
                  <p>{t.library.noBookmarks}</p>
                  <p>
                    <Link href="/import" className="font-semibold text-[#48664E]">{t.library.importSome}</Link>
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[#E1D9C9]">
                  {bookmarks.map((b) => {
                    const selected = selectedBookmark?.id === b.id;

                    return (
                      <button
                        key={b.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => { setSelectedId(b.id); setDetailOpen(true); }}
                        className={`block w-full px-4 py-3 text-left transition ${
                          selected ? 'bg-[#EEE9DF]' : 'bg-white hover:bg-[#EEE9DF]/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`truncate text-sm font-semibold ${selected ? 'text-[#48664E]' : 'text-[#23372B]'}`}>
                              {b.title || t.library.untitled}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-[#59634F]">{b.url}</div>
                            {b.summary && <div className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#59634F]">{b.summary}</div>}
                            {b.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {b.tags.slice(0, 4).map((tg) => (
                                  <span key={tg} className="rounded bg-[#F1EBDD] px-1.5 py-0.5 text-[11px] font-medium text-[#48664E]">#{tg}</span>
                                ))}
                                {b.tags.length > 4 && (
                                  <span className="rounded bg-[#EEE9DF] px-1.5 py-0.5 text-[11px] font-medium text-[#59634F]">+{b.tags.length - 4}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {b.folderPath && <span className="block max-w-28 truncate text-xs text-[#59634F]" title={b.folderPath}>{lastFolderName(b.folderPath)}</span>}
                            <div className="mt-2 flex flex-col items-end gap-1">
                              {b.isDuplicate && <span className="rounded bg-[#fffae5] px-1.5 py-0.5 text-[11px] font-semibold text-[#b54708]">{t.library.dup}</span>}
                              {b.status === 'broken' && <span className="rounded bg-[#ffdad6] px-1.5 py-0.5 text-[11px] font-semibold text-[#ba1a1a]">{t.library.broken}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {total > limit && (
                  <div className="flex justify-center gap-2 border-t border-[#E1D9C9] px-4 py-3">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="rounded border border-[#E1D9C9] bg-white px-3 py-1 text-xs font-semibold text-[#26372D] transition hover:bg-[#EEE9DF] disabled:opacity-30"
                    >
                      {t.library.prev}
                    </button>
                    <span className="px-3 py-1 text-xs text-[#59634F]">
                      {t.library.page(page + 1, Math.ceil(total / limit))}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={(page + 1) * limit >= total}
                      className="rounded border border-[#E1D9C9] bg-white px-3 py-1 text-xs font-semibold text-[#26372D] transition hover:bg-[#EEE9DF] disabled:opacity-30"
                    >
                      {t.library.next}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <BookmarkPreviewPanel
            bookmark={selectedBookmark}
            copied={selectedBookmark ? copiedId === selectedBookmark.id : false}
            onClose={() => setDetailOpen(false)}
            onCopy={copyBookmarkUrl}
          />
        </div>
      </div>
    </div>
  );
}

function BookmarkPreviewPanel({
  bookmark,
  copied,
  onClose,
  onCopy,
}: {
  bookmark: Bookmark | null;
  copied: boolean;
  onClose: () => void;
  onCopy: (bookmark: Bookmark) => void;
}) {
  const { locale } = useI18n();
  if (!bookmark) {
    return (
      <aside className="min-w-0">
        <section className="sticky top-[82px] grid min-h-[320px] place-items-center rounded-lg border border-[#E1D9C9] bg-white p-6 text-center">
          <div>
            <h2 className="text-sm font-semibold text-[#23372B]">{ui(locale, '书签详情', 'Bookmark details')}</h2>
            <p className="mt-2 text-xs leading-5 text-[#59634F]">{ui(locale, '选择一条书签后，这里会显示摘要、文件夹、标签和常用操作。', 'Select a bookmark to see its summary, folder, tags, and common actions here.')}</p>
          </div>
        </section>
      </aside>
    );
  }

  const title = bookmark.title || ui(locale, '（无标题）', '(Untitled)');
  const host = hostnameOf(bookmark.url);
  const summary = bookmark.summary || bookmark.description || ui(locale, '还没有摘要。可以进入详情页重新分析网页，补齐摘要后会参与搜索。', 'No summary yet. Open details to reanalyze the page and add it to search.');

  return (
    <aside className="min-w-0">
      <section className="sticky top-[82px] overflow-hidden rounded-lg border border-[#E1D9C9] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#E1D9C9] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[#23372B]">{ui(locale, '书签详情', 'Bookmark details')}</h2>
            <p className="mt-0.5 text-xs text-[#59634F]">{host}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded border border-[#E1D9C9] text-sm leading-none text-[#59634F] hover:bg-[#EEE9DF] hover:text-[#23372B]"
            aria-label={ui(locale, '收起详情', 'Close details')}
            title={ui(locale, '收起详情', 'Close details')}
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded border border-[#E1D9C9] bg-[#F8F7F2] text-xs font-bold text-[#48664E]">
              {bookmark.faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bookmark.faviconUrl} alt="" className="h-6 w-6 object-contain" />
              ) : (
                title.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[#23372B]">{title}</h3>
              <a href={bookmark.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs font-medium text-[#48664E] hover:underline">
                {bookmark.url}
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={bookmark.status} />
            {bookmark.httpStatus && <span className="rounded border border-[#E1D9C9] px-1.5 py-0.5 text-xs text-[#59634F]">HTTP {bookmark.httpStatus}</span>}
            {bookmark.isDuplicate && <span className="rounded bg-[#fffae5] px-1.5 py-0.5 text-xs font-semibold text-[#b54708]">{ui(locale, '已存在', 'Already exists')}</span>}
          </div>

          <PreviewSection label={ui(locale, '摘要', 'Summary')}>
            <p className="line-clamp-4 text-xs leading-5 text-[#59634F]">{summary}</p>
          </PreviewSection>

        <PreviewSection label={ui(locale, '文件夹', 'Folder')}>
            {bookmark.folderPath ? (
              <div className="flex flex-wrap gap-1">
                {bookmark.folderPath.split('/').filter(Boolean).map((part, index, parts) => (
                  <span key={`${part}-${index}`} className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    index === parts.length - 1 ? 'bg-[#F1EBDD] text-[#48664E]' : 'bg-[#EEE9DF] text-[#26372D]'
                  }`}>
                    {part}
                  </span>
                ))}
              </div>
            ) : (
            <span className="text-xs text-[#59634F]">{ui(locale, '未分类，建议生成整理建议后归入明确文件夹。', 'Uncategorized. Generate organize suggestions to place it in a folder.')}</span>
            )}
          </PreviewSection>

          <PreviewSection label={ui(locale, '标签', 'Tags')}>
            {bookmark.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {bookmark.tags.slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded bg-[#f0fff4] px-1.5 py-0.5 text-xs font-semibold text-[#157347]">#{tag}</span>
                ))}
              </div>
            ) : (
            <span className="text-xs text-[#59634F]">{ui(locale, '暂无标签。标签只辅助搜索，不影响文件夹分类。', 'No tags yet. Tags help search and do not change folder placement.')}</span>
            )}
          </PreviewSection>

          <div className="grid grid-cols-2 gap-3 border-t border-[#E1D9C9] pt-4 text-xs">
            <MetaItem label={ui(locale, '收藏时间', 'Saved')} value={formatDate(bookmark.createdAt ?? bookmark.importedAt, locale)} />
            <MetaItem label={ui(locale, '更新时间', 'Updated')} value={formatDate(bookmark.updatedAt, locale)} />
        <MetaItem label={ui(locale, '检测时间', 'Checked')} value={formatDate(bookmark.lastCheckedAt, locale)} />
            <MetaItem label={ui(locale, '来源域名', 'Domain')} value={host} />
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-[#E1D9C9] pt-4">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#294435] px-3 text-xs font-semibold text-white hover:bg-[#1F3228]"
            >
              {ui(locale, '打开网页', 'Open page')}
            </a>
            <Link
              href={`/bookmarks/${bookmark.id}`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#48664E] bg-[#F1EBDD] px-3 text-xs font-semibold text-[#48664E] hover:bg-[#E1D9C9]"
            >
              {ui(locale, '编辑详情', 'Edit details')}
            </Link>
            <button
              type="button"
              onClick={() => onCopy(bookmark)}
              className="col-span-2 inline-flex h-9 items-center justify-center rounded-md border border-[#E1D9C9] bg-white px-3 text-xs font-semibold text-[#26372D] hover:bg-[#EEE9DF]"
            >
              {copied ? ui(locale, '链接已复制', 'Link copied') : ui(locale, '复制链接', 'Copy link')}
            </button>
          </div>
        </div>
      </section>
    </aside>
  );
}

function PreviewSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#E1D9C9] pt-4">
      <h4 className="mb-2 text-[10px] font-semibold text-[#6F7864] uppercase tracking-wider">{label}</h4>
      {children}
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold text-[#6F7864] uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold text-[#23372B]" title={value}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { locale } = useI18n();
  const classes = status === 'ok'
    ? 'bg-[#f0fff4] text-[#157347]'
    : status === 'broken'
      ? 'bg-[#ffdad6] text-[#ba1a1a]'
      : status === 'redirected'
        ? 'bg-[#fffae5] text-[#b54708]'
        : 'bg-[#F1EBDD] text-[#48664E]';

  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${classes}`}>{statusLabel(status, locale)}</span>;
}

function statusLabel(status: string, locale: 'zh' | 'en'): string {
  if (status === 'ok') return ui(locale, '可访问', 'Available');
  if (status === 'broken') return ui(locale, '失效', 'Broken');
  if (status === 'redirected') return ui(locale, '已跳转', 'Redirected');
  if (status === 'unchecked') return ui(locale, '未检测', 'Unchecked');
  return status;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function lastFolderName(folderPath: string): string {
  const parts = folderPath.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? folderPath;
}

function formatDate(value?: string | null, locale: 'zh' | 'en'): string {
  if (!value) return ui(locale, '未记录', 'Not recorded');
  const time = Date.parse(value);
  if (Number.isNaN(time)) return ui(locale, '未记录', 'Not recorded');
  return new Date(time).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
