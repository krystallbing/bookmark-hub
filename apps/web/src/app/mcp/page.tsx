'use client';

import { useI18n } from '@/lib/i18n';

export default function MCPPage() {
  const { t, locale } = useI18n();

  const toolNames = [
    'search_bookmarks',
    'read_bookmark',
    'list_tags',
    'list_folders',
    'find_related_bookmarks',
    'summarize_collection',
    'save_bookmark',
    'run_bookmark_rescue',
    'get_bookmark_stats',
  ] as const;

  const claudeConfig = `{
  "mcpServers": {
    "bookmark-hub": {
      "command": "node",
      "args": ["/path/to/BookmarkHub/apps/mcp-server/dist/index.js"]
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "bookmark-hub": {
      "command": "node",
      "args": ["/path/to/BookmarkHub/apps/mcp-server/dist/index.js"]
    }
  }
}`;

  return (
    <div className="max-w-[800px] mx-auto space-y-4">
      <header className="rounded-lg border border-[#E1D9C9] bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#48664E]">{locale === 'en' ? 'MCP Memory' : 'MCP 记忆接口'}</p>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-[#23372B]">{t.mcp.title}</h1>
        <p className="mt-1.5 text-xs leading-5 text-[#59634F]">{t.mcp.desc}</p>
      </header>

      <section className="rounded-lg border border-[#E1D9C9] bg-white p-4">
        <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider mb-2">{t.mcp.startServer}</h2>
        <p className="text-xs text-[#59634F] mb-3">{t.mcp.startDesc}</p>
        <code className="block px-3 py-2 rounded-md bg-[#EEE9DF] border border-[#E1D9C9] text-xs font-mono text-[#23372B]">
          npx bookmark-hub mcp
        </code>
      </section>

      <section className="rounded-lg border border-[#E1D9C9] bg-white p-4">
        <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider mb-2">{t.mcp.claudeConfig}</h2>
        <p className="text-xs text-[#59634F] mb-3">
          {t.mcp.claudeConfigDesc} <code className="text-[11px] bg-[#EEE9DF] border border-[#E1D9C9] px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>:
        </p>
        <pre className="px-3 py-2 rounded-md bg-[#EEE9DF] border border-[#E1D9C9] text-xs font-mono overflow-x-auto text-[#23372B]">
          {claudeConfig}
        </pre>
      </section>

      <section className="rounded-lg border border-[#E1D9C9] bg-white p-4">
        <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider mb-2">{t.mcp.cursorConfig}</h2>
        <p className="text-xs text-[#59634F] mb-3">
          {t.mcp.cursorConfigDesc} <code className="text-[11px] bg-[#EEE9DF] border border-[#E1D9C9] px-1 py-0.5 rounded">.cursor/mcp.json</code>:
        </p>
        <pre className="px-3 py-2 rounded-md bg-[#EEE9DF] border border-[#E1D9C9] text-xs font-mono overflow-x-auto text-[#23372B]">
          {cursorConfig}
        </pre>
      </section>

      <section className="rounded-lg border border-[#E1D9C9] bg-white p-4">
        <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider mb-3">{t.mcp.tools}</h2>
        <div className="space-y-2">
          {toolNames.map((name) => (
            <div key={name} className="flex items-start gap-3">
              <code className="text-[11px] bg-[#EEE9DF] text-[#26372D] px-1.5 py-0.5 rounded font-mono shrink-0 font-medium border border-[#E1D9C9]/50">
                {name}
              </code>
              <span className="text-xs text-[#59634F] mt-0.5">{t.mcp.toolDescs[name]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
