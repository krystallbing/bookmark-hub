'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, type FormEvent, type ReactNode } from 'react';
import { localizedError, useI18n } from '@/lib/i18n';
import { InterfacePreferences } from '@/components/interface-preferences';

const ASSISTANT_SHORTCUT_KEY = 'bookmark-hub-assistant-shortcut';

interface StatsRecord {
  bookmarks: number;
  folders: number;
  tags: number;
  duplicates: number;
  broken: number;
  missingSummaries: number;
  missingTags: number;
}

type ShellIconName =
  | 'archive'
  | 'bell'
  | 'book'
  | 'box'
  | 'chevron'
  | 'clock'
  | 'download'
  | 'folder'
  | 'home'
  | 'help'
  | 'link'
  | 'search'
  | 'settings'
  | 'tag'
  | 'trash';

interface IndexingStatus {
  active: boolean;
  done: number;
  total: number;
  currentTitle: string;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t } = useI18n();
  const [stats, setStats] = useState<StatsRecord | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>({
    active: false,
    done: 0,
    total: 0,
    currentTitle: '',
  });
  const [startingIndex, setStartingIndex] = useState(false);
  const rescueCount = pendingSuggestions;

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const [ballVisible, setBallVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const mouseDownTime = useRef(0);

  useEffect(() => {
    // Restore the browser's saved shortcut preference after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBallVisible(localStorage.getItem(ASSISTANT_SHORTCUT_KEY) === 'true');
  }, []);

  function changeAssistantShortcut(enabled: boolean) {
    setBallVisible(enabled);
    localStorage.setItem(ASSISTANT_SHORTCUT_KEY, String(enabled));
  }

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 60, e.clientX - dragOffset.current.x)),
        y: Math.max(10, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)),
      });
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left click only
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    mouseDownTime.current = Date.now();
    setIsDragging(true);
  };

  const handleButtonClick = () => {
    // If it was held/dragged for less than 200ms, toggle open chat
    const clickDuration = Date.now() - mouseDownTime.current;
    if (clickDuration < 200) {
      setChatOpen(true);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('bookmark-hub:chat-messages');
    if (stored) {
      try {
        // Restoring browser-local chat history is an intentional external-state sync.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse chat messages', e);
      }
    }
  }, []);

  function handleClearChat() {
    if (window.confirm(locale === 'en' ? 'Clear all Bookmark Assistant chat history?' : '确定要清空所有书签助手的聊天记录吗？')) {
      setMessages([]);
      localStorage.removeItem('bookmark-hub:chat-messages');
    }
  }

  function handleNewChat() {
    setMessages([]);
    localStorage.removeItem('bookmark-hub:chat-messages');
  }

  async function handleSendMessage(e?: FormEvent) {
    if (e) e.preventDefault();
    const query = chatInput.trim();
    if (!query || chatSending) return;

    const userMessage = { role: 'user' as const, content: query };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    localStorage.setItem('bookmark-hub:chat-messages', JSON.stringify(newMessages));
    setChatInput('');
    setChatSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, locale === 'en' ? 'Bookmark Assistant failed to respond.' : '书签助手响应失败。'));

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: data.message }];
      if (data.suggestionsChanged) window.dispatchEvent(new Event('bookmark-hub:suggestions-changed'));
      setMessages(finalMessages);
      localStorage.setItem('bookmark-hub:chat-messages', JSON.stringify(finalMessages));
    } catch (err) {
      const errorMessages = [...newMessages, { role: 'assistant' as const, content: `${locale === 'en' ? 'Error' : '错误'}: ${localizedError(locale, err, locale === 'en' ? 'Bookmark Assistant failed to respond.' : '书签助手响应失败。')}` }];
      setMessages(errorMessages);
      localStorage.setItem('bookmark-hub:chat-messages', JSON.stringify(errorMessages));
    } finally {
      setChatSending(false);
    }
  }

  async function handleSendExample(text: string) {
    const userMessage = { role: 'user' as const, content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    localStorage.setItem('bookmark-hub:chat-messages', JSON.stringify(newMessages));
    setChatSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, locale === 'en' ? 'Bookmark Assistant failed to respond.' : '书签助手响应失败。'));

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: data.message }];
      setMessages(finalMessages);
      localStorage.setItem('bookmark-hub:chat-messages', JSON.stringify(finalMessages));
    } catch (err) {
      const errorMessages = [...newMessages, { role: 'assistant' as const, content: `${locale === 'en' ? 'Error' : '错误'}: ${localizedError(locale, err, locale === 'en' ? 'Bookmark Assistant failed to respond.' : '书签助手响应失败。')}` }];
      setMessages(errorMessages);
      localStorage.setItem('bookmark-hub:chat-messages', JSON.stringify(errorMessages));
    } finally {
      setChatSending(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadShellData() {
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
        setStats(null);
        setPendingSuggestions(undefined);
      }
    }

    loadShellData();
    window.addEventListener('focus', loadShellData);
    window.addEventListener('bookmark-hub:suggestions-changed', loadShellData);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadShellData);
      window.removeEventListener('bookmark-hub:suggestions-changed', loadShellData);
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(checkStatus, 3000);

    async function checkStatus() {
      try {
        const res = await fetch('/api/index-bookmarks/status');
        const data: IndexingStatus = await res.json();
        setIndexingStatus(data);

        if (data.active) {
          const statsRes = await fetch('/api/stats');
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch {
        // Ignore polling errors
      }
    }

    checkStatus();

    return () => clearInterval(intervalId);
  }, []);

  async function triggerBackgroundIndexing() {
    setStartingIndex(true);
    try {
      await fetch('/api/index-bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, onlyMissing: true, useAI: true, background: true }),
      });
      const res = await fetch('/api/index-bookmarks/status');
      const data: IndexingStatus = await res.json();
      setIndexingStatus(data);
    } catch {
      // Ignore
    } finally {
      setStartingIndex(false);
    }
  }

  const [stoppingIndex, setStoppingIndex] = useState(false);

  async function stopBackgroundIndexing() {
    setStoppingIndex(true);
    try {
      await fetch('/api/index-bookmarks', { method: 'DELETE' });
    } catch {
      // Ignore
    } finally {
      setStoppingIndex(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="min-h-screen bg-[#F8F7F2] text-[#23372B]">
      <aside className="fixed inset-y-3 left-3 z-20 hidden w-[188px] overflow-y-auto rounded-lg border border-[#23372B] bg-[#23372B] lg:flex lg:flex-col">
        <div className="flex h-[62px] items-center justify-start gap-2 px-4">
          <Image src="/bookmark-hub-icon.svg" alt="" width={25} height={30} className="shrink-0" />
          <span
            className={`whitespace-nowrap leading-none ${locale === 'zh'
              ? 'font-sans text-[18px] font-black tracking-[0.06em] text-white'
              : 'font-sans text-[17px] font-black tracking-[-0.03em] text-white'}`}
            style={locale === 'zh' ? { fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif' } : undefined}
          >
            {t.nav.brandName}
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3">
          <ShellNavItem href="/" icon="home" label={t.nav.dashboard} active={pathname === '/'} />
          <ShellNavItem
            href="/rescue"
            icon="archive"
            label={t.nav.rescue}
            count={rescueCount}
            active={pathname.startsWith('/rescue')}
          />
          <ShellNavItem href="/library" icon="book" label={t.nav.library} active={pathname.startsWith('/library') || pathname.startsWith('/bookmarks')} />
          <ShellNavItem href="/search" icon="search" label={t.nav.search} active={pathname.startsWith('/search')} />
          <ShellNavItem href="/tags" icon="tag" label={t.nav.tags} active={pathname.startsWith('/tags')} />

          <ShellSectionLabel label={t.nav.dataSection} />
          <ShellNavItem href="/import" icon="download" label={t.nav.importNav} active={pathname.startsWith('/import')} />
          <ShellNavItem href="/folders" icon="folder" label={t.nav.folders} active={pathname.startsWith('/folders')} />
        </nav>

        <div className="mx-3 mb-3 rounded border border-white/10 bg-white/10 p-2.5 text-xs text-[#DFE8DE]">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-wider text-[#C4D4C5] uppercase">
            <span>{t.nav.statusSection}</span>
            <div className="flex items-center gap-1.5">
              {indexingStatus.active && (
                <span className="text-[9px] font-medium text-[#DFE8DE] animate-pulse lowercase font-mono">
                  {locale === 'en' ? 'AI analyzing...' : 'AI 分析中...'}
                </span>
              )}
              <span className={`h-1.5 w-1.5 rounded-full ${indexingStatus.active ? 'animate-pulse bg-[#A3B18A]' : 'bg-[#A3B18A]'}`} />
            </div>
          </div>

          {indexingStatus.active ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-[#DFE8DE]">
                <span>{t.nav.progress}</span>
                <span className="font-mono font-semibold">
                  {indexingStatus.total > 0 ? `${Math.round((indexingStatus.done / indexingStatus.total) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#EEE9DF]">
                <div
                  className="h-full bg-[#AF9E73] transition-all duration-300"
                  style={{
                    width: `${indexingStatus.total > 0 ? Math.min(100, Math.round((indexingStatus.done / indexingStatus.total) * 100)) : 0}%`,
                  }}
                />
              </div>
              <button
                onClick={stopBackgroundIndexing}
                disabled={stoppingIndex}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-[#E1D9C9] bg-white py-1 text-[10px] font-medium text-[#26372D] transition hover:bg-[#EEE9DF] disabled:opacity-50"
              >
                {stoppingIndex ? t.nav.pausing : t.nav.pause}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className={`material-symbols-outlined !text-[13px] ${stats && stats.broken > 0 ? 'text-[#FFC4B9]' : 'text-[#C4D4C5]'}`}>
                  {stats && stats.broken > 0 ? 'link_off' : 'link'}
                </span>
                <span className={stats && stats.broken > 0 ? 'font-medium text-[#FFC4B9]' : ''}>
                  {stats ? t.nav.brokenCount(stats.broken) : t.nav.loadingStats}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined !text-[13px] text-[#C4D4C5]">
                  description
                </span>
                <span>
                  {stats ? t.nav.missingSummariesCount(stats.missingSummaries) : t.nav.aiDefaultLabel}
                </span>
              </div>

              {stats && stats.missingSummaries > 0 && (
                <button
                  onClick={triggerBackgroundIndexing}
                  disabled={startingIndex}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-[#E1D9C9] bg-white py-1 text-[10px] font-medium text-[#26372D] transition hover:bg-[#EEE9DF] disabled:opacity-50"
                >
                  {startingIndex ? t.nav.starting : t.nav.resumeAI}
                </button>
              )}
            </>
          )}
        </div>

        <div className="space-y-1 border-t border-white/20 px-2 py-3">
          <ShellNavItem href="/settings" icon="settings" label={t.nav.aiCenter} compact active={pathname.startsWith('/settings')} />
          <ShellNavItem href="/mcp" icon="link" label={t.nav.mcpInterface} compact active={pathname.startsWith('/mcp')} />
          <ShellNavItem href="/help" icon="help" label={t.nav.helpGuide} compact active={pathname.startsWith('/help')} />
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[212px] flex flex-col md:flex-row">
        <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#E1D9C9] bg-[#F8F7F2]/90 px-4 backdrop-blur md:px-6">
          <form onSubmit={submitSearch} className="flex h-9 min-w-0 flex-1 max-w-[540px] items-center gap-2.5 rounded-md border border-[#E1D9C9] bg-[#EEE9DF] px-3 transition focus-within:border-[#23372B] focus-within:bg-white">
            <ShellIcon name="search" className="text-[18px] text-[#6F7864]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.nav.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#6F7864]"
            />
            <span className="hidden shrink-0 rounded border border-[#E1D9C9] bg-[#EEE9DF] px-1.5 py-0.5 text-[11px] font-medium text-[#59634F] lg:inline">⌘ K</span>
          </form>

          <div className="ml-4 flex shrink-0 items-center gap-2">
            <InterfacePreferences assistantShortcut={ballVisible} onAssistantShortcutChange={changeAssistantShortcut} />

            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="flex h-9 items-center gap-1.5 rounded-md border border-[#E1D9C9] bg-white px-3 text-xs font-medium text-[#26372D] transition hover:bg-[#EEE9DF]"
              aria-label={t.nav.summonAssistant}
              title={t.nav.summonAssistant}
            >
              <span className="material-symbols-outlined !text-[16px] text-[#23372B]">auto_awesome</span>
              <span className="hidden sm:inline">{t.nav.summonAssistant}</span>
            </button>
            <Link href="/import" className="hidden h-9 items-center gap-2 rounded-md bg-[#AF9E73] px-4 text-xs font-medium text-[#23372B] transition hover:bg-[#AE9B70] sm:flex">
              <ShellIcon name="download" className="text-[16px]" />
              {t.nav.import}
            </Link>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8">
          {children}
        </main>
      </div>

      {/* AI Assistant Chat Sidebar */}
      {chatOpen && (
        <aside className="flex h-[70vh] w-full shrink-0 flex-col border-t border-[#E1D9C9] bg-white md:sticky md:top-0 md:h-screen md:w-80 md:border-l md:border-t-0">
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-[#E1D9C9] px-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined !text-[18px] text-[#59634F]">auto_awesome</span>
              <span className="text-sm font-semibold text-[#23372B]">{t.nav.aiAssistant}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleNewChat}
                className="grid h-7 w-7 place-items-center rounded border border-[#E1D9C9] text-[#6F7864] hover:bg-[#eeeeec] hover:text-[#23372B] transition"
                title={locale === 'zh' ? '新建会话' : 'New Chat'}
              >
                <span className="material-symbols-outlined !text-[18px]">add</span>
              </button>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="grid h-7 w-7 place-items-center rounded border border-[#E1D9C9] text-[#6F7864] hover:bg-[#ffdad6] hover:text-[#ba1a1a] transition"
                  title={locale === 'zh' ? '清空聊天记录' : 'Clear Chat History'}
                >
                  <span className="material-symbols-outlined !text-[18px]">delete</span>
                </button>
              )}
              <button
                onClick={() => setChatOpen(false)}
                className="grid h-7 w-7 place-items-center rounded border border-[#E1D9C9] text-[#6F7864] hover:bg-[#eeeeec] hover:text-[#23372B] transition"
                title={locale === 'zh' ? '关闭' : 'Close'}
              >
                <span className="material-symbols-outlined !text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs leading-5">
            {messages.length === 0 ? (
              <div className="text-center text-muted py-8 text-xs text-[#59634F]">
                <p>{locale === 'zh' ? '👋 你好！我是你的书签助手。' : '👋 Hello! I am your Bookmark Assistant.'}</p>
                <p className="mt-2">{locale === 'zh' ? '你可以问我关于书签库状态或整理建议的问题，例如：' : 'You can ask me questions about your bookmarks or organization suggestions, such as:'}</p>
                <div className="mt-4 flex flex-col gap-2">
                  <button 
                    onClick={() => handleSendExample(locale === 'zh' ? '当前有哪些待处理的建议？' : 'What are the current pending suggestions?')}
                    className="rounded border border-[#E1D9C9] bg-white p-2 text-left hover:bg-[#EEE9DF] text-xs text-[#59634F]"
                  >
                    {locale === 'zh' ? '🔍 当前有哪些待处理的建议？' : '🔍 What are the current pending suggestions?'}
                  </button>
                  <button 
                    onClick={() => handleSendExample(locale === 'zh' ? '里面有哪些是失效链接（坏链）？' : 'Which ones are broken links?')}
                    className="rounded border border-[#E1D9C9] bg-white p-2 text-left hover:bg-[#EEE9DF] text-xs text-[#59634F]"
                  >
                    {locale === 'zh' ? '🔗 里面有哪些是失效链接（坏链）？' : '🔗 Which ones are broken links?'}
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-[#23372B] text-white'
                      : 'bg-[#eeeeec] text-[#23372B] border border-[#E1D9C9]'
                  }`}>
                    <div className="whitespace-pre-wrap">{formatChatMessage(msg.content)}</div>
                  </div>
                </div>
              ))
            )}
            {chatSending && (
              <div className="flex items-start">
                <div className="max-w-[90%] rounded-lg px-3 py-2 bg-[#eeeeec] text-[#23372B] border border-[#E1D9C9] animate-pulse">
                  {locale === 'zh' ? 'AI 正在思考中...' : 'AI is thinking...'}
                </div>
              </div>
            )}
          </div>

          {/* Input form */}
          <form onSubmit={handleSendMessage} className="border-t border-[#E1D9C9] p-3 flex gap-2 bg-[#EEE9DF]/50">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={locale === 'zh' ? '输入你的问题...' : 'Type your question...'}
              className="h-8 flex-1 min-w-0 rounded border border-[#E1D9C9] bg-white px-2.5 text-xs outline-none focus:border-[#23372B] text-[#23372B]"
              disabled={chatSending}
            />
            <button
              type="submit"
              disabled={chatSending || !chatInput.trim()}
              className="h-8 rounded bg-[#294435] text-white px-3 text-xs font-semibold hover:bg-[#1F3228] transition disabled:opacity-50"
            >
              {locale === 'zh' ? '发送' : 'Send'}
            </button>
          </form>
        </aside>
      )}

      </div>

      {/* Floating button */}
      {!chatOpen && ballVisible && (
        <div
          style={position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
          className={`fixed z-40 h-12 w-12 select-none group ${position ? '' : 'bottom-6 right-6'}`}
        >
          {/* Draggable floating ball */}
          <div
            onMouseDown={handleMouseDown}
            onClick={handleButtonClick}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-transparent bg-[#AF9E73] text-[#23372B] shadow-lg transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#AE9B70] cursor-grab active:cursor-grabbing overflow-hidden relative"
            title={locale === 'zh' ? '点击打开书签助手 (按住可拖动位置)' : 'Click to open Bookmark Assistant (Hold to drag)'}
          >
            {/* Flow background circle */}
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#AE9B70] rounded-full opacity-0 group-hover:w-16 group-hover:h-16 group-hover:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] z-0 pointer-events-none"></span>

            {/* Icon */}
            <span className="material-symbols-outlined text-[24px] relative z-10 transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:rotate-180 text-[#23372B]">auto_awesome</span>
          </div>

          {/* Close button to hide the ball (very light gray, only visible on hover, sits outside overflow-hidden) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              changeAssistantShortcut(false);
            }}
            className="absolute -right-1 -top-1 z-50 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-[#E1D9C9] bg-[#EEE9DF]/90 text-[#6F7864] shadow hover:bg-[#eeeeec] opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
            title={locale === 'zh' ? '隐藏悬浮球' : 'Hide Assistant Ball'}
          >
            <span className="material-symbols-outlined !text-[11px] font-bold">close</span>
          </button>
        </div>
      )}
    </div>
  );
}

function formatChatMessage(content: string): string {
  return content
    .replace(/```[a-zA-Z0-9_-]*\n?/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, '')
    .replace(/^\s*[*+-]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ShellSectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[#C4D5C7] first:pt-0">
      {label}
    </div>
  );
}

function ShellNavItem({
  href,
  icon,
  label,
  active = false,
  compact = false,
  count,
}: {
  href: string;
  icon: ShellIconName;
  label: string;
  active?: boolean;
  compact?: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex h-9 items-center gap-2 rounded-md px-2 ${compact ? 'text-xs' : 'text-sm'} transition ${
        active
          ? 'bg-[#EDE6D6] font-bold text-[#59634F]'
          : compact
            ? 'text-[#F8F7F2] hover:bg-[#48664E]'
            : 'text-[#F8F7F2] hover:bg-[#48664E]'
      }`}
    >
      <ShellIcon name={icon} className={`!text-[18px] ${active ? 'text-[#23372B]' : 'text-[#D3E3D5]'}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-[#E1D9C9] px-2 py-0.5 text-xs font-semibold text-[#001c39]">{count}</span>
      )}
    </Link>
  );
}

function ShellIcon({ name, className = '' }: { name: ShellIconName; className?: string }) {
  const iconMap: Record<ShellIconName, string> = {
    archive: 'auto_awesome',
    bell: 'notifications',
    book: 'bookmark',
    box: 'inventory_2',
    chevron: 'expand_more',
    clock: 'schedule',
    download: 'download',
    folder: 'folder',
    home: 'home',
    help: 'help_outline',
    link: 'link',
    search: 'search',
    settings: 'settings',
    tag: 'label',
    trash: 'delete',
  };

  const iconName = iconMap[name] || 'bookmark';

  return (
    <span className={`material-symbols-outlined shrink-0 flex items-center justify-center ${className}`}>
      {iconName}
    </span>
  );
}
