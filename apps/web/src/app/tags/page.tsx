'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { localizedError, useI18n } from '@/lib/i18n';

interface TagRecord {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
  count: number;
}

interface BookmarkRecord {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  folderPath: string | null;
  status: string;
  isDuplicate: boolean;
  tags: string[];
  importedAt: string;
  updatedAt: string;
}

type SortKey = 'count' | 'name' | 'created';
interface MergeHint {
  sources: string[];
  sourceIds: string[];
  target: string;
  targetId: string;
  reason: string;
  confidence: number;
}

type IconName =
  | 'archive'
  | 'bell'
  | 'book'
  | 'box'
  | 'chevron'
  | 'clock'
  | 'download'
  | 'edit'
  | 'filter'
  | 'folder'
  | 'grid'
  | 'help'
  | 'home'
  | 'link'
  | 'list'
  | 'more'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'spark'
  | 'tag'
  | 'trash'
  | 'warning';

const bookmarkLimit = 10;
const tagDotColors = ['#6d5dfc', '#21b26b', '#85c66a', '#1f78ff', '#f2b91b', '#ef476f', '#14b8a6'];
function text(locale: 'zh' | 'en', zh: string, en: string) { return locale === 'en' ? en : zh; }

export default function TagsPage() {
  const { t, locale } = useI18n();
  const createInputRef = useRef<HTMLInputElement>(null);

  const [tags, setTags] = useState<TagRecord[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [totalBookmarks, setTotalBookmarks] = useState(0);
  const [bookmarkPage, setBookmarkPage] = useState(0);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(new Set());
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [bookmarkQuery, setBookmarkQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [newTagName, setNewTagName] = useState('');
  const [bulkAddName, setBulkAddName] = useState('');
  const [mergeHints, setMergeHints] = useState<MergeHint[]>([]);
  const [auditingTags, setAuditingTags] = useState(false);
  const [tagAuditRan, setTagAuditRan] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const selectedTag = useMemo(
    () => tags.find((tag) => tag.id === selectedTagId) ?? null,
    [tags, selectedTagId]
  );

  const commonTags = useMemo(
    () => [...tags].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN')).slice(0, 6),
    [tags]
  );

  const filteredTags = useMemo(() => {
    const normalizedQuery = tagQuery.trim().toLowerCase();
    const items = normalizedQuery
      ? tags.filter((tag) => `${tag.name} ${tag.normalizedName}`.toLowerCase().includes(normalizedQuery))
      : tags;

    return [...items].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN');
      if (sortKey === 'created') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }, [sortKey, tagQuery, tags]);

  const visibleBookmarks = useMemo(() => {
    const query = bookmarkQuery.trim().toLowerCase();
    if (!query) return bookmarks;

    return bookmarks.filter((bookmark) => {
      const text = [
        bookmark.title,
        bookmark.url,
        bookmark.summary,
        bookmark.folderPath,
        ...bookmark.tags,
      ].filter(Boolean).join(' ').toLowerCase();

      return text.includes(query);
    });
  }, [bookmarkQuery, bookmarks]);

  const selectedBookmarkCount = selectedBookmarkIds.size;
  const allVisibleSelected = visibleBookmarks.length > 0 && visibleBookmarks.every((bookmark) => selectedBookmarkIds.has(bookmark.id));
  const totalPages = Math.max(1, Math.ceil(totalBookmarks / bookmarkLimit));
  const activeTagIndex = Math.max(0, tags.findIndex((tag) => tag.id === selectedTagId));

  const showError = useCallback((message: string) => {
    setError(message);
    setNotice('');
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setError('');
  }, []);

  const loadTags = useCallback(async (preferredTagId?: string | null) => {
    setLoadingTags(true);
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      const nextTags: TagRecord[] = data.tags ?? [];
      setTags(nextTags);

      setSelectedTagId((current) => {
        const preferred = preferredTagId ?? current;
        if (preferred && nextTags.some((tag) => tag.id === preferred)) return preferred;
        return nextTags[0]?.id ?? null;
      });
    } catch {
      showError(text(locale, '标签列表加载失败。', 'Failed to load tags.'));
    } finally {
      setLoadingTags(false);
    }
  }, [showError]);

  const loadBookmarks = useCallback(async (tag: TagRecord | null, page: number) => {
    if (!tag) {
      setBookmarks([]);
      setTotalBookmarks(0);
      setSelectedBookmarkIds(new Set());
      return;
    }

    setLoadingBookmarks(true);
    try {
      const params = new URLSearchParams({
        tag: tag.normalizedName,
        limit: String(bookmarkLimit),
        offset: String(page * bookmarkLimit),
      });
      const res = await fetch(`/api/bookmarks?${params}`);
      const data = await res.json();
      setBookmarks(data.items ?? []);
      setTotalBookmarks(data.total ?? 0);
      setSelectedBookmarkIds(new Set());
    } catch {
      showError(text(locale, '书签列表加载失败。', 'Failed to load bookmarks.'));
    } finally {
      setLoadingBookmarks(false);
    }
  }, [showError]);

  useEffect(() => {
    // Existing app pages hydrate local API state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    // This resets local detail-panel state when the selected tag changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookmarkPage(0);
    setBookmarkQuery('');
  }, [selectedTagId]);

  useEffect(() => {
    // Existing app pages hydrate local API state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBookmarks(selectedTag, bookmarkPage);
  }, [bookmarkPage, loadBookmarks, selectedTag]);

  async function requestJSON(url: string, options: RequestInit) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(localizedError(locale, data.error, text(locale, '操作失败。', 'Operation failed.')));
    }
    return data;
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return showError(text(locale, '请输入标签名称。', 'Enter a tag name.'));

    setSaving(true);
    try {
      const data = await requestJSON('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setNewTagName('');
      showNotice(text(locale, '标签已创建。', 'Tag created.'));
      await loadTags(data.tag?.id);
    } catch (err) {
      showError(err instanceof Error ? err.message : text(locale, '创建标签失败。', 'Failed to create tag.'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTag() {
    if (!selectedTag) return;
    const confirmed = window.confirm(t.tagsPage.deleteConfirm(selectedTag.name));
    if (!confirmed) return;

    setSaving(true);
    try {
      await requestJSON(`/api/tags/${selectedTag.id}`, { method: 'DELETE' });
      showNotice(text(locale, '标签已删除，书签保留。', 'Tag deleted; bookmarks were kept.'));
      await loadTags(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : text(locale, '删除失败。', 'Failed to delete tag.'));
    } finally {
      setSaving(false);
    }
  }

  async function applyMergeHint(hint: MergeHint) {
    if (hint.sourceIds.length === 0) return;
    const confirmed = window.confirm(text(locale, `合并 ${hint.sources.join('、')} 到「${hint.target}」？`, `Merge ${hint.sources.join(', ')} into “${hint.target}”?`));
    if (!confirmed) return;

    setSaving(true);
    try {
      const data = await requestJSON('/api/tags/merge', {
        method: 'POST',
        body: JSON.stringify({
          sourceTagIds: hint.sourceIds,
          targetTagId: hint.targetId,
        }),
      });
      showNotice(text(locale, `已合并到「${data.target?.name ?? hint.target}」。`, `Merged into “${data.target?.name ?? hint.target}”.`));
      setMergeHints((current) => current.filter((item) => item !== hint));
      await loadTags(data.target?.id ?? hint.targetId);
    } catch (err) {
      showError(err instanceof Error ? err.message : text(locale, '合并失败。', 'Failed to merge tags.'));
    } finally {
      setSaving(false);
    }
  }

  async function runTagAudit() {
    setAuditingTags(true);
    setTagAuditRan(false);
    setMergeHints([]);
    setNotice('');
    setError('');

    try {
      const data = await requestJSON('/api/tags/audit', { method: 'POST' });
      setMergeHints(Array.isArray(data.suggestions) ? data.suggestions : []);
      setTagAuditRan(true);
      const count = Number(data.suggestions?.length ?? 0);
      showNotice(count > 0 ? text(locale, `AI 生成 ${count} 条标签合并建议。`, `AI generated ${count} tag merge suggestions.`) : text(locale, 'AI 审核完成，当前没有明确需要合并的标签。', 'AI audit complete; no clear merges found.'));
    } catch (err) {
      showError(err instanceof Error ? err.message : text(locale, 'AI 标签审核失败。', 'AI tag audit failed.'));
    } finally {
      setAuditingTags(false);
    }
  }

  async function applyBulkTags(type: 'add' | 'remove-current') {
    if (!selectedTag || selectedBookmarkCount === 0) return;
    const bookmarkIds = Array.from(selectedBookmarkIds);

    if (type === 'add' && !bulkAddName.trim()) {
      return showError(text(locale, '请输入要添加的标签。', 'Enter a tag to add.'));
    }

    const payload = type === 'add'
      ? { bookmarkIds, addTags: [bulkAddName.trim()] }
      : { bookmarkIds, removeTagIds: [selectedTag.id] };

    setSaving(true);
    try {
      await requestJSON('/api/bookmarks/bulk-tags', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (type === 'add') setBulkAddName('');
      showNotice(type === 'add' ? text(locale, '已为选中书签添加标签。', 'Tag added to selected bookmarks.') : text(locale, '已从选中书签移除当前标签。', 'Current tag removed from selected bookmarks.'));
      await loadTags(selectedTag.id);
      await loadBookmarks(selectedTag, bookmarkPage);
    } catch (err) {
      showError(err instanceof Error ? err.message : text(locale, '批量操作失败。', 'Batch update failed.'));
    } finally {
      setSaving(false);
    }
  }

  function focusCreateInput() {
    createInputRef.current?.focus();
  }

  function toggleBookmark(id: string) {
    setSelectedBookmarkIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedBookmarkIds((current) => {
      if (allVisibleSelected) return new Set();
      const next = new Set(current);
      for (const bookmark of visibleBookmarks) next.add(bookmark.id);
      return next;
    });
  }

  return (
    <>
          <section className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#23372B]">{t.tagsPage.title}</h1>
              <p className="mt-1 text-xs text-[#59634F]">{t.tagsPage.desc}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={focusCreateInput}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#294435] px-4 text-xs font-semibold text-white transition hover:bg-[#1F3228]"
              >
                <AdminIcon name="plus" className="text-[14px]" />
                {text(locale, '新建标签', 'New tag')}
              </button>
            </div>
          </section>

          <div className="mb-4 rounded-lg border border-[#E1D9C9] bg-white px-4 py-2.5 text-xs text-[#59634F]">
            {text(locale, '批量修正、相似标签合并和书签关联都集中在本页处理；标签不是主分类，文件夹仍是主要归档结构。', 'Manage batch edits, similar tag merges, and bookmark associations here. Folders remain the main organizing structure.')}
          </div>

          {(notice || error) && (
            <div className={`mb-4 rounded-md border px-4 py-2 text-xs ${
              error
                ? 'border-[#ba1a1a]/20 bg-[#ffdad6] text-[#ba1a1a]'
                : 'border-[#157347]/20 bg-[#f0fff4] text-[#157347]'
            }`}>
              {error || notice}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)_344px]">
            <aside className="rounded-lg border border-[#E1D9C9] bg-white">
              <div className="border-b border-[#E1D9C9] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider">{t.tagsPage.sidebarTitle}</h2>
                  <button onClick={() => loadTags(selectedTagId)} className="grid h-7 w-7 place-items-center rounded border border-[#E1D9C9] text-[#59634F] hover:bg-[#EEE9DF]" title={locale === 'en' ? 'Refresh' : '刷新'}>
                    <AdminIcon name="refresh" className={`text-[14px] ${loadingTags ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <label className="mt-4 flex h-8 items-center gap-2 rounded border border-[#E1D9C9] bg-[#F8F7F2] px-3">
                  <AdminIcon name="search" className="text-[14px] text-[#59634F]" />
                  <input
                    value={tagQuery}
                    onChange={(event) => setTagQuery(event.target.value)}
                    placeholder={t.tagsPage.placeholder}
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#baac9a]"
                  />
                </label>

                <div className="mt-3 flex gap-2">
                  <select
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value as SortKey)}
                    className="h-8 min-w-0 flex-1 rounded border border-[#E1D9C9] bg-[#F8F7F2] px-2.5 text-xs text-[#26372D] outline-none"
                  >
                    <option value="count">{locale === 'en' ? 'Sort by usage' : '按使用次数排序'}</option>
                    <option value="name">{locale === 'en' ? 'Sort by name' : '按名称排序'}</option>
                    <option value="created">{locale === 'en' ? 'Sort by creation date' : '按创建时间排序'}</option>
                  </select>
                </div>
              </div>

              <div className="p-4">
                <SectionTitle label={t.tagsPage.metrics.common} />
                <div className="mt-3 space-y-1">
                  {commonTags.length === 0 ? (
                    <EmptyLine text={t.tagsPage.noTags} />
                  ) : (
                    commonTags.map((tag, index) => (
                      <TagListButton
                        key={tag.id}
                        tag={tag}
                        active={tag.id === selectedTagId}
                        color={tagDotColors[index % tagDotColors.length]}
                        onClick={() => setSelectedTagId(tag.id)}
                      />
                    ))
                  )}
                </div>

                <div className="my-4 h-px bg-[#E1D9C9]" />

                <div className="flex items-center justify-between">
                  <SectionTitle label={`${t.tagsPage.allTagsCount} (${tags.length})`} />
                  <button onClick={focusCreateInput} className="grid h-7 w-7 place-items-center rounded border border-[#E1D9C9] text-[#59634F] hover:border-[#48664E] hover:text-[#48664E]">
                    <AdminIcon name="plus" className="text-[14px]" />
                  </button>
                </div>
                <div className="mt-3 max-h-[176px] space-y-1 overflow-auto pr-1">
                  {filteredTags.length === 0 ? (
                    <EmptyLine text={t.tagsPage.noTags} />
                  ) : (
                    filteredTags.map((tag, index) => (
                      <TagListButton
                        key={tag.id}
                        tag={tag}
                        active={tag.id === selectedTagId}
                        color={tagDotColors[index % tagDotColors.length]}
                        onClick={() => setSelectedTagId(tag.id)}
                        compact
                      />
                    ))
                  )}
                </div>

                <div className="mt-4 border-t border-[#E1D9C9] pt-4">
                  <SectionTitle label={t.tagsPage.addTagBtn} />
                  <div className="mt-2 flex gap-2">
                    <input
                      ref={createInputRef}
                      value={newTagName}
                      onChange={(event) => setNewTagName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') createTag();
                      }}
                      placeholder={t.tagsPage.addPlaceholder}
                      className="h-8 min-w-0 flex-1 rounded border border-[#E1D9C9] bg-[#F8F7F2] px-2.5 text-xs outline-none focus:border-[#48664E]"
                    />
                    <button
                      onClick={createTag}
                      disabled={saving || !newTagName.trim()}
                      className="h-8 rounded-md bg-[#294435] px-3 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      {text(locale, '添加', 'Add')}
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            <section className="min-w-0 rounded-lg border border-[#E1D9C9] bg-white">
              {selectedTag ? (
                <>
                  <div className="border-b border-[#E1D9C9] p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${tagDotColors[activeTagIndex % tagDotColors.length]}, #9b8cff)` }}
                        >
                          {selectedTag.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-bold text-[#23372B]">{selectedTag.name}</h2>
                            <span className="rounded bg-[#F1EBDD] px-2 py-0.5 text-xs font-semibold text-[#48664E]">{locale === 'en' ? 'Local tag' : '本地标签'}</span>
                          </div>
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#59634F]">
                            {text(locale, '当前标签关联的书签、文件夹和 AI 建议会集中在这里治理。可以重命名、合并到高频标签，也可以批量把误打标签从书签上移除。', 'Manage bookmarks, folders, and AI suggestions for this tag here. Rename it, merge it into a common tag, or remove incorrect tags in batches.')}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={deleteTag}
                          disabled={saving}
                          className="inline-flex h-8 min-w-[70px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[#ffd2d2] bg-[#fff8f8] px-3 text-xs font-semibold text-[#ba1a1a] transition hover:bg-[#ffdad6] disabled:opacity-40"
                        >
                          <AdminIcon name="trash" className="text-[14px]" />
                          {text(locale, '删除', 'Delete')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <Metric label={t.tagsPage.metrics.count} value={selectedTag.count} />
                      <Metric label={t.tagsPage.metrics.usage} value={selectedTag.count} />
                      <Metric label={t.tagsPage.metrics.folders} value={countFolders(bookmarks)} />
                      <Metric label={t.tagsPage.metrics.created} value={formatDate(selectedTag.createdAt)} />
                      <Metric label={t.tagsPage.metrics.location} value={selectedTag.count <= 1 ? t.tagsPage.metrics.helper : t.tagsPage.metrics.common} />
                    </div>

                  </div>

                  <div className="border-b border-[#E1D9C9] px-5">
                    <div className="flex gap-6 overflow-x-auto">
                      <span className="border-b-2 border-[#48664E] py-3.5 text-xs font-semibold text-[#48664E]">
                        {text(locale, `标签下书签 (${totalBookmarks})`, `Bookmarks (${totalBookmarks})`)}
                      </span>
                      <span className="py-3.5 text-xs font-semibold text-[#59634F]">{text(locale, `相关文件夹 ${countFolders(bookmarks)}`, `Related folders ${countFolders(bookmarks)}`)}</span>
                      <span className="py-3.5 text-xs font-semibold text-[#59634F]">{t.tagsPage.similarTagsNotice}</span>
                    </div>
                  </div>

                  <div className="border-b border-[#E1D9C9] p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded border border-[#E1D9C9] bg-[#F8F7F2] px-3">
                        <AdminIcon name="search" className="text-[14px] text-[#59634F]" />
                        <input
                          value={bookmarkQuery}
                          onChange={(event) => setBookmarkQuery(event.target.value)}
                          placeholder={locale === 'en' ? 'Search bookmarks in this tag...' : '搜索当前标签下的书签...'}
                          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#baac9a]"
                        />
                      </label>

                      <div className="text-xs text-[#59634F]">{text(locale, `当前标签下共 ${totalBookmarks} 条书签`, `${totalBookmarks} bookmarks under this tag`)}</div>
                    </div>

                    {selectedBookmarkCount > 0 && (
                      <div className="mt-3 flex flex-col gap-3 rounded border border-[#E1D9C9] bg-[#F8F7F2] px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-2 text-xs text-[#26372D]">
                          <input type="checkbox" checked readOnly className="h-3.5 w-3.5 accent-[#48664E] rounded" />
                          <span>{t.tagsPage.selectedCount(selectedBookmarkCount)}</span>
                          <button onClick={() => setSelectedBookmarkIds(new Set())} className="font-semibold text-[#48664E] hover:underline">{t.tagsPage.clearSelection}</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => applyBulkTags('remove-current')}
                            disabled={saving}
                            className="inline-flex h-7 items-center gap-1 rounded border border-[#E1D9C9] bg-white px-2.5 text-xs font-medium text-[#26372D] transition hover:bg-[#EEE9DF] disabled:opacity-40"
                          >
                            <AdminIcon name="trash" className="text-[14px]" />
                            {text(locale, '移除标签', 'Remove tag')}
                          </button>
                          <label className="flex h-7 items-center gap-1.5 rounded border border-[#E1D9C9] bg-white px-2.5">
                            <AdminIcon name="tag" className="text-[14px] text-[#59634F]" />
                            <input
                              value={bulkAddName}
                              onChange={(event) => setBulkAddName(event.target.value)}
                              placeholder={t.tagsPage.batchPlaceholder}
                              className="w-20 bg-transparent text-xs outline-none"
                            />
                          </label>
                          <button
                            onClick={() => applyBulkTags('add')}
                            disabled={saving || !bulkAddName.trim()}
                            className="inline-flex h-7 items-center gap-1 rounded border border-[#E1D9C9] bg-white px-2.5 text-xs font-medium text-[#26372D] transition hover:bg-[#EEE9DF] disabled:opacity-40"
                          >
                            {text(locale, '添加', 'Add')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto px-5 pt-3">
                    {loadingBookmarks ? (
                      <div className="py-16 text-center text-xs text-[#59634F]">{t.tagsPage.loading}</div>
                    ) : visibleBookmarks.length === 0 ? (
                      <div className="py-16 text-center text-xs text-[#59634F]">{t.tagsPage.noBookmarksUnderTag}</div>
                    ) : (
                      <table className="w-full min-w-[760px] text-xs">
                        <thead className="text-xs font-semibold text-[#59634F]">
                          <tr className="border-b border-[#E1D9C9]">
                            <th className="w-9 py-3 text-left">
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleAllVisible}
                                className="h-3.5 w-3.5 accent-[#48664E] rounded"
                              />
                            </th>
                            <th className="px-2 py-3 text-left">{t.tagsPage.table.info}</th>
                            <th className="w-44 px-2 py-3 text-left">URL</th>
                            <th className="w-28 px-2 py-3 text-left">{t.tagsPage.table.imported}</th>
                            <th className="w-24 px-2 py-3 text-left">{t.detail.tags}</th>
                            <th className="w-36 px-2 py-3 text-left">{t.tagsPage.table.action}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E1D9C9]">
                          {visibleBookmarks.map((bookmark, index) => (
                            <tr key={bookmark.id} className="hover:bg-[#EEE9DF]/30">
                              <td className="py-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedBookmarkIds.has(bookmark.id)}
                                  onChange={() => toggleBookmark(bookmark.id)}
                                  className="h-3.5 w-3.5 accent-[#48664E] rounded"
                                  aria-label={text(locale, `选择 ${bookmark.title ?? bookmark.url}`, `Select ${bookmark.title ?? bookmark.url}`)}
                                />
                              </td>
                              <td className="min-w-0 px-2 py-3">
                                <div className="flex min-w-0 items-start gap-3">
                                  <BookmarkAvatar index={index} title={bookmark.title ?? bookmark.url} />
                                  <div className="min-w-0">
                                    <Link href={`/bookmarks/${bookmark.id}`} className="block truncate font-semibold text-[#23372B] hover:text-[#48664E] transition-colors">
                                      {bookmark.title || t.tagsPage.table.untitled}
                                    </Link>
                                    {bookmark.summary && (
                                      <div className="mt-0.5 line-clamp-1 text-xs text-[#59634F]">{bookmark.summary}</div>
                                    )}
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {bookmark.tags.slice(0, 3).map((tag) => (
                                        <span key={tag} className="rounded bg-[#F1EBDD] px-1.5 py-0.5 text-xs font-medium text-[#48664E]">

                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-3 align-top text-xs text-[#475467]">
                                <a href={bookmark.url} target="_blank" rel="noreferrer" className="block max-w-40 truncate hover:text-[#48664E]">
                                  {hostname(bookmark.url)}
                                </a>
                              </td>
                              <td className="px-2 py-3 align-top text-xs text-[#475467]">
                                <div>{formatDate(bookmark.importedAt)}</div>
                                <div className="mt-1 text-[#98a2b3]">{relativeDays(bookmark.importedAt, locale)}</div>
                              </td>
                              <td className="px-2 py-3 align-top">
                                <span className="font-semibold text-[#101828]">{bookmark.tags.length}</span>
                              </td>
                              <td className="px-2 py-3 align-top">
                                <div className="flex items-center gap-2 text-[#475467]">
                                  <Link href={`/bookmarks/${bookmark.id}`} className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#F1EBDD] hover:text-[#48664E]" title={t.tagsPage.table.edit}>
                                    <AdminIcon name="edit" className="h-4 w-4" />
                                  </Link>
                                  <a href={bookmark.url} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#F1EBDD] hover:text-[#48664E]" title={t.tagsPage.table.open}>
                                    <AdminIcon name="link" className="h-4 w-4" />
                                  </a>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[#EEE9DF] px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-[#667085]">{text(locale, `共 ${totalBookmarks} 条`, `${totalBookmarks} total`)}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBookmarkPage((page) => Math.max(0, page - 1))}
                        disabled={bookmarkPage === 0}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-[#E1D9C9] text-[#667085] disabled:opacity-40"
                      >
                        <AdminIcon name="chevron" className="h-4 w-4 rotate-90" />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setBookmarkPage(i)}
                          className={`h-8 min-w-8 rounded-lg border px-3 text-sm font-medium ${
                            bookmarkPage === i
                              ? 'border-[#48664E] bg-[#F1EBDD] text-[#48664E]'
                              : 'border-[#E1D9C9] text-[#475467]'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      {totalPages > 4 && <span className="px-1 text-[#667085]">...</span>}
                      {totalPages > 4 && (
                        <button
                          onClick={() => setBookmarkPage(totalPages - 1)}
                          className="h-8 min-w-8 rounded-lg border border-[#E1D9C9] px-3 text-sm font-medium text-[#475467]"
                        >
                          {totalPages}
                        </button>
                      )}
                      <button
                        onClick={() => setBookmarkPage((page) => Math.min(totalPages - 1, page + 1))}
                        disabled={bookmarkPage + 1 >= totalPages}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-[#E1D9C9] text-[#667085] disabled:opacity-40"
                      >
                        <AdminIcon name="chevron" className="h-4 w-4 -rotate-90" />
                      </button>
                    </div>
                    <div className="text-xs text-[#667085]">{text(locale, `每页 ${bookmarkLimit} 条`, `${bookmarkLimit} per page`)}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 border-t border-[#EEE9DF] px-5 py-3 text-xs text-[#475467]">
                    <button
                      onClick={() => applyBulkTags('remove-current')}
                      disabled={selectedBookmarkCount === 0 || saving}
                      className="inline-flex items-center gap-2 disabled:opacity-40"
                    >
                      <AdminIcon name="tag" className="h-4 w-4" />
                      {text(locale, '移除当前标签', 'Remove current tag')}
                    </button>
                    <span className="inline-flex items-center gap-2">
                      <AdminIcon name="edit" className="h-4 w-4" />
                      {text(locale, '单条纠错请进入详情页修改标题、URL、摘要和备注', 'Open the bookmark details to edit its title, URL, summary, or notes.')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-b border-[#EEE9DF] p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#F1EBDD] text-[#48664E]">
                          <AdminIcon name="tag" className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[#101828]">{t.tagsPage.emptyTitle}</h2>
                          <p className="mt-2 text-sm leading-6 text-[#475467]">{t.tagsPage.emptyDesc}</p>
                        </div>
                      </div>
                      <button onClick={focusCreateInput} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#294435] px-3 text-sm font-semibold text-white">
                        <AdminIcon name="plus" className="h-4 w-4" />
                        {text(locale, '新建标签', 'New tag')}
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <Metric label={t.tagsPage.metrics.count} value="-" />
                      <Metric label={t.tagsPage.metrics.usage} value="-" />
                      <Metric label={t.tagsPage.metrics.folders} value="-" />
                      <Metric label={t.tagsPage.metrics.created} value="-" />
                      <Metric label={text(locale, '来源', 'Source')} value="-" />
                    </div>
                  </div>

                  <div className="p-8 text-center text-sm text-[#667085]">
                    {text(locale, '创建标签后，关联书签、合并目标和批量操作会显示在这里。', 'Create a tag to see its bookmarks, merge targets, and batch actions here.')}
                  </div>
                </>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-lg border border-[#E1D9C9] bg-white">
                <div className="flex items-center justify-between border-b border-[#E1D9C9] p-4">
                  <div className="flex items-center gap-2">
                    <AdminIcon name="spark" className="text-base text-[#48664E]" />
                    <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider">{t.tagsPage.auditTitle}</h2>
                  </div>
                  <span className="rounded bg-[#F1EBDD] px-2 py-0.5 text-xs font-semibold text-[#48664E]">
                    {mergeHints.length}
                  </span>
                </div>

                <div className="p-4">
                  <div className="rounded-lg border border-[#E1D9C9] bg-[#F8F7F2] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-bold text-[#48664E]">{t.tagsPage.auditSubtitle}</h3>
                        <p className="mt-1 text-[11px] leading-5 text-[#59634F]">{t.tagsPage.auditDesc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={runTagAudit}
                        disabled={auditingTags || tags.length < 2}
                        className="shrink-0 rounded-md bg-[#294435] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#1F3228] disabled:opacity-50"
                      >
                        {auditingTags ? text(locale, '审核中...', 'Auditing...') : text(locale, 'AI 审核', 'AI Audit')}
                      </button>
                    </div>

                    <div className="mt-4 max-h-[420px] space-y-4 overflow-auto pr-1">
                      {mergeHints.length === 0 ? (
                        <EmptyLine text={tagAuditRan ? text(locale, 'AI 审核完成，当前没有明确相似标签。', 'Audit complete; no clearly similar tags found.') : text(locale, '点击“AI 审核”生成全库标签合并建议。', 'Run AI Audit to generate merge suggestions for all tags.')} />
                      ) : (
                        mergeHints.map((hint) => (
                          <div key={`${hint.sources.join('-')}-${hint.target}`} className="rounded-md border border-[#E1D9C9] bg-white p-3">
                            <div className="grid grid-cols-[minmax(0,1fr)_32px_88px] items-center gap-2">
                              <div className="flex min-w-0 flex-wrap gap-1 rounded bg-[#EEE9DF] p-2">
                                {hint.sources.map((source) => (
                                  <span key={source} className="rounded bg-[#F1EBDD] px-1.5 py-0.5 text-xs font-medium text-[#48664E]">{source}</span>
                                ))}
                              </div>
                              <div className="text-center text-[#48664E]">-&gt;</div>
                              <div className="text-xs text-[#59634F]">
                                <div>{text(locale, '合并到', 'Merge into')}</div>
                                <div className="mt-1 font-bold text-[#48664E]">{hint.target}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-[#59634F]">
                              {hint.reason} · {text(locale, '置信度', 'confidence')} {Math.round(hint.confidence * 100)}%
                            </div>
                            <button
                              onClick={() => applyMergeHint(hint)}
                              disabled={saving}
                              className="mt-3 inline-flex h-8 items-center justify-center rounded bg-[#294435] px-3 text-xs font-semibold text-white transition hover:bg-[#1F3228] disabled:opacity-50"
                            >
                              {text(locale, '合并', 'Merge')}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#fffae5] bg-[#fffae5] p-4 text-xs text-[#b54708]">
                <h3 className="font-bold text-[#b54708]">{text(locale, '标签质量原则', 'Tag quality guidelines')}</h3>
                <p className="mt-2 leading-5">
                  {text(locale, `当前全库共有 ${tags.length} 个标签。优先复用已有标签；确实有新主题时再新增，近义标签尽量合并。`, `${tags.length} tags in this library. Reuse existing tags where possible, add new ones for distinct topics, and merge near-duplicates.`)}
                </p>
                <p className="mt-2 leading-5">{text(locale, '标签页只负责管理标签；重新分析网页内容请进入单条书签详情页。', 'Manage tags here. Open a bookmark’s details to reanalyze its page content.')}</p>
              </div>

              <div className="rounded-lg border border-[#E1D9C9] bg-white p-4">
                <h3 className="text-xs font-bold text-[#23372B] uppercase tracking-wider">{t.tagsPage.batchEdit}</h3>
                <div className="mt-3 space-y-3">
                  <BulkAction
                    icon="trash"
                    title={text(locale, '移除选中书签的当前标签', 'Remove current tag from selected bookmarks')}
                    desc={t.tagsPage.selectedCount(selectedBookmarkCount)}
                    danger
                    disabled={selectedBookmarkCount === 0 || saving}
                    onClick={() => applyBulkTags('remove-current')}
                  />
                  <div className="rounded-md border border-[#E1D9C9] bg-[#F8F7F2] p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      <AdminIcon name="tag" className="text-[16px] text-[#48664E]" />
                      <span className="text-xs font-semibold text-[#48664E]">{text(locale, '为选中书签添加标签', 'Add a tag to selected bookmarks')}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={bulkAddName}
                        onChange={(event) => setBulkAddName(event.target.value)}
                        placeholder={t.detail.tags}
                        className="h-8 min-w-0 flex-1 rounded border border-[#E1D9C9] bg-white px-2.5 text-xs outline-none focus:border-[#48664E]"
                      />
                      <button
                        onClick={() => applyBulkTags('add')}
                        disabled={selectedBookmarkCount === 0 || saving || !bulkAddName.trim()}
                        className="rounded-md bg-[#294435] px-3 text-xs font-semibold text-white transition hover:bg-[#1F3228] disabled:opacity-40"
                      >
                        {text(locale, '添加', 'Add')}
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-[#59634F]">{t.tagsPage.selectedCount(selectedBookmarkCount)}</p>
                  </div>
                </div>

              </div>
            </aside>
          </div>
    </>
  );
}

function SectionTitle({ label, danger = false }: { label: string; danger?: boolean }) {
  return (
    <div className={`text-[10px] font-semibold uppercase tracking-wider ${danger ? 'text-[#ba1a1a]' : 'text-[#6F7864]'}`}>
      {label}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md bg-[#EEE9DF] px-3 py-2 text-xs text-[#59634F]">{text}</div>;
}

function TagListButton({
  tag,
  active,
  color,
  compact = false,
  onClick,
}: {
  tag: TagRecord;
  active: boolean;
  color: string;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 text-xs transition ${
        compact ? 'py-1.5' : 'py-2'
      } ${
        active ? 'bg-[#EDE6D6] text-[#59634F] font-bold' : 'text-[#26372D] hover:bg-[#eeeeec]'
      }`}
      title={tag.name}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate font-medium">{tag.name}</span>
      </span>
      <span className={active ? 'font-bold text-[#59634F]' : 'text-[#59634F]'}>{tag.count}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-r border-[#E1D9C9] last:border-r-0">
      <div className="text-base font-bold text-[#23372B]">{value}</div>
      <div className="mt-0.5 text-xs text-[#59634F]">{label}</div>
    </div>
  );
}

function BulkAction({
  icon,
  title,
  desc,
  danger = false,
  disabled = false,
  onClick,
}: {
  icon: IconName;
  title: string;
  desc: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-lg border border-[#E1D9C9] bg-white p-3 text-left disabled:opacity-55 hover:bg-[#EEE9DF]/40 transition"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded ${
          danger ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#F1EBDD] text-[#48664E]'
        }`}>
          <AdminIcon name={icon} className="text-[16px]" />
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-xs font-semibold ${danger ? 'text-[#ba1a1a]' : 'text-[#48664E]'}`}>{title}</span>
          <span className="mt-0.5 block text-[11px] text-[#59634F]">{desc}</span>
        </span>
      </span>
      <AdminIcon name="chevron" className="-rotate-90 text-[16px] shrink-0 text-[#59634F]" />
    </button>
  );
}

function BookmarkAvatar({ index, title }: { index: number; title: string }) {
  const colors = ['#111827', '#e69b66', '#6d5dfc', '#a7c957', '#fbbf24', '#14b8a6'];
  const letter = title.trim().slice(0, 1).toUpperCase() || 'S';

  return (
    <div
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-sm font-bold text-white"
      style={{ backgroundColor: colors[index % colors.length] }}
    >
      {letter}
    </div>
  );
}

function AdminIcon({ name, className = '' }: { name: IconName; className?: string }) {
  const iconMap: Record<IconName, string> = {
    archive: 'archive',
    bell: 'notifications',
    book: 'book',
    box: 'package_2',
    chevron: 'expand_more',
    clock: 'schedule',
    download: 'download',
    edit: 'edit',
    filter: 'filter_alt',
    folder: 'folder',
    grid: 'grid_view',
    help: 'help_outline',
    home: 'home',
    link: 'link',
    list: 'format_list_bulleted',
    more: 'more_horiz',
    plus: 'add',
    refresh: 'refresh',
    search: 'search',
    settings: 'settings',
    spark: 'auto_awesome',
    tag: 'label',
    trash: 'delete',
    warning: 'warning_amber',
  };

  const iconName = iconMap[name] || 'bookmark';

  return (
    <span className={`material-symbols-outlined shrink-0 flex items-center justify-center ${className}`} style={{ fontSize: 'inherit' }}>
      {iconName}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replace(/\//g, '-');
}

function relativeDays(value: string | null | undefined, locale: 'zh' | 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return text(locale, '今天', 'Today');
  return text(locale, `${days} 天前`, `${days} days ago`);
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function countFolders(bookmarks: BookmarkRecord[]) {
  return new Set(bookmarks.map((bookmark) => bookmark.folderPath).filter(Boolean)).size;
}
