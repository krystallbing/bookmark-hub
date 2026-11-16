'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { WelcomeCard } from '@/components/welcome-card';

interface Stats {
  bookmarks: number;
  folders: number;
  tags: number;
  duplicates: number;
  broken: number;
  missingSummaries: number;
  missingTags: number;
}

type HomeIconName =
  | 'bookmark'
  | 'check'
  | 'chevron'
  | 'cloud'
  | 'download'
  | 'folder'
  | 'list'
  | 'search'
  | 'shield'
  | 'sparkles'
  | 'tag';

const emptyStats: Stats = {
  bookmarks: 0,
  folders: 0,
  tags: 0,
  duplicates: 0,
  broken: 0,
  missingSummaries: 0,
  missingTags: 0,
};

export default function Dashboard() {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeRequested = useRef(false);
  const displayStats = stats ?? emptyStats;

  useEffect(() => {
    if (welcomeRequested.current) return;
    welcomeRequested.current = true;
    fetch('/api/welcome', { method: 'POST' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setShowWelcome(data.showWelcome === true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      try {
        const [statsRes, suggestionsRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/suggestions?status=pending&limit=1'),
        ]);
        const [statsData, suggestionsData] = await Promise.all([
          statsRes.json(),
          suggestionsRes.json(),
        ]);
        if (cancelled) return;
        setStats(statsData);
        setPendingSuggestions(Number(suggestionsData.total ?? 0));
      } catch {
        if (cancelled) return;
        setStats(emptyStats);
        setPendingSuggestions(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    window.addEventListener('focus', loadDashboard);
    window.addEventListener('bookmark-hub:suggestions-changed', loadDashboard);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadDashboard);
      window.removeEventListener('bookmark-hub:suggestions-changed', loadDashboard);
    };
  }, []);

  const todaySuggestions = useMemo(() => {
    const brokenText = displayStats.broken > 0
      ? (locale === 'en' ? `${displayStats.broken} broken links need attention` : `发现 ${displayStats.broken} 个无效链接，建议修复`)
      : (locale === 'en' ? 'No broken links found' : '未发现无效链接');
    const tagText = displayStats.missingTags > 0
      ? (locale === 'en' ? `Add tags to ${displayStats.missingTags} untagged bookmarks` : `为 ${displayStats.missingTags} 个未标记书签补充标签`)
      : (locale === 'en' ? 'Tags are organized' : '标签状态已整理');
    const backupText = pendingSuggestions > 0
      ? (locale === 'en' ? `${pendingSuggestions} suggestions are pending` : `还有 ${pendingSuggestions} 条建议待处理`)
      : (locale === 'en' ? 'Local data is saved' : '本地数据已保存');

    return [
      { href: displayStats.broken > 0 ? '/broken' : '/rescue', text: brokenText, active: displayStats.broken > 0 },
      { href: '/tags', text: tagText, active: displayStats.missingTags > 0 },
      { href: pendingSuggestions > 0 ? '/rescue' : '/library', text: backupText, active: pendingSuggestions > 0 },
    ];
  }, [displayStats.broken, displayStats.missingTags, pendingSuggestions, locale]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <section className={`mb-6 grid gap-6 ${showWelcome ? 'xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]' : ''}`}>
        {showWelcome && <WelcomeCard />}

        <aside className="rounded-lg border border-[#E1D9C9] bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <HomeIcon name="sparkles" className="text-[18px] text-[#48664E]" />
            <h2 className="text-base font-semibold text-[#23372B]">{t.dashboard.todaySuggestions}</h2>
          </div>
          <div className="overflow-hidden rounded-md border border-[#E1D9C9]">
            {todaySuggestions.map((item, index) => (
              <Link
                key={item.text}
                href={item.href}
                className="flex min-h-[48px] items-center gap-3 border-b border-[#E1D9C9] px-4 text-sm font-medium text-[#59634F] transition last:border-b-0 hover:bg-[#EEE9DF] hover:text-[#23372B]"
              >
                <HomeIcon name="check" className={`text-sm shrink-0 ${item.active || index === 0 ? 'text-[#48664E]' : 'text-[#c0c7d4]'}`} />
                <span className="min-w-0 flex-1">{item.text}</span>
                <HomeIcon name="chevron" className="text-sm shrink-0 text-[#6F7864]" />
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="bookmark" tone="blue" value={displayStats.bookmarks} label={t.dashboard.stats.bookmarks} loading={loading} />
          <StatTile icon="folder" tone="green" value={displayStats.folders} label={t.dashboard.stats.folders} loading={loading} />
        <StatTile icon="tag" tone="purple" value={displayStats.tags} label={t.dashboard.stats.tags} loading={loading} />
          <StatTile icon="list" tone="orange" value={pendingSuggestions} label={t.dashboard.stats.pendingSuggestions} loading={loading} />
      </section>

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ActionTile
          href="/import"
          icon="download"
          tone="blue"
          title={t.dashboard.actions.import}
            description={t.dashboard.actions.importDesc}
          cta={t.import.importBtn}
        />
        <ActionTile
          href="/search"
          icon="search"
          tone="green"
          title={t.dashboard.actions.search}
            description={t.dashboard.actions.searchDesc}
            cta={t.search.searchBtn}
        />
        <ActionTile
          href="/rescue"
          icon="sparkles"
          tone="green"
          title={t.dashboard.actions.rescue}
            description={t.dashboard.actions.rescueDesc}
          cta={t.rescue.runScan}
        />
        <ActionTile
          href="/rescue"
          icon="cloud"
          tone="blue"
          title={t.dashboard.actions.syncPlan}
            description={t.dashboard.actions.syncPlanDesc}
          cta={t.rescue.syncToChrome}
        />
      </section>

      <Link
        href="/settings"
        className="flex flex-col gap-4 rounded-lg border border-[#E1D9C9] bg-white px-5 py-4 transition hover:bg-[#EEE9DF] md:flex-row md:items-center md:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <HomeIcon name="shield" className="text-[20px] shrink-0 text-[#6F7864]" />
          <div>
            <div className="text-xs font-normal text-[#23372B]">{t.dashboard.localData}</div>
            <div className="mt-0.5 text-[11px] text-[#59634F]">{t.dashboard.localDataDesc}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#59634F]">
          <span className="inline-flex items-center gap-2 text-[#23372B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#157347]" />
            {t.dashboard.systemStatus}
          </span>
          <span className="hidden h-6 w-px bg-[#E1D9C9] md:inline" />
          <span>{t.dashboard.lastCheck} {formatTime(new Date())}</span>
          <HomeIcon name="chevron" className="text-[15px] text-[#6F7864]" />
        </div>
      </Link>
    </div>
  );
}

function StatTile({
  icon,
  tone,
  value,
  label,
  loading,
}: {
  icon: HomeIconName;
  tone: ToneName;
  value: number;
  label: string;
  loading: boolean;
}) {
  return (
    <div className="bg-[#eeeeec] border border-[#E1D9C9] rounded-lg p-4 flex flex-col justify-between min-h-[92px]">
      <div className="flex items-center gap-1.5 mb-2 text-[#59634F]">
        <HomeIcon name={icon} className="text-sm" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-2xl font-bold text-[#23372B]">
        {loading ? '...' : value.toLocaleString()}
      </span>
    </div>
  );
}

function ActionTile({
  href,
  icon,
  tone,
  title,
  description,
  cta,
}: {
  href: string;
  icon: HomeIconName;
  tone: ToneName;
  title: string;
  description: string;
  cta: string;
}) {
  const classes: Record<ToneName, string> = {
    blue: 'bg-[#E1D9C9] text-[#001c39]',
    green: 'bg-[#EDE6D6] text-[#59634F]',
    orange: 'bg-[#E1D9C9] text-[#23372B]',
    purple: 'bg-[#a4c9ff] text-[#001c39]',
  };

  return (
    <Link
      href={href}
      className="block min-h-[148px] rounded-lg border border-[#E1D9C9] bg-white p-5 transition hover:bg-[#EEE9DF] group"
    >
      <div className="flex gap-4">
        <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${classes[tone]}`}>
          <HomeIcon name={icon} className="text-lg" filled />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[#23372B] mb-1">{title}</h3>
          <p className="text-xs leading-5 text-[#59634F] mb-2">{description}</p>
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-[#48664E]">
            {cta}
            <span aria-hidden>→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

type ToneName = 'blue' | 'green' | 'orange' | 'purple';

function IconBadge({ icon, tone }: { icon: HomeIconName; tone: ToneName }) {
  const classes: Record<ToneName, string> = {
    blue: 'bg-[#F1EBDD] text-[#48664E]',
    green: 'bg-[#f0fff4] text-[#157347]',
    orange: 'bg-[#fffae5] text-[#b54708]',
    purple: 'bg-[#EEE9DF] text-[#26372D]',
  };

  return (
    <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-3xl ${classes[tone]}`}>
      <HomeIcon name={icon} className="h-7 w-7" />
    </span>
  );
}

function HomeIcon({ name, className = '', filled = false }: { name: HomeIconName; className?: string; filled?: boolean }) {
  const iconMap: Record<HomeIconName, string> = {
    bookmark: 'bookmark',
    check: 'check_circle',
    chevron: 'chevron_right',
    cloud: 'sync',
    download: 'download',
    folder: 'folder',
    list: 'inbox',
    search: 'search_insights',
    shield: 'shield',
    sparkles: 'auto_awesome',
    tag: 'label',
  };

  const iconName = iconMap[name] || 'bookmark';

  return (
    <span 
      className={`material-symbols-outlined shrink-0 flex items-center justify-center ${className} ${filled ? 'filled' : ''}`}
      style={{ fontSize: 'inherit', fontVariationSettings: filled ? "'FILL' 1" : undefined }}
    >
      {iconName}
    </span>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
