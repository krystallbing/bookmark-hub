'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { localizedError, useI18n } from '@/lib/i18n';

interface DetectedProfile {
  name: string;
  path: string;
  bookmarkCount: number;
}

interface ImportResult {
  imported: number;
  folders: number;
  duplicates: number;
  missingTitles: number;
}

interface IndexResult {
  processed: number;
  summaries: number;
  tags: number;
  embeddings: number;
  errors: number;
}

const ui = (locale: 'zh' | 'en', zh: string, en: string) => locale === 'en' ? en : zh;

export default function ImportPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [profiles, setProfiles] = useState<DetectedProfile[]>([]);
  const [detecting, setDetecting] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingProfile, setImportingProfile] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<IndexResult | null>(null);

  // Single bookmark addition states
  const [showAddSingle, setShowAddSingle] = useState(false);
  const [singleUrl, setSingleUrl] = useState('');
  const [singleTitle, setSingleTitle] = useState('');
  const [singleFolder, setSingleFolder] = useState('');
  const [addingSingle, setAddingSingle] = useState(false);
  const [addSingleResult, setAddSingleResult] = useState<{ status: string; title: string } | null>(null);
  const [addSingleError, setAddSingleError] = useState<string | null>(null);
  const [existingFolders, setExistingFolders] = useState<string[]>([]);

  // Auto-detect on mount
  useEffect(() => {
    fetch('/api/detect')
      .then((r) => {
        if (!r.ok) return { profiles: [] };
        return r.json();
      })
      .then((data) => setProfiles(data?.profiles ?? []))
      .catch(() => setProfiles([]))
      .finally(() => setDetecting(false));
  }, []);

  // Fetch existing folders when user opens the single add card
  useEffect(() => {
    if (showAddSingle) {
      fetch('/api/folders')
        .then((r) => {
          if (!r.ok) return { folders: [] };
          return r.json();
        })
        .then((data) => {
          const names = (data.folders ?? []).map((f: { name: string; path: string }) => f.path ?? f.name);
          const uniqueNames = Array.from(new Set(names)) as string[];
          setExistingFolders(uniqueNames);
        })
        .catch(() => {});
    }
  }, [showAddSingle]);

  const handleAddSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleUrl) return;

    setAddingSingle(true);
    setAddSingleError(null);
    setAddSingleResult(null);

    try {
      const res = await fetch('/api/extension/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: singleUrl,
          title: singleTitle || undefined,
          folderPath: singleFolder || undefined,
        }),
      });

      const data = await res.json() as { error?: string; status?: string; bookmark?: { title: string } };
      if (!res.ok) {
        setAddSingleError(localizedError(locale, data.error, ui(locale, '添加书签失败', 'Failed to add bookmark')));
      } else {
        setAddSingleResult({
          status: data.status ?? 'saved',
          title: (data.bookmark?.title ?? singleTitle) || singleUrl,
        });
        setSingleUrl('');
        setSingleTitle('');
        setSingleFolder('');
        // Proactively dispatch event to refresh stats in sidebar
        window.dispatchEvent(new Event('bookmark-hub:suggestions-changed'));
      }
    } catch (err: unknown) {
      setAddSingleError(localizedError(locale, err, ui(locale, '添加书签失败', 'Failed to add bookmark')));
    } finally {
      setAddingSingle(false);
    }
  };

  const handleAutoImport = async (profile: DetectedProfile) => {
    setImportingProfile(profile.name);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/import-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: profile.path }),
      });
      const data = await res.json() as Partial<ImportResult> & { error?: string };
      if (!res.ok) {
        setError(localizedError(locale, data.error, locale === 'en' ? 'Import failed' : '导入失败'));
      } else {
        setResult(data as ImportResult);
      }
    } catch (err: unknown) {
      setError(localizedError(locale, err, locale === 'en' ? 'Import failed' : '导入失败'));
    } finally {
      setImportingProfile(null);
    }
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleFileImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json() as Partial<ImportResult> & { error?: string };
      if (!res.ok) {
        setError(localizedError(locale, data.error, locale === 'en' ? 'Import failed' : '导入失败'));
      } else {
        setResult(data as ImportResult);
      }
    } catch (err: unknown) {
      setError(localizedError(locale, err, locale === 'en' ? 'Import failed' : '导入失败'));
    } finally {
      setImporting(false);
    }
  };

  const handleIndexMissing = async () => {
    setIndexing(true);
    setIndexResult(null);
    setError(null);

    try {
      const res = await fetch('/api/index-bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, onlyMissing: true, useAI: true, background: true }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(localizedError(locale, data.error, locale === 'en' ? 'Indexing failed' : '分析失败'));
      }
    } catch (err: unknown) {
      setError(localizedError(locale, err, locale === 'en' ? 'Indexing failed' : '分析失败'));
    } finally {
      setIndexing(false);
    }
  };

  const browserIcon = (name: string) => {
    if (name.includes('Edge')) return '🌐';
    if (name.includes('Brave')) return '🦁';
    if (name.includes('Arc')) return '🌈';
    return '🔵';
  };

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <header className="rounded-lg border border-[#E1D9C9] bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#48664E]">{ui(locale, '安全导入', 'Safe Import')}</p>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-[#23372B]">{t.import.title}</h1>
        <p className="mt-1.5 text-xs leading-5 text-[#59634F]">
            {t.import.desc} {ui(locale, '书签帮帮忙 (BookmarkHub) 会先只读导入所有可解析书签并重建本地关键词索引；网页抓取、AI 摘要、标签和坏链检测在导入后单独执行，避免少数超时链接拖垮 2k 级别导入。', 'BookmarkHub imports readable bookmarks without modifying the browser and rebuilds the local keyword index. Page fetching, AI summaries, tags, and broken-link checks run separately afterward so a few slow links do not block large imports.')}
          </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
            [ui(locale, '只读导入', 'Read-only import'), ui(locale, '不直接修改 Chrome 书签', 'Does not modify Chrome bookmarks')],
            [ui(locale, '已存在跳过', 'Skip existing'), ui(locale, '相同链接不会二次入库', 'The same link is not imported twice')],
            [ui(locale, 'URL 规范化', 'Normalize URLs'), ui(locale, '去追踪参数并识别已保存链接', 'Remove tracking parameters and detect saved links')],
            [ui(locale, '导入后分析', 'Analyze afterward'), ui(locale, '摘要、最多 3 个标签和索引独立执行', 'Summaries, up to 3 tags, and indexes run separately')],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-lg border border-[#E1D9C9] bg-white p-4">
            <div className="text-xs font-bold text-[#23372B]">{title}</div>
            <div className="mt-1 text-[11px] leading-4 text-[#59634F]">{desc}</div>
          </div>
        ))}
      </section>

      {/* Auto-detect section */}
      {detecting ? (
        <div className="p-5 rounded-lg border border-[#E1D9C9] bg-white">
          <div className="text-xs text-[#59634F] animate-pulse">{t.common.loading}</div>
        </div>
      ) : profiles.length > 0 ? (
        <div className="mb-4">
          <div className="space-y-2">
            {profiles.map((profile) => (
              <button
                key={profile.path}
                onClick={() => handleAutoImport(profile)}
                disabled={importingProfile !== null}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-[#E1D9C9] bg-white hover:bg-[#F8F7F2] transition text-left disabled:opacity-50"
              >
                <span className="text-2xl">{browserIcon(profile.name)}</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-[#23372B]">
                    {importingProfile === profile.name
                      ? t.import.importing
                      : `${profile.name}`}
                  </div>
                  <div className="text-xs text-[#59634F] mt-0.5">
                    {profile.bookmarkCount.toLocaleString()} {t.import.detected}
                  </div>
                </div>
                <div className="text-[#48664E] font-semibold text-xs">
                  {ui(locale, '只读入库', 'Import read-only')} →
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 手动添加单个书签 */}
      <section className="rounded border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{ui(locale, '手动添加单个书签', 'Add a bookmark manually')}</h2>
            <p className="mt-1 text-xs text-muted">{ui(locale, '录入常用的单条链接，AI 会自动在后台提取摘要并分类。', 'Add a link to your library. Background analysis can extract a summary and suggest a category.')}</p>
          </div>
          <button
            onClick={() => {
              setShowAddSingle(!showAddSingle);
              setAddSingleResult(null);
              setAddSingleError(null);
            }}
            className="h-8 rounded border border-border bg-card px-4 text-xs font-semibold text-foreground hover:bg-background transition"
          >
            {showAddSingle ? ui(locale, '收起表单', 'Hide form') : ui(locale, '展开表单', 'Show form')}
          </button>
        </div>

        {showAddSingle && (
          <form onSubmit={handleAddSingleSubmit} className="mt-4 space-y-4 border-t border-border pt-4">
            {addSingleResult && (
              <div className={`p-3 rounded text-xs ${addSingleResult.status === 'already_exists' ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                {addSingleResult.status === 'already_exists'
                  ? ui(locale, `书签已存在（已跳过）: ${addSingleResult.title}`, `Bookmark already exists (skipped): ${addSingleResult.title}`)
                  : ui(locale, `书签添加成功！已进入待分析队列：${addSingleResult.title}`, `Bookmark added and queued for analysis: ${addSingleResult.title}`)}
              </div>
            )}

            {addSingleError && (
              <div className="p-3 rounded bg-red-50 border border-red-200 text-red-800 text-xs">
                {addSingleError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground">{ui(locale, '网页链接', 'Page URL')} (URL) <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  className="w-full h-9 rounded border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder-[#6F7864] outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground">{ui(locale, '书签标题', 'Bookmark title')} ({ui(locale, '选填', 'optional')})</label>
                <input
                  type="text"
                  placeholder={ui(locale, '留空则尝试自动获取标题', 'Leave blank to try fetching the title')}
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  className="w-full h-9 rounded border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder-[#6F7864] outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-foreground">{ui(locale, '存放文件夹（支持联想输入/选填）', 'Folder (suggestions available, optional)')}</label>
              <input
                type="text"
                list="existing-folder-list"
                placeholder={ui(locale, '例如：开发资源、AI 工具（留空则由 AI 智能自动分类）', 'For example: Development resources; leave blank for AI classification')}
                value={singleFolder}
                onChange={(e) => setSingleFolder(e.target.value)}
                className="w-full h-9 rounded border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder-[#6F7864] outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
              <datalist id="existing-folder-list">
                {existingFolders.map((folder) => (
                  <option key={folder} value={folder} />
                ))}
              </datalist>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingSingle}
                className="h-9 rounded bg-accent text-white px-5 text-xs font-semibold hover:bg-accent/90 transition disabled:opacity-50"
              >
                {addingSingle ? ui(locale, '正在添加...', 'Adding...') : ui(locale, '加入书签', 'Add bookmark')}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-[#157347]/20 bg-[#f0fff4] p-5">
          <h3 className="text-sm font-semibold text-[#157347]">{t.import.complete}</h3>
              <p className="mt-1 text-xs text-[#59634F]">{ui(locale, '新书签已经进入本地库；已存在链接会直接跳过，不会二次导入。下一步可以异步分析内容，失败项会留在待审查队列里。', 'New bookmarks are in the local library. Existing links were skipped. You can analyze content next; failed items remain available for review.')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <ResultMetric label={t.import.imported} value={result.imported} />
            <ResultMetric label={t.import.folders} value={result.folders} />
            <ResultMetric label={t.import.duplicates} value={result.duplicates} />
            <ResultMetric label={t.import.missingTitles} value={result.missingTitles} />
          </div>
          {indexResult && (
            <div className="mt-3 rounded border border-[#E1D9C9] bg-white px-3 py-2 text-xs text-[#59634F]">
              {ui(locale, `已处理 ${indexResult.processed} 条；生成摘要 ${indexResult.summaries} 个、标签 ${indexResult.tags} 个、embedding ${indexResult.embeddings} 个；错误 ${indexResult.errors} 个。`, `Processed ${indexResult.processed}; summaries ${indexResult.summaries}, tags ${indexResult.tags}, embeddings ${indexResult.embeddings}; errors ${indexResult.errors}.`)}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleIndexMissing}
              disabled={indexing}
              className="h-8 rounded-md bg-[#294435] text-white px-4 text-xs font-semibold hover:bg-[#1F3228] transition disabled:opacity-50"
            >
              {indexing ? ui(locale, '分析中...', 'Analyzing...') : ui(locale, '分析摘要和搜索索引', 'Analyze summaries and search index')}
            </button>
            <button
              onClick={() => router.push('/library')}
              className="h-8 rounded-md border border-[#E1D9C9] bg-white px-4 text-xs font-semibold text-[#26372D] hover:bg-[#EEE9DF] transition"
            >
              {t.import.viewLibrary}
            </button>
            <button
              onClick={() => router.push('/rescue')}
              className="h-8 rounded-md border border-[#E1D9C9] bg-white px-4 text-xs font-semibold text-[#26372D] hover:bg-[#EEE9DF] transition"
            >
              {ui(locale, '去审查建议', 'Review suggestions')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-2.5 rounded-md border border-[#ba1a1a]/20 bg-[#ffdad6] text-[#ba1a1a] text-xs">{error}</div>
      )}

      {/* Manual upload fallback */}
      {!result && (
        <div className="rounded-lg border border-[#E1D9C9] bg-white p-4">
          {!showManual && profiles.length > 0 ? (
            <button
              onClick={() => setShowManual(true)}
              className="text-xs text-[#59634F] hover:text-[#23372B] hover:underline"
            >
              {t.import.manualUpload}
            </button>
          ) : (
            <>
              <div
                className={`border border-dashed rounded-md p-8 text-center transition ${
                  dragOver ? 'border-[#48664E] bg-[#F1EBDD]' : 'border-[#E1D9C9] bg-[#F8F7F2]'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="text-xs text-[#23372B]">
                    <p className="font-semibold mb-1">{file.name}</p>
                    <p className="text-[#59634F]">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-[#59634F] mb-3">{t.import.dragDrop}</p>
                    <label className="inline-block px-3 py-1.5 bg-[#294435] text-white rounded-md cursor-pointer text-xs font-semibold hover:bg-[#1F3228] transition">
                      {t.import.chooseFile}
                      <input
                        type="file"
                        accept=".html,.htm"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      />
                    </label>
                  </div>
                )}
              </div>
              {file && (
                <button
                  onClick={handleFileImport}
                  disabled={importing}
                  className="mt-3 w-full py-2 bg-[#294435] text-white rounded-md text-xs font-semibold hover:bg-[#1F3228] transition disabled:opacity-50"
                >
                  {importing ? t.import.importing : t.import.importBtn}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#E1D9C9] bg-white p-3">
      <div className="text-base font-bold text-[#23372B]">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[11px] text-[#59634F]">{label}</div>
    </div>
  );
}
