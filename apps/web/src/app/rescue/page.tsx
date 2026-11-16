'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { localizedError, useI18n } from '@/lib/i18n';

interface Suggestion {
  id: string;
  type: string;
  status: string;
  bookmarkId: string | null;
  beforeJson: string;
  afterJson: string;
  reason: string | null;
  confidence: number | null;
  bookmark: { title: string | null; url: string } | null;
}

interface ChromeSyncNotice {
  count: number;
  ops: ChromeSyncOp[];
}

interface ChromeSyncOp {
  id: string;
  action: 'update' | 'remove' | 'move' | 'create';
  chromeId?: string;
  bookmarkId?: string;
  bookmarkTitle?: string | null;
  bookmarkUrl?: string;
  title?: string;
  url?: string;
  folderPath?: string;
}

interface RescueRunResult {
  suggestionsCount: number;
  duplicates: number;
  broken: number;
  renames: number;
  tags: number;
  folders: number;
  aiPowered: boolean;
  analysis?: {
    processed: number;
    fetched: number;
    summaries: number;
    tags: number;
    embeddings: number;
    linkFailures: number;
    errors: number;
    firstError: string | null;
  };
  folderPolicy?: {
    folderDepth: 1 | 2;
    topLevelFolderLimit: number;
    topLevelFolderCount: number;
    projectedTopLevelFolderCount: number;
    limitReached: boolean;
    willReachLimit: boolean;
    message: string | null;
  };
}

const typeLabels: Record<string, string> = {
  rename: '标题修复',
  tag: '标签修改',
  move: '分类建议',
  delete_broken: '坏链处理',
  merge_folder: '文件夹合并',
  normalize_tag: '标签规范化',
};

const ui = (locale: 'zh' | 'en', zh: string, en: string) => locale === 'en' ? en : zh;
const typeLabelsEn: Record<string, string> = {
  rename: 'Fix title', tag: 'Change tags', move: 'Suggest folder',
  delete_broken: 'Broken link', merge_folder: 'Merge folders', normalize_tag: 'Normalize tags',
};
function typeLabel(type: string, locale: 'zh' | 'en') {
  return (locale === 'en' ? typeLabelsEn : typeLabels)[type] ?? type;
}

function notifySuggestionsChanged() {
  window.dispatchEvent(new Event('bookmark-hub:suggestions-changed'));
}

export default function RescuePage() {
  const { t, locale } = useI18n();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [allSuggestions, setAllSuggestions] = useState<Suggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [visibleTotal, setVisibleTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<RescueRunResult | null>(null);
  const [syncingChrome, setSyncingChrome] = useState(false);
  const [syncResult, setSyncResult] = useState<ChromeSyncNotice | null>(null);
  const [folderDepth, setFolderDepth] = useState<1 | 2>(1);
  const [topLevelFolderLimit, setTopLevelFolderLimit] = useState(10);
  const [savingFolderPolicy, setSavingFolderPolicy] = useState(false);
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const [bulkUndoing, setBulkUndoing] = useState(false);
  const [lastBulkAcceptedIds, setLastBulkAcceptedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: 'pending', limit: '100' });
    if (filterType) params.set('type', filterType);

    try {
      const allParams = new URLSearchParams({ status: 'pending', limit: '100000' });
      const [res, allRes] = await Promise.all([
        fetch(`/api/suggestions?${params}`),
        fetch(`/api/suggestions?${allParams}`),
      ]);
      const [data, allData] = await Promise.all([
        res.json(),
        allRes.json(),
      ]);
      setSuggestions(data.items ?? []);
      setAllSuggestions(allData.items ?? []);
      setVisibleTotal(data.total ?? 0);
      setTotal(allData.total ?? 0);
      setHasScanned(true);
      setError('');
    } catch {
      setError(ui(locale, '建议列表加载失败。', 'Failed to load suggestions.'));
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  const fetchChromeSyncNotice = useCallback(async (showEmpty = false) => {
    try {
      const res = await fetch('/api/extension/sync-back');
      const data = await res.json();
      const count = data.count ?? 0;
      setSyncResult(count > 0 || showEmpty ? { count, ops: Array.isArray(data.ops) ? data.ops : [] } : null);
    } catch {
      setError(ui(locale, '同步影响预览失败。', 'Failed to load sync preview.'));
    }
  }, []);

  const fetchFolderPolicy = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setFolderDepth(data.folderDepth === 2 ? 2 : 1);
      const value = Number(data.topLevelFolderLimit);
      setTopLevelFolderLimit(Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 3), 50) : 10);
    } catch {
      setError(ui(locale, '文件夹策略加载失败。', 'Failed to load folder policy.'));
    }
  }, []);

  useEffect(() => {
    // Existing app pages hydrate local API state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSuggestions();
    fetchChromeSyncNotice();
    fetchFolderPolicy();
  }, [fetchSuggestions, fetchChromeSyncNotice, fetchFolderPolicy]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const suggestion of allSuggestions) {
      counts.set(suggestion.type, (counts.get(suggestion.type) ?? 0) + 1);
    }
    return counts;
  }, [allSuggestions]);

  async function runRescue() {
    setScanning(true);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/rescue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deep: true, analysisLimit: 20 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(localizedError(locale, data.error, ui(locale, '整理扫描失败。', 'Organize scan failed.')));
      setScanResult(data);
      const suggestionsCount = data.suggestionsCount ?? 0;
      setNotice(suggestionsCount > 0
        ? ui(locale, `生成 ${suggestionsCount} 条待审查建议。`, `Generated ${suggestionsCount} suggestions for review.`)
        : ui(locale, '整理检查完成，当前没有需要处理的建议。', 'Organize scan complete; no suggestions need review.')
      );
      await fetchSuggestions();
      notifySuggestionsChanged();
      await fetchChromeSyncNotice();
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '整理扫描失败。', 'Organize scan failed.'));
    } finally {
      setScanning(false);
    }
  }

  async function acceptSuggestion(id: string) {
    setNotice('');
    setError('');

    try {
      const res = await fetch(`/api/suggestions/${id}/accept`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, ui(locale, '接受建议失败。', 'Failed to accept suggestion.')));

      setSuggestions((prev) => prev.filter((suggestion) => suggestion.id !== id));
      setAllSuggestions((prev) => prev.filter((suggestion) => suggestion.id !== id));
      setVisibleTotal((count) => Math.max(0, count - 1));
      setTotal((count) => Math.max(0, count - 1));
      setNotice(ui(locale, '建议已写入本地。涉及 Chrome 的改动会进入同步预览。', 'Suggestion saved locally. Chrome changes will appear in the sync preview.'));
      setLastBulkAcceptedIds([]);
      notifySuggestionsChanged();
      await fetchChromeSyncNotice();
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '接受建议失败。', 'Failed to accept suggestion.'));
    }
  }

  async function dismissSuggestion(id: string) {
    setNotice('');
    setError('');

    try {
      const res = await fetch(`/api/suggestions/${id}/dismiss`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, ui(locale, '忽略建议失败。', 'Failed to dismiss suggestion.')));

      setSuggestions((prev) => prev.filter((suggestion) => suggestion.id !== id));
      setAllSuggestions((prev) => prev.filter((suggestion) => suggestion.id !== id));
      setVisibleTotal((count) => Math.max(0, count - 1));
      setTotal((count) => Math.max(0, count - 1));
      setLastBulkAcceptedIds([]);
      notifySuggestionsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '忽略建议失败。', 'Failed to dismiss suggestion.'));
    }
  }

  async function acceptAllSuggestions() {
    if (visibleTotal === 0) {
      setNotice(ui(locale, '当前没有可接受的待审查建议。', 'No pending suggestions to accept.'));
      setError('');
      return;
    }
    const targetCount = filterType ? visibleTotal : total;
    const confirmed = window.confirm(ui(locale, `接受全部 ${targetCount} 条待审查建议？改动会先写入本地，涉及 Chrome 的项目进入同步预览。`, `Accept all ${targetCount} pending suggestions? Changes are saved locally first; Chrome changes enter the sync preview.`));
    if (!confirmed) return;

    setBulkAccepting(true);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/suggestions/accept-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterType ? { type: filterType } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, ui(locale, '批量接受失败', 'Failed to accept suggestions')));

      const accepted = Number(data.accepted ?? 0);
      const acceptedIds = Array.isArray(data.acceptedIds)
        ? data.acceptedIds.map((id: unknown) => String(id)).filter(Boolean)
        : [];
      setLastBulkAcceptedIds(acceptedIds);
      setNotice(accepted > 0
        ? ui(locale, `已接受 ${accepted} 条建议。需要写回 Chrome 的改动会进入同步预览，可在写回前批量撤回`, `Accepted ${accepted} suggestions. Chrome changes enter the sync preview and can be undone before sync.`)
        : ui(locale, '当前没有可接受的待审查建议。', 'No pending suggestions to accept.')
      );
      await fetchSuggestions();
      notifySuggestionsChanged();
      await fetchChromeSyncNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '批量接受失败', 'Failed to accept suggestions'));
    } finally {
      setBulkAccepting(false);
    }
  }

  async function undoAcceptedSuggestions() {
    setBulkUndoing(true);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/suggestions/undo-accepted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lastBulkAcceptedIds.length > 0
          ? { suggestionIds: lastBulkAcceptedIds, includeSynced: true }
          : {}
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, ui(locale, '撤回失败。', 'Failed to undo accepted suggestions.')));

      const reverted = Number(data.reverted ?? 0);
      setLastBulkAcceptedIds([]);
      setNotice(reverted > 0
        ? ui(locale, `已撤回 ${reverted} 条已接受建议，改动已恢复为待审查状态。`, `Undid ${reverted} accepted suggestions; they are pending review again.`)
        : ui(locale, '当前没有可撤回的已接受建议。', 'No accepted suggestions to undo.')
      );
      await fetchSuggestions();
      notifySuggestionsChanged();
      await fetchChromeSyncNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '撤回失败。', 'Failed to undo accepted suggestions.'));
    } finally {
      setBulkUndoing(false);
    }
  }

  async function dismissVisibleSuggestions() {
    const confirmed = window.confirm(ui(locale, '忽略当前列表里的所有建议？', 'Dismiss all suggestions in the current list?'));
    if (!confirmed) return;

    for (const suggestion of suggestions) {
      await fetch(`/api/suggestions/${suggestion.id}/dismiss`, { method: 'POST' });
    }
    await fetchSuggestions();
    notifySuggestionsChanged();
    setLastBulkAcceptedIds([]);
    setNotice(ui(locale, '当前列表建议已忽略。', 'Suggestions in the current list were dismissed.'));
  }

  async function previewChromeSync() {
    setSyncingChrome(true);
    await fetchChromeSyncNotice(true);
    setSyncingChrome(false);
  }

  async function exportChromeFromWeb() {
    setSyncingChrome(true);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/extension/sync-back');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, ui(locale, '导出回 Chrome 失败。', 'Failed to prepare Chrome sync.')));

      const count = Number(data.count ?? 0);
      const ops = Array.isArray(data.ops) ? data.ops : [];
      setSyncResult({ count, ops });
      setNotice(count > 0
        ? ui(locale, `已准备 ${count} 项待写回 Chrome。请打开 BookmarkHub 插件弹窗完成写回`, `Prepared ${count} Chrome changes. Open the BookmarkHub extension to apply them.`)
        : ui(locale, '当前没有需要导出回 Chrome 的改动。', 'No changes need to be synced to Chrome.')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '导出回 Chrome 失败。', 'Failed to prepare Chrome sync.'));
    } finally {
      setSyncingChrome(false);
    }
  }

  async function saveFolderPolicy() {
    setSavingFolderPolicy(true);
    setNotice('');
    setError('');

    try {
      const normalizedLimit = Number.isFinite(topLevelFolderLimit)
        ? Math.min(Math.max(Math.round(topLevelFolderLimit), 3), 50)
        : 10;
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderDepth,
          topLevelFolderLimit: normalizedLimit,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, ui(locale, '保存文件夹策略失败。', 'Failed to save folder policy.')));
      setTopLevelFolderLimit(normalizedLimit);
      if (data.folderDepthChanged) {
        await fetchSuggestions();
        notifySuggestionsChanged();
        const cleared = Number(data.clearedPendingFolderSuggestions ?? 0);
        setNotice(cleared > 0
          ? ui(locale, `文件夹策略已保存，已清空 ${cleared} 条旧分类建议。请重新生成整理建议后再接受分类建议。`, `Folder policy saved. Cleared ${cleared} outdated folder suggestions. Generate new suggestions before accepting folder changes.`)
          : ui(locale, '文件夹策略已保存。请重新生成整理建议，让 AI 按新层级重新判断分类。', 'Folder policy saved. Generate suggestions again so AI can use the new depth.')
        );
      } else if (data.topLevelFolderLimitChanged) {
        if (data.topLevelFolderLimitExceeded) {
          setNotice(ui(locale, `一级文件夹上限已保存。当前已有 ${data.topLevelFolderCount} 个一级文件夹，超过新上限 ${data.topLevelFolderLimit}；现有建议不会清空，建议重新整理分类方案或调高上限。`, `Top-level folder limit saved. There are ${data.topLevelFolderCount} folders, above the new limit of ${data.topLevelFolderLimit}. Existing suggestions remain; revise the taxonomy or raise the limit.`));
        } else if (data.topLevelFolderLimitDecreased) {
          setNotice(ui(locale, '一级文件夹上限已保存，当前数量未超过新上限', 'Top-level folder limit saved; the current count is within it.'));
        } else {
          setNotice(ui(locale, '一级文件夹上限已保存，不需要重新生成现有建议', 'Top-level folder limit saved; existing suggestions do not need regeneration.'));
        }
      } else {
        setNotice(ui(locale, '文件夹策略未变化，现有建议可继续审查。', 'Folder policy unchanged; existing suggestions remain ready for review.'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '保存文件夹策略失败。', 'Failed to save folder policy.'));
    } finally {
      setSavingFolderPolicy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] pb-6">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#23372B]">{t.rescue.title}</h1>
          <p className="mt-1 max-w-[820px] text-xs leading-5 text-[#59634F]">
            {ui(locale, '书签管家会定期发现坏链、空标题、缺摘要和分类问题；AI 只给建议，不会绕过你直接改 Chrome。', 'BookmarkHub finds broken links, missing titles and summaries, and folder issues. AI proposes changes for your review and does not modify Chrome directly.')}
          </p>
        </div>
        <button
          onClick={runRescue}
          disabled={scanning}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#294435] px-4 text-xs font-semibold text-white transition hover:bg-[#1F3228] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RescueIcon name="sparkles" className="text-[14px]" />
          {scanning ? t.rescue.scanning : t.rescue.runScan}
        </button>
      </header>

      <section id="folder-policy" className="mb-4 rounded-lg border border-[#E1D9C9] bg-white px-5 py-4">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[#23372B]">{t.rescue.folderStrategy}</h2>
            <p className="mt-1 max-w-[760px] text-xs leading-5 text-[#59634F]">
              {ui(locale, 'AI 先参考已有文件夹；不合适才建议新文件夹。切换层级后需重新生成分类建议；二级文件夹不单独设上限。', 'AI considers existing folders before suggesting new ones. Generate folder suggestions again after changing depth. Subfolders have no separate limit.')}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end xl:justify-end">
            <div>
              <div className="mb-1 text-xs font-medium text-[#59634F]">{ui(locale, '层级', 'Depth')}</div>
              <div className="inline-flex rounded-md border border-[#E1D9C9] bg-[#EEE9DF] p-0.5">
                {[1, 2].map((depth) => (
                  <button
                    key={depth}
                    type="button"
                    onClick={() => setFolderDepth(depth as 1 | 2)}
                    className={`h-7 min-w-14 rounded px-2 text-xs font-semibold transition ${
                      folderDepth === depth
                        ? 'bg-[#59634F] text-white'
                        : 'text-[#59634F] hover:text-[#23372B]'
                    }`}
                  >
                    {depth === 1 ? ui(locale, '一级', 'One level') : ui(locale, '二级', 'Two levels')}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <div className="mb-1 text-xs font-medium text-[#59634F]">{ui(locale, '一级文件夹上限', 'Top-level folder limit')}</div>
              <input
                type="number"
                min={3}
                max={50}
                value={topLevelFolderLimit}
                onChange={(event) => setTopLevelFolderLimit(Number(event.target.value))}
                className="h-8 w-24 rounded border border-[#E1D9C9] bg-white px-2.5 text-xs text-[#23372B] outline-none transition focus:border-[#48664E]"
              />
            </label>
            <button
              type="button"
              onClick={saveFolderPolicy}
              disabled={savingFolderPolicy}
              className="h-8 rounded-md border border-[#59634F] bg-white px-3 text-xs font-semibold text-[#59634F] transition hover:bg-[#EDE6D6]/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingFolderPolicy ? ui(locale, '保存中...', 'Saving...') : ui(locale, '保存策略', 'Save policy')}
            </button>
          </div>
        </div>
      </section>

      {(notice || error) && (
        <div className={`mb-4 rounded-md border px-4 py-2.5 text-xs ${
          error ? 'border-[#ba1a1a]/20 bg-[#ffdad6] text-[#ba1a1a]' : 'border-[#157347]/20 bg-[#f0fff4] text-[#157347]'
        }`}>
          {error || notice}
        </div>
      )}

      {scanResult?.analysis && (
        <section className="mb-4 rounded-lg border border-[#E1D9C9] bg-[#EEE9DF] p-4 text-xs text-[#26372D]">
          <div className="font-semibold text-[#23372B]">{ui(locale, '本次整理扫描', 'Latest organize scan')}</div>
          <div className="mt-2 grid gap-2 md:grid-cols-6">
            <Metric label={ui(locale, '分析书签', 'Analyzed')} value={scanResult.analysis.processed} />
            <Metric label={ui(locale, '抓到正文', 'Pages fetched')} value={scanResult.analysis.fetched} />
            <Metric label={ui(locale, '生成摘要', 'Summaries')} value={scanResult.analysis.summaries} />
            <Metric label={ui(locale, '辅助标签', 'Tags')} value={scanResult.analysis.tags} />
            <Metric label={ui(locale, '语义索引', 'Semantic index')} value={scanResult.analysis.embeddings} />
            <Metric label={ui(locale, '坏链/超时', 'Broken / timed out')} value={scanResult.analysis.linkFailures} />
          </div>
          {scanResult.analysis.firstError && (
            <div className="mt-2 text-xs text-[#ba1a1a]">{ui(locale, '首个错误', 'First error')}: {scanResult.analysis.firstError}</div>
          )}
        </section>
      )}

      {scanResult?.folderPolicy?.willReachLimit && (
        <section className="mb-4 rounded-lg border border-[#fffae5] bg-[#fffae5] p-4 text-xs text-[#b54708]">
          <div className="font-semibold text-[#b54708]">{ui(locale, '一级文件夹已达到上限', 'Top-level folder limit reached')}</div>
          <p className="mt-1 leading-5">
            {scanResult.folderPolicy.message}
            {' '}{ui(locale, '如果你希望 AI 继续拆出新的一级文件夹，可以调整上限；如果当前分类已经太散，可以先重新生成一套分类方案。', 'Raise the limit to let AI suggest more top-level folders, or regenerate the category plan if it has become too scattered.')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/taxonomy"
              className="rounded border border-[#E1D9C9] bg-white px-2.5 py-1 text-xs font-semibold text-[#b54708] transition hover:bg-[#fffae5]"
            >
              {ui(locale, '重新整理分类方案', 'Regenerate category plan')}
            </Link>
            <Link
              href="#folder-policy"
              className="rounded bg-[#b54708] px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90"
            >
              {ui(locale, '调整一级文件夹上限', 'Adjust folder limit')}
            </Link>
          </div>
        </section>
      )}

      {hasScanned && total > 0 && (
        <section className="mb-4 rounded-lg border border-[#fffae5] bg-[#fffae5] p-3">
          <p className="text-xs font-semibold text-[#b54708]">{ui(locale, `待审查建议：${total} 条`, `${total} suggestions pending review`)}</p>
          <p className="mt-0.5 text-xs text-[#59634F]">{ui(locale, '接受建议只先写入本地；涉及 Chrome 的改动会进入同步预览', 'Accepted suggestions are saved locally first; Chrome changes enter the sync preview.')}</p>
        </section>
      )}

      <section className="mb-4 flex flex-col gap-3 rounded-lg border border-[#E1D9C9] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/import"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E1D9C9] bg-white px-4 text-xs font-semibold text-[#26372D] transition hover:bg-[#EEE9DF]"
          >
            <RescueIcon name="download" className="text-[14px]" />
            {ui(locale, '导入书签', 'Import bookmarks')}
          </Link>
          <button
            type="button"
            onClick={acceptAllSuggestions}
            disabled={bulkAccepting || loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#294435] px-4 text-xs font-semibold text-white transition hover:bg-[#1F3228] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RescueIcon name="check" className="text-[14px]" />
            {bulkAccepting ? ui(locale, '接受中...', 'Accepting...') : ui(locale, '批量接受全部', 'Accept all')}
          </button>
          <button
            type="button"
            onClick={undoAcceptedSuggestions}
            disabled={bulkUndoing || (lastBulkAcceptedIds.length === 0 && (syncResult?.count ?? 0) === 0)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E1D9C9] bg-white px-4 text-xs font-semibold text-[#59634F] transition hover:bg-[#EEE9DF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RescueIcon name="undo" className="text-[14px]" />
            {bulkUndoing ? ui(locale, '撤回中...', 'Undoing...') : ui(locale, '批量撤回', 'Undo accepted')}
          </button>
          <button
            type="button"
            onClick={exportChromeFromWeb}
            disabled={syncingChrome}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#59634F] bg-[#EDE6D6]/40 px-4 text-xs font-semibold text-[#59634F] transition hover:bg-[#EDE6D6]/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RescueIcon name="upload" className="text-[14px]" />
            {syncingChrome ? ui(locale, '准备中...', 'Preparing...') : ui(locale, '导出回 Chrome', 'Prepare Chrome sync')}
          </button>
        </div>
        <div className="text-xs text-[#59634F]">
          {ui(locale, '接受后先写入本地，写回 Chrome 前可撤回。', 'Accepted changes are saved locally and can be undone before Chrome sync.')}
        </div>
      </section>

      {total > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType(null)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${!filterType ? 'bg-[#EDE6D6] text-[#59634F] font-bold' : 'border border-[#E1D9C9] bg-white text-[#59634F] hover:bg-[#eeeeec]'}`}
          >
            {ui(locale, `全部 (${total})`, `All (${total})`)}
          </button>
          {Array.from(typeCounts.entries()).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${filterType === type ? 'bg-[#EDE6D6] text-[#59634F] font-bold' : 'border border-[#E1D9C9] bg-white text-[#59634F] hover:bg-[#eeeeec]'}`}
            >
              {typeLabel(type, locale)} ({count})
            </button>
          ))}
        </div>
      )}

      <section className="mb-4 rounded-lg border border-[#E1D9C9] bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-[300px] items-center gap-3 text-xs leading-5 text-[#59634F]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#EEE9DF] text-[#26372D]">
              <RescueIcon name="eye" className="text-[16px]" />
            </span>
            {ui(locale, '接受后的改名、移动、删除，以及本地已分类但未写入 Chrome 的书签，会先留在同步计划里。', 'Accepted renames, moves, deletions, and locally categorized bookmarks stay in the sync plan until applied to Chrome.')}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              onClick={previewChromeSync}
              disabled={syncingChrome}
              className="min-h-8 whitespace-nowrap rounded-md border border-[#59634F] bg-white px-3 text-xs font-semibold text-[#59634F] transition hover:bg-[#EDE6D6]/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncingChrome ? ui(locale, '读取中...', 'Loading...') : ui(locale, '预览待写回 Chrome', 'Preview Chrome changes')}
            </button>
            {suggestions.length > 0 && (
              <button
                onClick={dismissVisibleSuggestions}
                className="h-8 rounded-md border border-[#E1D9C9] bg-white px-3 text-xs font-semibold text-[#59634F] transition hover:border-[#ba1a1a] hover:text-[#ba1a1a]"
              >
                {ui(locale, '忽略当前列表', 'Dismiss current list')}
              </button>
            )}
          </div>
        </div>
      </section>

      {syncResult && (
        <section className="mb-4 rounded-lg border border-[#E1D9C9] bg-[#EDE6D6]/40 p-4">
          <p className="text-xs font-semibold text-[#59634F]">
            {syncResult.count > 0 ? ui(locale, `有 ${syncResult.count} 项 Chrome 改动等待插件写回。`, `${syncResult.count} Chrome changes are waiting for the extension.`) : ui(locale, '当前没有需要写回 Chrome 的改动。', 'No Chrome changes pending.')}
          </p>
          <p className="mt-0.5 text-xs text-[#59634F]">{ui(locale, '这里只预览待写回影响；预览不会修改 Chrome。', 'This is a preview only; it does not modify Chrome.')}</p>
          {syncResult.count > 0 && (
            <>
              <p className="mt-0.5 text-xs text-[#59634F]">{ui(locale, '真正写入 Chrome 仍需在 BookmarkHub 插件弹窗中操作', 'Apply these changes in the BookmarkHub extension popup to write them to Chrome.')}</p>
              <div className="mt-3 space-y-2">
                {syncResult.ops.map((op) => (
                  <div key={op.id} className="rounded-md border border-[#E1D9C9] bg-white px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#EDE6D6] px-2 py-0.5 text-xs font-semibold text-[#59634F]">{formatChromeOpAction(op, locale)}</span>
                      <span className="min-w-0 truncate font-medium text-[#23372B]">{op.bookmarkTitle || op.bookmarkUrl || op.chromeId || op.bookmarkId}</span>
                    </div>
                    <div className="mt-1 text-xs text-[#59634F]">{formatChromeOpDetail(op, locale)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-[#E1D9C9] bg-white py-12 text-center text-xs text-[#59634F] animate-pulse">{ui(locale, '加载中...', 'Loading...')}</div>
      ) : suggestions.length === 0 ? (
        <EmptySuggestionState hasScanned={hasScanned} />
      ) : (
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={() => acceptSuggestion(suggestion.id)}
              onDismiss={() => dismissSuggestion(suggestion.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: Suggestion;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const { locale } = useI18n();
  const before = parseJSON(suggestion.beforeJson);
  const after = parseJSON(suggestion.afterJson);

  return (
    <article className="rounded-lg border border-[#E1D9C9] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
              suggestion.type === 'delete_broken'
                  ? 'bg-[#ffdad6] text-[#ba1a1a]'
                  : 'bg-[#EDE6D6] text-[#59634F]'
            }`}>
              {typeLabel(suggestion.type, locale)}
            </span>
            {suggestion.confidence !== null && (
              <span className="text-xs text-[#6F7864]">{ui(locale, '置信度', 'Confidence')} {Math.round(suggestion.confidence * 100)}%</span>
            )}
          </div>

          {suggestion.bookmark && (
            <div className="mb-2 min-w-0 text-xs">
              <span className="font-semibold text-[#23372B]">{suggestion.bookmark.title ?? ui(locale, '无标题', 'Untitled')}</span>
              <span className="ml-2 text-xs text-[#59634F]">{suggestion.bookmark.url}</span>
            </div>
          )}

          <div className="space-y-1 rounded-md bg-[#EEE9DF] p-3 font-mono text-xs border border-[#E1D9C9]">
            {renderDiff(before, after, suggestion.type, locale).map((line) => (
              <div key={line.text} className={line.tone === 'remove' ? 'text-[#ba1a1a]' : line.tone === 'add' ? 'text-[#157347]' : 'text-[#59634F]'}>
                {line.text}
              </div>
            ))}
          </div>

          {suggestion.reason && <div className="mt-2 text-xs text-[#59634F]">{suggestion.reason}</div>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-1">
          {suggestion.bookmarkId && (
            <Link href={`/bookmarks/${suggestion.bookmarkId}`} className="rounded border border-[#E1D9C9] bg-white px-2.5 py-1 text-xs text-[#26372D] transition hover:bg-[#EEE9DF]">
              {ui(locale, '编辑', 'Edit')}
            </Link>
          )}
          <button onClick={onAccept} className="rounded bg-[#294435] px-2.5 py-1 text-xs text-white transition hover:bg-[#1F3228]">
            {ui(locale, '接受', 'Accept')}
          </button>
          <button onClick={onDismiss} className="rounded border border-[#E1D9C9] bg-white px-2.5 py-1 text-xs text-[#59634F] transition hover:bg-[#EEE9DF]">
            {ui(locale, '忽略', 'Dismiss')}
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptySuggestionState({ hasScanned }: { hasScanned: boolean }) {
  const { locale } = useI18n();
  return (
    <div className="grid min-h-[150px] place-items-center rounded-lg border border-dashed border-[#E1D9C9] bg-white px-5 py-8 text-center">
      <div>
        <div className="relative mx-auto h-16 w-24">
          <RescueIcon name="sparkles" className="absolute left-2 top-1 text-base text-[#c0c7d4]" />
          <RescueIcon name="sparkles" className="absolute right-1 top-6 text-sm text-[#c0c7d4]" />
          <div className="absolute left-1/2 top-4 grid h-12 w-14 -translate-x-1/2 place-items-center rounded-lg bg-[#EEE9DF] text-[#59634F] border border-[#E1D9C9]">
            <RescueIcon name="inbox" className="text-xl" />
          </div>
        </div>
        <div className="mt-4 text-xs font-semibold text-[#59634F]">
          {hasScanned ? ui(locale, '当前没有待审查建议。', 'No pending suggestions.') : ui(locale, '点击“生成整理建议”开始检查书签库。', 'Generate suggestions to scan your library.')}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#E1D9C9] bg-white px-2.5 py-1.5 text-center">
      <div className="text-sm font-bold text-[#23372B]">{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-[#59634F] uppercase tracking-wider">{label}</div>
    </div>
  );
}

type RescueIconName = 'check' | 'download' | 'eye' | 'inbox' | 'sparkles' | 'undo' | 'upload';

function RescueIcon({ name, className = '' }: { name: RescueIconName; className?: string }) {
  const iconMap: Record<RescueIconName, string> = {
    check: 'check_circle',
    download: 'download',
    eye: 'visibility',
    inbox: 'inbox',
    sparkles: 'auto_awesome',
    undo: 'undo',
    upload: 'upload',
  };

  const iconName = iconMap[name] || 'bookmark';

  return (
    <span className={`material-symbols-outlined shrink-0 flex items-center justify-center ${className}`} style={{ fontSize: 'inherit' }}>
      {iconName}
    </span>
  );
}



function parseJSON(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function renderDiff(before: Record<string, unknown>, after: Record<string, unknown>, type: string, locale: 'zh' | 'en') {
  const lines: Array<{ text: string; tone: 'add' | 'remove' | 'neutral' }> = [];

  if (before.title !== undefined) lines.push({ text: `- ${ui(locale, '标题', 'title')}: ${formatDiffValue(before.title, ui(locale, '(空)', '(empty)'))}`, tone: 'remove' });
  if (after.title !== undefined) lines.push({ text: `+ ${ui(locale, '标题', 'title')}: ${formatDiffValue(after.title)}`, tone: 'add' });
  if (before.folderPath !== undefined) lines.push({ text: `- ${ui(locale, '文件夹', 'folder')}: ${formatDiffValue(before.folderPath, ui(locale, '(无)', '(none)'))}`, tone: 'remove' });
  if (after.folderPath !== undefined) lines.push({ text: `+ ${ui(locale, '文件夹', 'folder')}: ${formatDiffValue(after.folderPath)}`, tone: 'add' });
  if (before.url !== undefined) lines.push({ text: `- url: ${formatDiffValue(before.url)}`, tone: 'remove' });
  if (after.targetUrl !== undefined) lines.push({ text: `${ui(locale, '保留链接', 'Keep URL')}: ${formatDiffValue(after.targetUrl)}`, tone: 'neutral' });
  if (Array.isArray(after.tags)) lines.push({ text: `+ ${ui(locale, '标签', 'tags')}: ${after.tags.map((tag) => formatDiffValue(tag)).join(', ')}`, tone: 'add' });
  if (after.action === 'delete') lines.push({ text: ui(locale, '+ 操作：移至本地回收状态', '+ action: move to local deleted state'), tone: 'remove' });
  if (after.action === 'merge_into') lines.push({ text: `+ ${ui(locale, '操作：合并到', 'action: merge into')} ${formatDiffValue(after.targetTitle ?? after.targetId, ui(locale, '目标书签', 'target bookmark'))}`, tone: 'add' });

  if (lines.length === 0) {
    lines.push({ text: `${type}: ${JSON.stringify(after)}`, tone: 'neutral' });
  }

  return lines;
}

function formatDiffValue(value: unknown, fallback = ''): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function formatChromeOpAction(op: ChromeSyncOp, locale: 'zh' | 'en'): string {
  if (op.action === 'update') return ui(locale, '修改标题', 'Rename');
  if (op.action === 'move') return ui(locale, '移动文件夹', 'Move folder');
  if (op.action === 'create') return ui(locale, '写入 Chrome', 'Create in Chrome');
  return ui(locale, '删除书签', 'Delete bookmark');
}

function formatChromeOpDetail(op: ChromeSyncOp, locale: 'zh' | 'en'): string {
  if (op.action === 'update') return ui(locale, `Chrome 标题将改为：${op.title || '未命名'}`, `Chrome title will become: ${op.title || 'Untitled'}`);
  if (op.action === 'move') return ui(locale, `Chrome 书签将移动到：${op.folderPath || '书签'}`, `Chrome bookmark will move to: ${op.folderPath || 'Bookmarks'}`);
  if (op.action === 'create') return ui(locale, `Chrome 会保存到：${op.folderPath || '书签'}`, `Chrome will save to: ${op.folderPath || 'Bookmarks'}`);
  return ui(locale, `Chrome 中会删除这条书签：${op.bookmarkUrl || op.chromeId || op.bookmarkId}`, `Chrome will delete this bookmark: ${op.bookmarkUrl || op.chromeId || op.bookmarkId}`);
}
