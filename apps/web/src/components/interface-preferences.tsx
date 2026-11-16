'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

type Theme = 'green' | 'blue';

export function InterfacePreferences({
  assistantShortcut,
  onAssistantShortcutChange,
}: {
  assistantShortcut: boolean;
  onAssistantShortcutChange: (enabled: boolean) => void;
}) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('green');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    if (!open) setTheme(document.documentElement.dataset.theme === 'blue' ? 'blue' : 'green');
    setOpen(!open);
  }

  function changeTheme(value: Theme) {
    setTheme(value);
    localStorage.setItem('bookmark-hub-theme', value);
    document.documentElement.setAttribute('data-theme', value);
  }

  const en = locale === 'en';
  return (
    <div ref={containerRef} className="sm:relative">
      <button ref={buttonRef} type="button" onClick={toggleOpen} aria-expanded={open} aria-controls="interface-preferences" aria-label={en ? 'Interface preferences' : '界面偏好'} title={en ? 'Interface preferences' : '界面偏好'} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E1D9C9] bg-white text-[#26372D] transition hover:bg-[#EEE9DF]">
        <svg aria-hidden="true" width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h3m4 0h7M3 14h7m4 0h3" />
          <circle cx="8" cy="6" r="2" />
          <circle cx="12" cy="14" r="2" />
        </svg>
      </button>
      {open && (
        <div id="interface-preferences" role="group" aria-label={en ? 'Interface preferences' : '界面偏好'} className="absolute right-4 top-[calc(100%+10px)] z-50 max-h-[calc(100dvh-5rem)] w-[min(300px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-[#E1D9C9] bg-white p-5 text-[#23372B] shadow-xl sm:right-0">
          <h2 className="text-sm font-bold">{en ? 'Interface preferences' : '界面偏好'}</h2>
          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs font-semibold"><span aria-hidden="true" className="material-symbols-outlined !text-[18px]">language</span>{en ? 'Language' : '界面语言'}</div>
            <div className="mt-2 grid grid-cols-2 rounded-md border border-[#E1D9C9] p-0.5" role="group" aria-label={en ? 'Language' : '界面语言'}>
              {([{ value: 'zh', label: '简体中文' }, { value: 'en', label: 'English' }] as const).map(({ value, label }) => (
                <button key={value} type="button" aria-pressed={locale === value} onClick={() => setLocale(value)} className={`rounded px-2 py-2 text-xs transition ${locale === value ? 'bg-[#EEE9DF] font-semibold text-[#23372B]' : 'text-[#59634F] hover:bg-[#F8F7F2]'}`}>
                  {label}{locale === value ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 border-t border-[#E1D9C9] pt-4">
            <div className="flex items-center gap-2 text-xs font-semibold"><span aria-hidden="true" className="material-symbols-outlined !text-[18px]">palette</span>{en ? 'Appearance' : '界面外观'}</div>
            <div className="mt-3 grid grid-cols-2 gap-3" role="group" aria-label={en ? 'Appearance' : '界面外观'}>
              {(['green', 'blue'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={theme === value} onClick={() => changeTheme(value)} className="min-w-0 text-center text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664E]">
                  <span className={`relative block overflow-hidden rounded-md border-2 p-1 ${theme === value ? 'border-[#48664E]' : 'border-[#E1D9C9]'}`}>
                    <span aria-hidden="true" className="flex h-14 overflow-hidden rounded-sm" style={{ backgroundColor: value === 'green' ? '#f8f7f2' : '#f5f8fd' }}>
                      <span className="w-1/4" style={{ backgroundColor: value === 'green' ? '#23372b' : '#d5e6ff' }} />
                      <span className="flex flex-1 flex-col gap-1 p-1.5"><span className="h-1.5 w-3/5 rounded" style={{ backgroundColor: value === 'green' ? '#e1d9c9' : '#bfd8fa' }} /><span className="h-1 w-full rounded" style={{ backgroundColor: value === 'green' ? '#eee9df' : '#e4efff' }} /><span className="h-1 w-4/5 rounded" style={{ backgroundColor: value === 'green' ? '#eee9df' : '#e4efff' }} /></span>
                    </span>
                    {theme === value && <span aria-hidden="true" className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#294435] text-[11px] text-white">✓</span>}
                  </span>
                  <span className="mt-1.5 block">{value === 'green' ? (en ? 'Green & cream' : '深绿暖白') : (en ? 'White & blue' : '白蓝')}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 border-t border-[#E1D9C9] pt-4 text-xs font-semibold">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="material-symbols-outlined !text-[18px]">auto_awesome</span>
              {en ? 'Show floating AI assistant shortcut' : '显示AI助手悬浮球'}
            </span>
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={assistantShortcut}
              onChange={(event) => onAssistantShortcutChange(event.target.checked)}
            />
            <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-[#E1D9C9] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:bg-[#294435] peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#48664E]" />
          </label>
        </div>
      )}
    </div>
  );
}
