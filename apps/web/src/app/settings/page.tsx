'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AIProviderConfig } from '@bookmark-hub/shared';
import { localizedError, useI18n } from '@/lib/i18n';

interface Settings {
  aiProvider: AIProviderConfig;
  enableContentFetching: boolean;
  enableBrokenLinkChecking: boolean;
  enableMcpServer: boolean;
  localOnlyMode: boolean;
}

interface ProviderPreset {
  id: string;
  label: string;
  badge: string;
  desc: string;
  type: AIProviderConfig['type'];
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  requiresApiKey: boolean;
  keyPlaceholder: string;
}

const PROVIDERS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    badge: '推荐',
    desc: '通用能力强，适合摘要、标签、智能搜索。',
    type: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    chatModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    requiresApiKey: true,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    badge: 'OpenAI 兼容',
    desc: '通过 Gemini OpenAI 兼容接口接入，适合摘要、标签和多语言内容理解。',
    type: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    chatModel: 'gemini-2.5-flash',
    embeddingModel: 'gemini-embedding-001',
    requiresApiKey: true,
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'grok',
    label: 'Grok / xAI',
    badge: '推理',
    desc: '通过 xAI OpenAI 兼容接口接入 Grok 模型，适合快速摘要和分析。',
    type: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    chatModel: 'grok-4',
    embeddingModel: '',
    requiresApiKey: true,
    keyPlaceholder: 'xai-...',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    badge: '中文友好',
    desc: '适合中文书签整理和内容理解。',
    type: 'openai-compatible',
    baseUrl: 'https://api.minimaxi.com/v1',
    chatModel: 'MiniMax-M3',
    embeddingModel: 'embo-01',
    requiresApiKey: true,
    keyPlaceholder: '请输入 MiniMax API Key',
  },
  {
    id: 'qwen',
    label: '通义千问 / Qwen',
    badge: '兼容模式',
    desc: '通过 DashScope OpenAI 兼容接口接入。',
    type: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    chatModel: 'qwen-plus',
    embeddingModel: 'text-embedding-v4',
    requiresApiKey: true,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    badge: '分析',
    desc: '适合低成本推理和标签分析',
    type: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    chatModel: 'deepseek-chat',
    embeddingModel: '',
    requiresApiKey: true,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'moonshot',
    label: 'Kimi / Moonshot',
    badge: '长上下文',
    desc: '适合长文档书签摘要和资料整理。',
    type: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    chatModel: 'moonshot-v1-8k',
    embeddingModel: '',
    requiresApiKey: true,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    badge: '国产',
    desc: '适合中文标签、标题优化和内容归纳。',
    type: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    chatModel: 'glm-4-flash',
    embeddingModel: 'embedding-3',
    requiresApiKey: true,
    keyPlaceholder: '请输入智谱 API Key',
  },
  {
    id: 'doubao',
    label: '豆包 / 火山方舟',
    badge: '国内',
    desc: '通过火山方舟 OpenAI 兼容接口接入豆包模型。',
    type: 'openai-compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    chatModel: 'doubao-1-5-lite-32k',
    embeddingModel: '',
    requiresApiKey: true,
    keyPlaceholder: '请输入火山方舟 API Key',
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    badge: '多模型',
    desc: '可接入 Qwen、DeepSeek、GLM 等多种模型',
    type: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
    chatModel: 'Qwen/Qwen2.5-72B-Instruct',
    embeddingModel: 'BAAI/bge-m3',
    requiresApiKey: true,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    badge: '聚合',
    desc: '使用一个 Key 接入多家模型',
    type: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatModel: 'openai/gpt-4o-mini',
    embeddingModel: '',
    requiresApiKey: true,
    keyPlaceholder: 'sk-or-...',
  },
  {
    id: 'groq',
    label: 'Groq',
    badge: '高速',
    desc: '适合快速标签和摘要',
    type: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    chatModel: 'llama-3.3-70b-versatile',
    embeddingModel: '',
    requiresApiKey: true,
    keyPlaceholder: 'gsk_...',
  },
  {
    id: 'together',
    label: 'Together AI',
    badge: '开源模型',
    desc: '适合接入 Llama、Qwen 等开源模型。',
    type: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    chatModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    embeddingModel: 'BAAI/bge-base-en-v1.5',
    requiresApiKey: true,
    keyPlaceholder: '请输入 Together API Key',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio 本地服务',
    badge: '本地',
    desc: '本机运行 OpenAI 兼容服务，适合离线或局域网模型。',
    type: 'openai-compatible',
    baseUrl: 'http://localhost:1234/v1',
    chatModel: 'local-model',
    embeddingModel: '',
    requiresApiKey: false,
    keyPlaceholder: '',
  },
  {
    id: 'ollama',
    label: 'Ollama 本地模型',
    badge: '本地',
    desc: '在本机运行模型，不需要云端 API Key。',
    type: 'ollama-compatible',
    baseUrl: 'http://localhost:11434',
    chatModel: 'qwen2.5',
    embeddingModel: 'nomic-embed-text',
    requiresApiKey: false,
    keyPlaceholder: '',
  },
  {
    id: 'custom',
    label: '自定义 OpenAI 兼容',
    badge: '高级',
    desc: '用于代理网关、第三方兼容接口或私有模型服务。',
    type: 'openai-compatible',
    baseUrl: '',
    chatModel: '',
    embeddingModel: '',
    requiresApiKey: true,
    keyPlaceholder: '请输入兼容接口 API Key',
  },
];


const PROVIDER_EN: Record<string, Pick<ProviderPreset, 'label' | 'badge' | 'desc'>> = {
  openai: { label: 'OpenAI', badge: 'Recommended', desc: 'Strong general-purpose model for summaries, tags, and smart search.' },
  gemini: { label: 'Gemini', badge: 'OpenAI compatible', desc: 'Connect through the Gemini OpenAI-compatible API for summaries, tags, and multilingual content.' },
  grok: { label: 'Grok / xAI', badge: 'Reasoning', desc: 'Connect through the xAI OpenAI-compatible API for quick summaries and analysis.' },
  minimax: { label: 'MiniMax', badge: 'Chinese support', desc: 'Useful for organizing Chinese bookmarks and understanding their content.' },
  qwen: { label: 'Qwen', badge: 'Compatible API', desc: 'Connect through the DashScope OpenAI-compatible API.' },
  deepseek: { label: 'DeepSeek', badge: 'Analysis', desc: 'Cost-effective reasoning and tag analysis.' },
  moonshot: { label: 'Kimi / Moonshot', badge: 'Long context', desc: 'Useful for long-document summaries and research.' },
  zhipu: { label: 'Zhipu GLM', badge: 'China', desc: 'Useful for Chinese tags, title improvements, and content summaries.' },
  doubao: { label: 'Doubao / Volcengine', badge: 'China', desc: 'Connect Doubao through the Volcengine OpenAI-compatible API.' },
  siliconflow: { label: 'SiliconFlow', badge: 'Multiple models', desc: 'Connect to Qwen, DeepSeek, GLM, and other models.' },
  openrouter: { label: 'OpenRouter', badge: 'Aggregator', desc: 'Use one API key to access multiple model providers.' },
  groq: { label: 'Groq', badge: 'Fast', desc: 'Useful for quick tags and summaries.' },
  together: { label: 'Together AI', badge: 'Open models', desc: 'Connect to open models such as Llama and Qwen.' },
  lmstudio: { label: 'LM Studio local server', badge: 'Local', desc: 'Run an OpenAI-compatible server on this device or local network.' },
  ollama: { label: 'Ollama local model', badge: 'Local', desc: 'Run models on this device without a cloud API key.' },
  custom: { label: 'Custom OpenAI-compatible', badge: 'Advanced', desc: 'Connect a gateway, compatible third-party API, or private model server.' },
};

function ui(locale: 'zh' | 'en', zh: string, en: string) {
  return locale === 'en' ? en : zh;
}

function inferProviderId(config: AIProviderConfig): string {
  if (config.type === 'ollama-compatible') return 'ollama';
  const baseUrl = config.baseUrl?.replace(/\/$/, '');
  return PROVIDERS.find((provider) => provider.type === config.type && provider.baseUrl.replace(/\/$/, '') === baseUrl)?.id ?? 'custom';
}

function suggestedOpenAIBaseUrl(baseUrl: string): string | null {
  const raw = baseUrl.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const hasOnlyOrigin = url.pathname === '/' && !url.search && !url.hash;
    if (!hasOnlyOrigin || !['http:', 'https:'].includes(url.protocol)) return null;

    return `${url.origin}/v1`;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  const [providerId, setProviderId] = useState('openai');
  const [baseUrl, setBaseUrl] = useState(PROVIDERS[0].baseUrl);
  const [apiKey, setApiKey] = useState('');
  const [chatModel, setChatModel] = useState(PROVIDERS[0].chatModel);
  const [embeddingModel, setEmbeddingModel] = useState(PROVIDERS[0].embeddingModel);

  const selectedProvider = useMemo(
    () => PROVIDERS.find((provider) => provider.id === providerId) ?? PROVIDERS[0],
    [providerId]
  );

  const canReuseSavedKey = Boolean(
    selectedProvider.requiresApiKey &&
    settings?.aiProvider.apiKey &&
    settings.aiProvider.type === selectedProvider.type &&
    settings.aiProvider.baseUrl?.replace(/\/$/, '') === baseUrl.replace(/\/$/, '')
  );

  const baseUrlSuggestion = selectedProvider.type === 'openai-compatible'
    ? suggestedOpenAIBaseUrl(baseUrl)
    : null;
  const hasRequiredCredential = !selectedProvider.requiresApiKey || Boolean(apiKey.trim()) || canReuseSavedKey;
  const isReady = Boolean(baseUrl.trim() && chatModel.trim() && hasRequiredCredential);

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    const inferredProviderId = data.aiProvider.type === 'mock' ? 'openai' : inferProviderId(data.aiProvider);
    const preset = PROVIDERS.find((provider) => provider.id === inferredProviderId) ?? PROVIDERS[0];

    setSettings(data);
    setProviderId(inferredProviderId);
    setBaseUrl(data.aiProvider.type === 'mock' ? preset.baseUrl : data.aiProvider.baseUrl ?? preset.baseUrl);
    setApiKey('');
    setChatModel(data.aiProvider.type === 'mock' ? preset.chatModel : data.aiProvider.chatModel ?? preset.chatModel);
    setEmbeddingModel(data.aiProvider.type === 'mock' ? preset.embeddingModel : data.aiProvider.embeddingModel ?? preset.embeddingModel);
  }, []);

  useEffect(() => {
    // Existing app pages hydrate local API state from client effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings().catch(() => setError('settings_load_failed')).finally(() => setLoading(false));
  }, [loadSettings]);

  function selectProvider(provider: ProviderPreset) {
    setProviderId(provider.id);
    setBaseUrl(provider.baseUrl);
    setApiKey('');
    setChatModel(provider.chatModel);
    setEmbeddingModel(provider.embeddingModel);
    setSaved(false);
    setTestResult(null);
    setError('');
  }

  function buildProviderConfig(includeMaskedKey = false): AIProviderConfig {
    const config: AIProviderConfig = {
      type: selectedProvider.type,
      baseUrl: baseUrl.trim(),
      chatModel: chatModel.trim(),
      embeddingModel: embeddingModel.trim() || undefined,
    };

    if (selectedProvider.requiresApiKey) {
      if (apiKey.trim()) {
        config.apiKey = apiKey.trim();
      } else if (includeMaskedKey && canReuseSavedKey) {
        config.apiKey = '****';
      }
    }

    return config;
  }

  async function handleSave() {
    setError('');
    setSaved(false);

    if (!isReady) {
      setError(ui(locale, '书签帮帮忙需要 AI 服务；请配置一个可用的 AI 服务', 'Configure a usable AI provider first.'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider: buildProviderConfig() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(localizedError(locale, data.error, ui(locale, '保存失败。', 'Failed to save settings.')));
      }

      await loadSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '保存失败。', 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleClearApiKey() {
    setError('');
    setSaved(false);
    setTestResult(null);
    setSaving(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiProvider: buildProviderConfig(false),
          clearApiKey: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(localizedError(locale, data.error, ui(locale, '删除失败。', 'Failed to remove the saved key.')));
      }

      await loadSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '删除失败。', 'Failed to remove the saved key.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setError('');
    setTestResult(null);

    if (!isReady) {
      setError(ui(locale, '请先补齐 API 地址、模型和 Key，再测试连接。', 'Enter an API address, model, and key before testing.'));
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/settings/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider: buildProviderConfig(true) }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(localizedError(locale, data.error, ui(locale, '连接失败。', 'Connection failed.')));
      }

      setTestResult({ ok: true, message: `${ui(locale, '连接成功', 'Connected')}: ${data.provider} / ${data.model ?? chatModel}` });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : ui(locale, '连接失败。', 'Connection failed.') });
    } finally {
      setTesting(false);
    }
  }

  async function handleResetDB() {
    const confirmed = window.confirm(
      ui(locale, '确定清空当前书签库吗？书签、AI 解析结果、向量索引、标签、文件夹和整理建议都会永久删除；数据库结构和 AI 配置会保留。', 'Clear this bookmark library? Bookmarks, AI results, vector indexes, tags, folders, and organize suggestions will be permanently deleted. The database structure and AI settings will remain.')
    );
    if (!confirmed) return;

    setClearingData(true);
    setResetNotice('');
    setError('');

    try {
      const res = await fetch('/api/settings/clear-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'CLEAR_BOOKMARK_DATA' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localizedError(locale, data.error, ui(locale, '清空书签数据失败', 'Failed to clear bookmark data')));

      setResetNotice(ui(locale, `已清空 ${Number(data.cleared?.bookmarks ?? 0)} 条书签及关联数据`, `Cleared ${Number(data.cleared?.bookmarks ?? 0)} bookmarks and related data`));
    } catch (err) {
      setError(err instanceof Error ? err.message : ui(locale, '清空书签数据失败', 'Failed to clear bookmark data'));
    } finally {
      setClearingData(false);
    }
  }

  if (loading) return <div className="text-muted animate-pulse">{t.common.loading}</div>;

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#48664E]">{ui(locale, 'AI 接入中心', 'AI Provider Center')}</p>
          <h1 className="mt-1 text-lg font-bold tracking-tight text-[#23372B]">{t.nav.aiCenter}</h1>
          <p className="mt-1 text-xs text-[#59634F]">
            {ui(locale, '默认不需要配置大模型也能使用大部分整理功能。Key 仅写入书签帮帮忙的本地数据库，接口响应不会回显明文。', 'Most organizing features work without an AI provider. Your key is stored only in the local database and is never returned in plain text by the settings API.')}
          </p>
        </div>
        <div className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
          isReady ? 'border-[#48664E]/20 bg-[#F1EBDD] text-[#48664E]' : 'border-[#ba1a1a]/20 bg-[#ffdad6] text-[#ba1a1a]'
        }`}>
          {isReady ? ui(locale, 'AI 服务已具备保存条件', 'AI provider ready to save') : ui(locale, 'AI 服务未配置完成', 'AI provider not configured')}
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-[#ba1a1a]/20 bg-[#ffdad6] px-3 py-2 text-xs text-[#ba1a1a]">
          {error === 'settings_load_failed' ? ui(locale, '设置加载失败。', 'Failed to load settings.') : localizedError(locale, error, ui(locale, '操作失败。', 'Operation failed.'))}
        </div>
      )}

      <section className="rounded-lg border border-[#E1D9C9] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider">{locale === 'en' ? 'Choose an AI provider' : '选择 AI Key 类型'}</h2>
            <p className="mt-1 text-xs text-[#59634F]">{locale === 'en' ? 'Selecting a provider fills in common API addresses and model names.' : '选择服务商后会自动填充常用 API 地址和模型名。'}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => selectProvider(provider)}
              className={`rounded-lg border p-4 text-left transition ${
                providerId === provider.id
                  ? 'border-[#59634F] bg-[#EDE6D6]/40'
                  : 'border-[#E1D9C9] bg-white hover:border-[#59634F]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-xs text-[#23372B]">{locale === 'en' ? PROVIDER_EN[provider.id].label : provider.label}</span>
                <span className="rounded bg-[#EDE6D6] px-1.5 py-0.5 text-[9px] font-bold text-[#59634F] uppercase">{locale === 'en' ? PROVIDER_EN[provider.id].badge : provider.badge}</span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-[#59634F]">{locale === 'en' ? PROVIDER_EN[provider.id].desc : provider.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Field label={locale === 'en' ? 'API address' : 'API 地址'}>
            <>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={selectedProvider.type === 'ollama-compatible' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
                className="h-8 w-full rounded border border-[#E1D9C9] bg-[#F8F7F2] px-2.5 text-xs outline-none focus:border-[#48664E]"
              />
              {baseUrlSuggestion && (
                <p className="mt-2 text-xs leading-5 text-[#b54708]">
                  {ui(locale, '这个地址看起来像服务首页。OpenAI 兼容接口通常要填到接口前缀，例如', 'This looks like the provider homepage. OpenAI-compatible APIs usually need the API prefix, for example')} {baseUrlSuggestion}.
                </p>
              )}
            </>
          </Field>

          {selectedProvider.requiresApiKey && (
            <Field label="API Key">
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={canReuseSavedKey ? ui(locale, '已保存 Key；留空则沿用', 'Key saved; leave blank to reuse it') : locale === 'en' && /[\u3400-\u9fff]/.test(selectedProvider.keyPlaceholder) ? `Enter ${PROVIDER_EN[selectedProvider.id].label} API key` : selectedProvider.keyPlaceholder}
                className="h-8 w-full rounded border border-[#E1D9C9] bg-[#F8F7F2] px-2.5 text-xs outline-none focus:border-[#48664E]"
              />
            </Field>
          )}

          <Field label={locale === 'en' ? 'Chat model' : '对话模型'}>
            <input
              value={chatModel}
              onChange={(event) => setChatModel(event.target.value)}
              placeholder="gpt-4o-mini"
              className="h-8 w-full rounded border border-[#E1D9C9] bg-[#F8F7F2] px-2.5 text-xs outline-none focus:border-[#48664E]"
            />
          </Field>

          <Field label={locale === 'en' ? 'Embedding model' : '向量模型'}>
            <input
              value={embeddingModel}
              onChange={(event) => setEmbeddingModel(event.target.value)}
              placeholder={selectedProvider.id === 'deepseek' ? ui(locale, '按兼容服务填写，可留空后续补充', 'Use a compatible model, or leave blank for now') : 'text-embedding-3-small'}
              className="h-8 w-full rounded border border-[#E1D9C9] bg-[#F8F7F2] px-2.5 text-xs outline-none focus:border-[#48664E]"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 rounded-md bg-[#294435] px-4 text-xs font-semibold text-white transition hover:bg-[#1F3228] disabled:opacity-50"
          >
            {saving ? (locale === 'en' ? 'Saving...' : '保存中...') : (locale === 'en' ? 'Save AI settings' : '保存 AI 配置')}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="h-8 rounded-md border border-[#E1D9C9] bg-white px-4 text-xs font-semibold text-[#26372D] hover:bg-[#EEE9DF] transition disabled:opacity-50"
          >
            {testing ? (locale === 'en' ? 'Testing...' : '测试中...') : (locale === 'en' ? 'Test connection' : '测试连接')}
          </button>
          {saved && <span className="text-xs font-semibold text-[#157347]">{t.settings.saved}</span>}
          {testResult && (
            <span className={`max-w-full break-words text-xs font-semibold ${testResult.ok ? 'text-[#157347]' : 'text-[#ba1a1a]'}`}>
              {testResult.message}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SecurityNote title={ui(locale, '本地保存', 'Stored locally')} desc={ui(locale, 'Key 写入书签帮帮忙的本地数据库，不会同步到云端', 'Your key stays in the local database and is not synced to the cloud.')} />
          <SecurityNote title={ui(locale, '不会回显', 'Never shown again')} desc={ui(locale, '设置接口只返回掩码，页面留空会沿用已保存 Key。', 'The settings API returns a masked key. Leave the field blank to reuse the saved key.')} />
          <SecurityNote title={ui(locale, '可随时删除', 'Remove anytime')} desc={ui(locale, '删除后需要重新输入 Key 才能调用外部 AI。', 'After removal, enter a key again to use external AI.')} />
        </div>

        {canReuseSavedKey && (
          <button
            onClick={handleClearApiKey}
            disabled={saving}
            className="mt-4 rounded-md border border-[#ba1a1a] px-3 py-1.5 text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6] transition disabled:opacity-50"
          >
            {ui(locale, '删除已保存 Key', 'Remove saved key')}
          </button>
        )}
      </section>

      <section className="rounded-lg border border-[#E1D9C9] bg-white p-4">
        <h2 className="text-xs font-bold text-[#23372B] uppercase tracking-wider">{locale === 'en' ? 'Current settings' : '当前生效逻辑'}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <StatusItem label={ui(locale, '产品定位', 'Product')} value={ui(locale, 'AI 书签管家', 'AI bookmark manager')} />
          <StatusItem label={ui(locale, '当前 Provider', 'Current provider')} value={settings?.aiProvider.type === 'mock' ? ui(locale, '未配置真实 AI', 'No real AI configured') : locale === 'en' ? PROVIDER_EN[selectedProvider.id].label : selectedProvider.label} />
          <StatusItem label={ui(locale, '本地优先', 'Local-first mode')} value={settings?.localOnlyMode ? t.settings.on : t.settings.off} />
        </div>
        <p className="mt-4 text-xs leading-5 text-[#59634F]">
          {ui(locale, '标签只作为辅助检索元数据，AI 会优先复用已有标签、减少近义标签，避免越生成越多。文件夹层级和一级上限在「整理建议」页配置，因为它会直接影响分类建议生成。', 'Tags are search metadata. AI reuses existing tags where possible and avoids near-duplicates. Set folder depth and the top-level limit on the Organize Suggestions page; these affect classification suggestions.')}
        </p>
      </section>

      <section className="rounded-lg border border-[#ba1a1a]/20 bg-white p-4">
        <h2 className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider">{t.settings.dangerZone}</h2>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#23372B]">{locale === 'en' ? 'Clear bookmark data' : '清空书签数据'}</p>
            <p className="text-[11px] text-[#59634F] mt-0.5">{ui(locale, '删除书签、AI 解析结果、向量索引、标签、文件夹和整理建议；保留数据库结构与 AI 配置', 'Delete bookmarks, AI results, vector indexes, tags, folders, and suggestions; keep database structure and AI settings.')}</p>
            {resetNotice && <p className="mt-2 text-xs font-semibold text-[#157347]">{resetNotice}</p>}
          </div>
          <button
            onClick={handleResetDB}
            disabled={clearingData}
            className="rounded-md border border-[#ba1a1a] px-3 py-1 text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6] transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {clearingData ? (locale === 'en' ? 'Clearing...' : '清空中...') : (locale === 'en' ? 'Clear bookmark data' : '清空书签数据')}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#59634F]">{label}</span>
      {children}
    </label>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#E1D9C9] bg-[#F8F7F2] p-3">
      <div className="text-[10px] font-semibold text-[#6F7864] uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-[#23372B]">{value}</div>
    </div>
  );
}

function SecurityNote({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded border border-[#E1D9C9] bg-[#F8F7F2] p-3">
      <div className="text-xs font-semibold text-[#23372B]">{title}</div>
      <div className="mt-1 text-[11px] leading-4 text-[#59634F]">{desc}</div>
    </div>
  );
}
