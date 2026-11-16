'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface SearchResult {
  bookmark: {
    id: string;
    url: string;
    title: string | null;
    summary: string | null;
    folderPath: string | null;
  };
  score: number;
  matchReason: string;
  matchedFields: string[];
  tags: string[];
}

export default function SearchPage() {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (q?: string) => {
    const searchQuery = q ?? query;
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearched(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, mode: 'memory', limit: 20 }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }, [query]);

  useEffect(() => {
    const urlQuery = new URLSearchParams(window.location.search).get('q');
    if (!urlQuery) return;
    // Existing app pages hydrate local API/UI state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(urlQuery);
    handleSearch(urlQuery);
    // Run only on entry so sidebar/top-bar searches do not become a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <header className="rounded-lg border border-[#E1D9C9] bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#48664E]">{locale === 'en' ? 'AI Search' : 'AI 搜索'}</p>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-[#23372B]">{t.search.title}</h1>
        <p className="mt-1.5 text-xs leading-5 text-[#59634F]">
          {t.search.desc}
        </p>
      </header>

      <section className="rounded-lg border border-[#E1D9C9] bg-white p-4">
        <div className="relative mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t.search.placeholder}
            className="w-full h-9 px-3 rounded-md border border-[#E1D9C9] bg-[#F8F7F2] text-xs text-[#23372B] outline-none transition focus:border-[#48664E] focus:bg-white"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[#59634F]">{t.search.aiFallback}</div>
          <button
            onClick={() => handleSearch()}
            disabled={searching || !query.trim()}
            className="h-8 rounded-md bg-[#294435] px-4 text-xs font-semibold text-white transition hover:bg-[#1F3228] disabled:bg-[#eeeeec] disabled:text-[#a1a19f] disabled:cursor-not-allowed"
          >
            {searching ? t.search.searching : t.search.searchBtn}
          </button>
        </div>
      </section>

      {!searched && (
        <section className="rounded-lg border border-[#E1D9C9] bg-white p-4">
          <div className="mb-2 text-xs font-bold text-[#23372B]">{t.search.examplesTitle}</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              ...t.search.examples,
              ...(locale === 'zh' ? ['可以让 AI 调用工具的协议', '之前收藏过的 MCP server 示例', '适合做竞品分析的工具', '能把网页变成本地知识库的项目'] : ['Protocols for AI tool use', 'MCP server examples I saved', 'Tools for competitor analysis', 'Projects that turn webpages into a local knowledge base']),
            ].map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); handleSearch(q); }}
                className="rounded-md border border-[#E1D9C9] bg-white px-2.5 py-1 text-xs text-[#59634F] transition hover:border-[#6F7864] hover:text-[#23372B] hover:bg-[#EEE9DF]"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      {searched && results.length === 0 && !searching && (
        <div className="rounded-lg border border-[#E1D9C9] bg-white py-12 text-center text-xs text-[#59634F]">{t.search.noResults}</div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <Link
              key={r.bookmark.id}
              href={`/bookmarks/${r.bookmark.id}`}
              className="block rounded-lg border border-[#E1D9C9] bg-white p-4 transition hover:border-[#48664E] hover:bg-[#F8F7F2] group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#23372B] group-hover:text-[#48664E] transition-colors">{r.bookmark.title ?? '(untitled)'}</div>
                  <div className="truncate text-xs text-[#59634F] mt-0.5">{r.bookmark.url}</div>
                  {r.bookmark.summary && <div className="mt-2 line-clamp-2 text-xs leading-5 text-[#59634F]">{r.bookmark.summary}</div>}
                  {r.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {r.tags.map((tg) => (
                        <span key={tg} className="rounded bg-[#F1EBDD] px-1.5 py-0.5 text-xs font-medium text-[#48664E]">#{tg}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-[10px] text-[#6F7864] font-medium">{r.matchReason}</div>
                </div>
                <div className="shrink-0 rounded bg-[#F1EBDD] px-2 py-0.5 text-xs font-semibold text-[#48664E]">{Math.round(r.score * 100)}%</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
